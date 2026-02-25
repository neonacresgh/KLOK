import { Student, StudentFormData } from '@/types/student';
import { StudentStorage } from './studentStorage';
import { FirebaseStudentStorage } from './firebaseStudentStorage';

export type StorageMode = 'local' | 'firebase' | 'hybrid';

export class HybridStudentStorage {
  private static instance: HybridStudentStorage;
  private localStorage: StudentStorage;
  private firebaseStorage: FirebaseStudentStorage;
  private mode: StorageMode;
  private isOnline: boolean;

  private constructor() {
    this.localStorage = StudentStorage.getInstance();
    this.firebaseStorage = FirebaseStudentStorage.getInstance();
    this.mode = 'hybrid'; // Default mode
    // Guard against SSR — navigator/window are browser-only
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Listen for online/offline events (browser only)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncWithFirebase();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  static getInstance(): HybridStudentStorage {
    if (!HybridStudentStorage.instance) {
      HybridStudentStorage.instance = new HybridStudentStorage();
    }
    return HybridStudentStorage.instance;
  }

  setMode(mode: StorageMode): void {
    this.mode = mode;
  }

  getMode(): StorageMode {
    return this.mode;
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  async getAllStudents(): Promise<Student[]> {
    if (this.mode === 'local' || !this.isOnline) {
      return this.localStorage.getAllStudents();
    }

    if (this.mode === 'firebase') {
      return this.firebaseStorage.getAllStudents();
    }

    // Hybrid mode: prioritize Firebase, fallback to local
    try {
      const firebaseStudents = await this.firebaseStorage.getAllStudents();
      const localStudents = this.localStorage.getAllStudents();

      // Merge and sync if needed
      if (firebaseStudents.length > 0) {
        await this.syncWithFirebase();
        return firebaseStudents;
      }

      return localStudents;
    } catch (error) {
      console.error('Firebase error, falling back to local storage:', error);
      return this.localStorage.getAllStudents();
    }
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    if (this.mode === 'local' || !this.isOnline) {
      return this.localStorage.getStudentById(id);
    }

    if (this.mode === 'firebase') {
      const result = await this.firebaseStorage.getStudentById(id);
      return result || undefined;
    }

    // Hybrid mode
    try {
      const firebaseStudent = await this.firebaseStorage.getStudentById(id);
      if (firebaseStudent) return firebaseStudent;

      return this.localStorage.getStudentById(id);
    } catch (error) {
      console.error('Firebase error, falling back to local storage:', error);
      return this.localStorage.getStudentById(id);
    }
  }

  async addStudent(studentData: StudentFormData): Promise<Student> {
    const localStudent = this.localStorage.addStudent(studentData);

    if (this.mode === 'local' || !this.isOnline) {
      return localStudent;
    }

    if (this.mode === 'firebase') {
      try {
        return this.firebaseStorage.addStudent(studentData);
      } catch (error) {
        console.error('Firebase error, saved locally:', error);
        return localStudent;
      }
    }

    // Hybrid mode: save to both
    try {
      const firebaseStudent = await this.firebaseStorage.addStudent(studentData);
      return firebaseStudent;
    } catch (error) {
      console.error('Firebase error, saved locally:', error);
      return localStudent;
    }
  }

  async updateStudent(id: string, updates: Partial<StudentFormData>): Promise<Student | null> {
    const localResult = this.localStorage.updateStudent(id, updates);

    if (this.mode === 'local' || !this.isOnline) {
      return localResult;
    }

    if (this.mode === 'firebase') {
      try {
        return this.firebaseStorage.updateStudent(id, updates);
      } catch (error) {
        console.error('Firebase error, updated locally:', error);
        return localResult;
      }
    }

    // Hybrid mode: update both
    try {
      const firebaseResult = await this.firebaseStorage.updateStudent(id, updates);
      return firebaseResult;
    } catch (error) {
      console.error('Firebase error, updated locally:', error);
      return localResult;
    }
  }

  async deleteStudent(id: string): Promise<boolean> {
    const localResult = this.localStorage.deleteStudent(id);

    if (this.mode === 'local' || !this.isOnline) {
      return localResult;
    }

    if (this.mode === 'firebase') {
      try {
        return this.firebaseStorage.deleteStudent(id);
      } catch (error) {
        console.error('Firebase error, deleted locally:', error);
        return localResult;
      }
    }

    // Hybrid mode: delete from both
    try {
      const firebaseResult = this.firebaseStorage.deleteStudent(id);
      return firebaseResult;
    } catch (error) {
      console.error('Firebase error, deleted locally:', error);
      return localResult;
    }
  }

  async searchStudents(query: string, filters?: {
    gender?: string;
    emailStatus?: string;
    roleRank?: string;
  }): Promise<Student[]> {
    if (this.mode === 'local' || !this.isOnline) {
      return this.localStorage.searchStudents(query, filters);
    }

    if (this.mode === 'firebase') {
      try {
        return this.firebaseStorage.searchStudents(query, filters);
      } catch (error) {
        console.error('Firebase error, searching locally:', error);
        return this.localStorage.searchStudents(query, filters);
      }
    }

    // Hybrid mode: try Firebase first, fallback to local
    try {
      return this.firebaseStorage.searchStudents(query, filters);
    } catch (error) {
      console.error('Firebase error, searching locally:', error);
      return this.localStorage.searchStudents(query, filters);
    }
  }

  async importStudents(students: Student[]): Promise<void> {
    this.localStorage.importStudents(students);

    if (this.mode === 'local' || !this.isOnline) {
      return;
    }

    try {
      await this.firebaseStorage.importStudents(students);
    } catch (error) {
      console.error('Firebase import error, saved locally:', error);
    }
  }

  async exportStudents(): Promise<Student[]> {
    if (this.mode === 'local' || !this.isOnline) {
      return this.localStorage.exportStudents();
    }

    if (this.mode === 'firebase') {
      try {
        return this.firebaseStorage.exportStudents();
      } catch (error) {
        console.error('Firebase export error, exporting local data:', error);
        return this.localStorage.exportStudents();
      }
    }

    // Hybrid mode: try Firebase first, fallback to local
    try {
      return this.firebaseStorage.exportStudents();
    } catch (error) {
      console.error('Firebase export error, exporting local data:', error);
      return this.localStorage.exportStudents();
    }
  }

  clearAllStudents(): void {
    this.localStorage.clearAllStudents();

    if (this.mode === 'firebase' && this.isOnline) {
      // Note: Firebase doesn't have a clear all function, would need to delete individually
      console.warn('Firebase clear all not implemented. Please delete students individually.');
    }
  }

  async syncWithFirebase(): Promise<void> {
    if (!this.isOnline || this.mode === 'local') {
      return;
    }

    try {
      const localStudents = this.localStorage.getAllStudents();
      await this.firebaseStorage.syncWithLocal(localStudents);

      // Update local with latest from Firebase
      const firebaseStudents = await this.firebaseStorage.getAllStudents();
      this.localStorage.importStudents(firebaseStudents);

      console.log('Sync with Firebase completed successfully');
    } catch (error) {
      console.error('Sync with Firebase failed:', error);
    }
  }

  async forceSyncToFirebase(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync to Firebase while offline');
    }

    const localStudents = this.localStorage.getAllStudents();
    await this.firebaseStorage.importStudents(localStudents);
    console.log('Force sync to Firebase completed');
  }

  async forceSyncFromFirebase(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync from Firebase while offline');
    }

    const firebaseStudents = await this.firebaseStorage.getAllStudents();
    this.localStorage.importStudents(firebaseStudents);
    console.log('Force sync from Firebase completed');
  }
}
