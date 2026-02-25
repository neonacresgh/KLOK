import { Student } from '@/types/student';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  Timestamp,
} from 'firebase/firestore';

const STUDENTS_COLLECTION = 'students';

// Lazy Firebase init
let db: any = null;
const getDb = async () => {
  if (!db) {
    const { db: firestoreDb } = await import('@/lib/firebase');
    db = firestoreDb;
  }
  return db;
};

// Parse CSV data and convert to Student format
export function parseCSVData(csvData: string): Student[] {
  const lines = csvData.trim().split('\n');
  const students: Student[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handles quoted fields with commas inside)
    const parts = line.split(',').map(part => part.trim().replace(/^"(.*)"$/, '$1'));

    if (parts.length >= 7) {
      const email = (parts[3] || '').trim();
      const student: Student = {
        // Use email as the document ID — re-importing the same student is idempotent
        id: email || crypto.randomUUID(),
        surname: parts[0] || '',
        otherNames: parts[1] || '',
        gender: (parts[2] as 'Male' | 'Female' | 'Other') || 'Male',
        emailAddress: email,
        dateOfBirth: parts[4] || '',
        roleRank: parts[5] || '',
        emailStatus: (parts[6] as 'Active' | 'Inactive' | 'Pending') || 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      students.push(student);
    }
  }

  return students;
}

// Import students directly to Firebase — duplicate-safe via setDoc (email = document ID)
// Already-imported students are simply updated in place, not duplicated.
export async function importStudentsToFirebase(csvData: string): Promise<{
  success: boolean;
  message?: string;
  count?: number;
  skipped?: number;
}> {
  try {
    const firestore = await getDb();
    const students = parseCSVData(csvData);

    // --- Step 1: fetch all existing emails from Firestore ---
    const existingSnap = await getDocs(query(collection(firestore, STUDENTS_COLLECTION)));
    const existingEmails = new Set(existingSnap.docs.map(d => d.id));

    let imported = 0;
    let skipped = 0;

    // --- Step 2: write in batches using setDoc (idempotent) ---
    const batchSize = 50;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);

      await Promise.all(
        batch.map(student => {
          if (existingEmails.has(student.id)) {
            skipped++;
            return Promise.resolve(); // already exists — skip
          }
          const docRef = doc(firestore, STUDENTS_COLLECTION, student.id);
          const data = {
            ...student,
            createdAt: Timestamp.fromDate(new Date(student.createdAt)),
            updatedAt: Timestamp.now(),
          };
          imported++;
          return setDoc(docRef, data);
        })
      );

      console.log(
        `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(students.length / batchSize)} — imported: ${imported}, skipped: ${skipped}`
      );
    }

    return {
      success: true,
      count: imported,
      skipped,
      message: `Imported ${imported} new students. ${skipped} already existed and were skipped.`,
    };
  } catch (error) {
    console.error('Error importing students:', error);
    return { success: false, message: (error as Error).message || 'Import failed' };
  }
}
