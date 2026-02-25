import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { Student, StudentFormData } from '@/types/student';

const STUDENTS_COLLECTION = 'students';

// Lazy initialization of Firebase to avoid SSR issues
let db: any = null;
let isFirebaseInitialized = false;

const initializeFirebase = async () => {
  if (isFirebaseInitialized || typeof window === 'undefined') return;

  try {
    const { db: firestoreDb } = await import('@/lib/firebase');
    db = firestoreDb;
    isFirebaseInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
};

export class FirebaseStudentStorage {
  private static instance: FirebaseStudentStorage;

  static getInstance(): FirebaseStudentStorage {
    if (!FirebaseStudentStorage.instance) {
      FirebaseStudentStorage.instance = new FirebaseStudentStorage();
    }
    return FirebaseStudentStorage.instance;
  }

  private async ensureFirebase() {
    await initializeFirebase();
    if (!db) {
      throw new Error('Firebase is not available');
    }
  }

  private convertTimestamps(student: any): Student {
    return {
      ...student,
      dateOfBirth: student.dateOfBirth instanceof Timestamp
        ? student.dateOfBirth.toDate().toISOString().split('T')[0]
        : student.dateOfBirth,
      createdAt: student.createdAt instanceof Timestamp
        ? student.createdAt.toDate().toISOString()
        : student.createdAt,
      updatedAt: student.updatedAt instanceof Timestamp
        ? student.updatedAt.toDate().toISOString()
        : student.updatedAt,
    };
  }

  async getAllStudents(): Promise<Student[]> {
    try {
      await this.ensureFirebase();
      const q = query(collection(db, STUDENTS_COLLECTION), orderBy('surname', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.convertTimestamps({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching students from Firebase:', error);
      return [];
    }
  }

  async getStudentById(id: string): Promise<Student | null> {
    try {
      await this.ensureFirebase();
      const docRef = doc(db, STUDENTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return this.convertTimestamps({ id: docSnap.id, ...docSnap.data() });
      }
      return null;
    } catch (error) {
      console.error('Error fetching student from Firebase:', error);
      return null;
    }
  }

  async addStudent(studentData: StudentFormData): Promise<Student> {
    try {
      await this.ensureFirebase();
      const newStudent = {
        ...studentData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), newStudent);
      return this.convertTimestamps({ id: docRef.id, ...newStudent });
    } catch (error) {
      console.error('Error adding student to Firebase:', error);
      throw error;
    }
  }

  async updateStudent(id: string, updates: Partial<StudentFormData>): Promise<Student | null> {
    try {
      await this.ensureFirebase();
      const docRef = doc(db, STUDENTS_COLLECTION, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, updateData);

      const updatedDoc = await getDoc(docRef);
      if (updatedDoc.exists()) {
        return this.convertTimestamps({ id: updatedDoc.id, ...updatedDoc.data() });
      }
      return null;
    } catch (error) {
      console.error('Error updating student in Firebase:', error);
      throw error;
    }
  }

  async deleteStudent(id: string): Promise<boolean> {
    try {
      await this.ensureFirebase();
      await deleteDoc(doc(db, STUDENTS_COLLECTION, id));
      return true;
    } catch (error) {
      console.error('Error deleting student from Firebase:', error);
      return false;
    }
  }

  async searchStudents(queryText: string, filters?: {
    gender?: string;
    emailStatus?: string;
    roleRank?: string;
  }): Promise<Student[]> {
    try {
      await this.ensureFirebase();
      let q = query(collection(db, STUDENTS_COLLECTION));

      // Apply filters
      if (filters?.gender) {
        q = query(q, where('gender', '==', filters.gender));
      }
      if (filters?.emailStatus) {
        q = query(q, where('emailStatus', '==', filters.emailStatus));
      }
      if (filters?.roleRank) {
        q = query(q, where('roleRank', '==', filters.roleRank));
      }

      const querySnapshot = await getDocs(q);
      let students = querySnapshot.docs.map(doc => this.convertTimestamps({ id: doc.id, ...doc.data() }));

      // Apply text search (client-side since Firestore doesn't support full-text search)
      if (queryText) {
        const lowerQuery = queryText.toLowerCase();
        students = students.filter(student =>
          student.surname.toLowerCase().includes(lowerQuery) ||
          student.otherNames.toLowerCase().includes(lowerQuery) ||
          student.emailAddress.toLowerCase().includes(lowerQuery) ||
          student.roleRank.toLowerCase().includes(lowerQuery)
        );
      }

      return students;
    } catch (error) {
      console.error('Error searching students in Firebase:', error);
      return [];
    }
  }

  async importStudents(students: Student[]): Promise<void> {
    try {
      await this.ensureFirebase();
      const batch = students.map(student => {
        const docRef = doc(db, STUDENTS_COLLECTION, student.id);
        const data = {
          ...student,
          createdAt: Timestamp.fromDate(new Date(student.createdAt)),
          updatedAt: Timestamp.now(),
        };
        return setDoc(docRef, data);
      });

      await Promise.all(batch);
    } catch (error) {
      console.error('Error importing students to Firebase:', error);
      throw error;
    }
  }

  async exportStudents(): Promise<Student[]> {
    return this.getAllStudents();
  }

  async syncWithLocal(localStudents: Student[]): Promise<{
    added: Student[];
    updated: Student[];
    deleted: string[];
  }> {
    try {
      await this.ensureFirebase();
      const firebaseStudents = await this.getAllStudents();
      const localMap = new Map(localStudents.map(s => [s.id, s]));
      const firebaseMap = new Map(firebaseStudents.map(s => [s.id, s]));

      const added: Student[] = [];
      const updated: Student[] = [];
      const deleted: string[] = [];

      // Find students in Firebase but not in local (to be added locally)
      for (const [id, student] of firebaseMap) {
        if (!localMap.has(id)) {
          added.push(student);
        }
      }

      // Find students in both but with different updatedAt (to be updated)
      for (const [id, localStudent] of localMap) {
        const firebaseStudent = firebaseMap.get(id);
        if (firebaseStudent && firebaseStudent.updatedAt !== localStudent.updatedAt) {
          updated.push(firebaseStudent);
        }
      }

      // Find students in local but not in Firebase (to be added to Firebase)
      for (const [id, student] of localMap) {
        if (!firebaseMap.has(id)) {
          await this.addStudent({
            surname: student.surname,
            otherNames: student.otherNames,
            gender: student.gender,
            emailAddress: student.emailAddress,
            dateOfBirth: student.dateOfBirth,
            roleRank: student.roleRank,
            emailStatus: student.emailStatus,
          });
        }
      }

      return { added, updated, deleted };
    } catch (error) {
      console.error('Error syncing with Firebase:', error);
      return { added: [], updated: [], deleted: [] };
    }
  }
}
