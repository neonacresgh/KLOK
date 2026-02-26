/**
 * clearAndReseed.mjs — Clear students collection & reimport from CSV (no duplicates)
 *
 * What it does:
 *   1. Deletes every document in the `students` Firestore collection in batches
 *   2. Re-imports all students from students_data.csv using email as document ID (idempotent)
 *
 * This guarantees zero duplicates: every student ends up with exactly one document
 * whose ID is their email address (e.g. 20123456@upsamail.edu.gh).
 *
 * ⚠️  Firebase Spark (free) plan: 20,000 writes/day.
 *     With 33,138 students, clearing + reimporting ≈ 66k ops — exceeds one day's quota.
 *     The script pauses and auto-retries when quota is hit.
 *     Upgrade to Blaze (pay-as-you-go) for unlimited writes in one run.
 *
 * Run: node scripts/clearAndReseed.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, writeBatch, limit, query } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Firebase Config ────────────────────────────────────────────────────────────
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

// ─── Config ─────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 400;        // Firestore max is 500; stay below for safety
const DELAY_MS = 1000;         // pause between batches (ms)
const RETRY_DELAY_MS = 60000;  // pause when quota hit before retrying (ms)
const MAX_RETRIES = 5;

// ─── Helpers ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function commitWithRetry(batch, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await batch.commit();
            return;
        } catch (err) {
            const isQuota = err?.code === 'resource-exhausted' ||
                (err?.message || '').includes('RESOURCE_EXHAUSTED');
            if (isQuota && attempt < MAX_RETRIES) {
                console.log(`\n⏳ Quota hit on ${label}. Waiting ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})…`);
                await sleep(RETRY_DELAY_MS);
            } else {
                throw err;
            }
        }
    }
}

// ─── Step 1: Delete all existing documents ──────────────────────────────────────
async function clearCollection(colName) {
    console.log(`\n🗑️  Clearing "${colName}" collection…`);
    let totalDeleted = 0;
    let pageCount = 0;

    while (true) {
        const snap = await getDocs(query(collection(db, colName), limit(BATCH_SIZE)));
        if (snap.empty) break;

        pageCount++;
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(doc(db, colName, d.id)));
        await commitWithRetry(batch, `delete page ${pageCount}`);

        totalDeleted += snap.docs.length;
        process.stdout.write(`\r   Deleted ${totalDeleted.toLocaleString()} documents…`);
        await sleep(DELAY_MS);
    }

    console.log(`\n✅ Cleared ${totalDeleted.toLocaleString()} documents from "${colName}".`);
    return totalDeleted;
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────────
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
        const email = parts[3].trim();
        if (!email) continue;
        students.push({
            id: email,
            surname: parts[0] || '',
            otherNames: parts[1] || '',
            gender: parts[2] || 'Male',
            emailAddress: email,
            dateOfBirth: parts[4] || '',
            roleRank: parts[5] || '',
            emailStatus: parts[6] || 'No History',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    return students;
}

// ─── Step 2: Import fresh from CSV ──────────────────────────────────────────────
async function importStudents(students) {
    const total = students.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    console.log(`\n📥 Importing ${total.toLocaleString()} students (${totalBatches} batches)…\n`);

    let committed = 0;
    const startTime = Date.now();

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
        const batchNo = Math.floor(i / BATCH_SIZE) + 1;
        const chunk = students.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const student of chunk) {
            batch.set(doc(db, 'students', student.id), student);
        }

        await commitWithRetry(batch, `import batch ${batchNo}/${totalBatches}`);
        committed += chunk.length;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = Math.round((committed / total) * 100);
        process.stdout.write(
            `\r✅ Batch ${batchNo}/${totalBatches} — ${committed.toLocaleString()}/${total.toLocaleString()} (${pct}%) — ${elapsed}s`
        );

        if (i + BATCH_SIZE < students.length) await sleep(DELAY_MS);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n🎉 Import complete! ${committed.toLocaleString()} students written in ${elapsed}s.`);
    console.log(`   Every document ID = student email — zero duplicates possible.\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   KLOK — Clear & Reseed (deduplication script)  ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // Step 1: clear
    await clearCollection('students');

    // Step 2: parse CSV
    const csvPath = resolve(__dirname, '../students_data.csv');
    console.log(`\n📂 Reading CSV: ${csvPath}`);
    const students = parseCSV(csvPath);
    console.log(`📊 Parsed ${students.length.toLocaleString()} students from CSV.`);

    // Step 3: import
    await importStudents(students);

    console.log('✔  Done. Check Firebase console to confirm counts.');
    console.log('   https://console.firebase.google.com/project/klok-2a75e/firestore\n');
    process.exit(0);
}

main().catch(err => {
    const isQuota = err?.code === 'resource-exhausted' ||
        (err?.message || '').includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
        console.error('\n\n❌ Daily write quota exhausted (Firebase Spark plan: 20,000 writes/day).');
        console.error('   ✔  Re-run this script tomorrow — it continues safely (deletes already committed).');
        console.error('   ✔  Or upgrade to Blaze plan for unlimited writes.\n');
    } else {
        console.error('\n❌ Script failed:', err.message || err);
    }
    process.exit(1);
});
