import { Student, StudentFormData } from '@/types/student';

const STORAGE_KEY = 'student_database';

export class StudentStorage {
  private static instance: StudentStorage;
  
  static getInstance(): StudentStorage {
    if (!StudentStorage.instance) {
      StudentStorage.instance = new StudentStorage();
    }
    return StudentStorage.instance;
  }

  private getStudents(): Student[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  }

  private saveStudents(students: Student[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  getAllStudents(): Student[] {
    return this.getStudents();
  }

  getStudentById(id: string): Student | undefined {
    const students = this.getStudents();
    return students.find(student => student.id === id);
  }

  addStudent(studentData: StudentFormData): Student {
    const students = this.getStudents();
    const newStudent: Student = {
      id: crypto.randomUUID(),
      ...studentData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    students.push(newStudent);
    this.saveStudents(students);
    return newStudent;
  }

  updateStudent(id: string, updates: Partial<StudentFormData>): Student | null {
    const students = this.getStudents();
    const index = students.findIndex(student => student.id === id);
    
    if (index === -1) return null;
    
    students[index] = {
      ...students[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveStudents(students);
    return students[index];
  }

  deleteStudent(id: string): boolean {
    const students = this.getStudents();
    const index = students.findIndex(student => student.id === id);
    
    if (index === -1) return false;
    
    students.splice(index, 1);
    this.saveStudents(students);
    return true;
  }

  searchStudents(query: string, filters?: {
    gender?: string;
    emailStatus?: string;
    roleRank?: string;
  }): Student[] {
    const students = this.getStudents();
    
    return students.filter(student => {
      const matchesQuery = !query || 
        student.surname.toLowerCase().includes(query.toLowerCase()) ||
        student.otherNames.toLowerCase().includes(query.toLowerCase()) ||
        student.emailAddress.toLowerCase().includes(query.toLowerCase()) ||
        student.roleRank.toLowerCase().includes(query.toLowerCase());
      
      const matchesGender = !filters?.gender || student.gender === filters.gender;
      const matchesEmailStatus = !filters?.emailStatus || student.emailStatus === filters.emailStatus;
      const matchesRoleRank = !filters?.roleRank || student.roleRank === filters.roleRank;
      
      return matchesQuery && matchesGender && matchesEmailStatus && matchesRoleRank;
    });
  }

  importStudents(students: Student[]): void {
    this.saveStudents(students);
  }

  exportStudents(): Student[] {
    return this.getStudents();
  }

  clearAllStudents(): void {
    this.saveStudents([]);
  }
}
