/**
 * importStudents.mjs  —  Duplicate-safe bulk import
 *
 * Uses email as Firestore document ID (setDoc = idempotent).
 * Safe to re-run: existing students are updated in-place, not duplicated.
 *
 * Run: node scripts/importStudents.mjs
 *
 * ⚠️  Firebase Spark (free) plan allows 20,000 writes/day.
 *     If you hit RESOURCE_EXHAUSTED, wait until midnight UTC and re-run.
 *     Or upgrade to Blaze (pay-as-you-go) for unlimited writes.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Firebase Config ───────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: 'AIzaSyC3NjNBNmXISEGZlITOA_b49W7N2blYybE',
    authDomain: 'klok-2a75e.firebaseapp.com',
    projectId: 'klok-2a75e',
    storageBucket: 'klok-2a75e.firebasestorage.app',
    messagingSenderId: '1056407177150',
    appId: '1:1056407177150:web:7bfaf5e283b9d9c721dbef',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Config ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 200;   // well below the 500-doc Firestore limit
const DELAY_MS = 1500;  // pause between successful batches (ms)
const RETRY_DELAY_MS = 60000; // pause when quota exceeded before retrying (ms)
const MAX_RETRIES = 5;

// ─── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
        else { current += char; }
    }
    parts.push(current.trim());
    return parts;
}

function parseCSV(csvPath) {
    const lines = readFileSync(csvPath, 'utf-8').trim().split('\n');
    const students = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = parseCSVLine(line);
        if (parts.length < 7) continue;

        const surname = parts[0] || '';
        const otherNames = parts[1] || '';
        const email = parts[3].trim();
        if (!email) continue;

        // Generate keywords for dynamic search (prefixes of all name parts)
        const nameParts = `${surname} ${otherNames}`.toLowerCase().split(/\s+/).filter(Boolean);
        const searchKeywords = new Set();
        for (const word of nameParts) {
            let prefix = '';
            for (const char of word) {
                prefix += char;
                searchKeywords.add(prefix);
            }
        }

        // Let's also add the full continuous string without spaces as a prefix path 
        // to support searching full names without spaces if needed (optional, but robust)
        const fullString = nameParts.join('');
        let fullPrefix = '';
        for (const char of fullString) {
            fullPrefix += char;
            searchKeywords.add(fullPrefix);
        }

        const searchKeywordsArray = [...searchKeywords];

        students.push({
            id: email,
            surname: surname,
            otherNames: otherNames,
            gender: parts[2] || 'Male',
            emailAddress: email,
            dateOfBirth: parts[4] || '',
            roleRank: parts[5] || '',
            emailStatus: parts[6] || 'No History',
            searchKeywords: searchKeywordsArray, // New field for dynamic search
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    return students;
}

async function commitBatchWithRetry(batch, batchNo, totalBatches) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await batch.commit();
            return true;
        } catch (err) {
            const isQuota = err?.code === 'resource-exhausted' ||
                (err?.message || '').includes('RESOURCE_EXHAUSTED');
            if (isQuota && attempt < MAX_RETRIES) {
                console.log(`\n⏳ Quota hit on batch ${batchNo}/${totalBatches}. Waiting ${RETRY_DELAY_MS / 1000}s before retry (attempt ${attempt}/${MAX_RETRIES})...`);
                await sleep(RETRY_DELAY_MS);
            } else {
                throw err;
            }
        }
    }
    return false;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    // Get starting index from command line argument (default: 0)
    const startIndex = parseInt(process.argv[2]) || 0;

    const csvPath = resolve(__dirname, '../students_data.csv');
    console.log(`\n📂 Reading: ${csvPath}`);

    const students = parseCSV(csvPath);
    const total = students.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    console.log(`📊 Parsed ${total.toLocaleString()} students — ${totalBatches} batches of ${BATCH_SIZE}`);
    console.log(`🚀 Starting from index: ${startIndex.toLocaleString()}\n`);

    let committed = 0;
    const startTime = Date.now();

    for (let i = startIndex; i < students.length; i += BATCH_SIZE) {
        const batchNo = Math.floor((i - startIndex) / BATCH_SIZE) + 1;
        const chunk = students.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const student of chunk) {
            batch.set(doc(db, 'students', student.id), student);
        }

        await commitBatchWithRetry(batch, batchNo, totalBatches);
        committed += chunk.length;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = Math.round((committed / total) * 100);
        process.stdout.write(
            `\r✅ Batch ${batchNo}/${totalBatches} — ${committed.toLocaleString()}/${total.toLocaleString()} (${pct}%) — ${elapsed}s`
        );

        // Pause between batches to respect Firestore write rate limits
        if (i + BATCH_SIZE < students.length) {
            await sleep(DELAY_MS);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n🎉 Done! ${committed.toLocaleString()} students written in ${elapsed}s.\n`);
    console.log(`   Note: Students already in Firestore were updated in-place (email = document ID).`);
    process.exit(0);
}

main().catch(err => {
    const isQuota = err?.code === 'resource-exhausted' ||
        (err?.message || '').includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
        console.error('\n\n❌ Daily write quota exhausted (Firebase Spark plan: 20,000 writes/day).');
        console.error('   ✔  Re-run this script tomorrow — it is safe (no duplicates created).');
        console.error('   ✔  Or upgrade to Blaze plan at console.firebase.google.com for unlimited writes.\n');
    } else {
        console.error('\n❌ Import failed:', err.message || err);
    }
    process.exit(1);
});
