'use client';

import { useState, useEffect } from 'react';
import { Student, StudentFormData } from '@/types/student';
import { HybridStudentStorage } from '@/utils/hybridStudentStorage';
import StudentTable from '@/components/StudentTable';
import StudentForm from '@/components/StudentForm';
import SearchFilters from '@/components/SearchFilters';
import ConnectionStatus from '@/components/ConnectionStatus';
import StorageSettings from '@/components/StorageSettings';

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | undefined>();
  const [storage] = useState(() => HybridStudentStorage.getInstance());

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const allStudents = await storage.getAllStudents();
    setStudents(allStudents);
    setFilteredStudents(allStudents);
  };

  const handleAddStudent = () => {
    setEditingStudent(undefined);
    setShowForm(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleSaveStudent = async (data: StudentFormData) => {
    if (editingStudent) {
      await storage.updateStudent(editingStudent.id, data);
    } else {
      await storage.addStudent(data);
    }
    await loadStudents();
    setShowForm(false);
    setEditingStudent(undefined);
  };

  const handleDeleteStudent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      await storage.deleteStudent(id);
      await loadStudents();
    }
  };

  const handleSearch = async (query: string, filters: {
    gender?: string;
    emailStatus?: string;
    roleRank?: string;
  }) => {
    const results = await storage.searchStudents(query, filters);
    setFilteredStudents(results);
  };

  const handleClearSearch = () => {
    setFilteredStudents(students);
  };

  const handleExportData = async () => {
    const exportData = await storage.exportStudents();
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedStudents = JSON.parse(e.target?.result as string) as Student[];
        await storage.importStudents(importedStudents);
        await loadStudents();
        alert('Data imported successfully!');
      } catch (error) {
        alert('Error importing data. Please check file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Student Management Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Manage student data with offline support - Simple, Fast, and Reliable
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <ConnectionStatus />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {showSettings ? 'Hide Settings' : 'Settings'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={handleAddStudent}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add New Student
          </button>
          
          <button
            onClick={handleExportData}
            disabled={students.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Data
          </button>
          
          <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
            Import Data
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
        </div>

        {showSettings && (
          <div className="mb-8">
            <StorageSettings onSyncComplete={loadStudents} />
          </div>
        )}

        {showForm && (
          <div className="mb-8">
            <StudentForm
              student={editingStudent}
              onSave={handleSaveStudent}
              onCancel={() => {
                setShowForm(false);
                setEditingStudent(undefined);
              }}
            />
          </div>
        )}

        <SearchFilters
          onSearch={handleSearch}
          onClear={handleClearSearch}
        />

        <StudentTable
          students={filteredStudents}
          onEdit={handleEditStudent}
          onDelete={handleDeleteStudent}
          onRefresh={loadStudents}
        />

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Total Students: {students.length} | Showing: {filteredStudents.length}</p>
          <p className="mt-2">Data is stored locally in your browser for offline access</p>
        </div>
      </div>
    </div>
  );
}
