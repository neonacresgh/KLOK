'use client';

import { useState, useEffect } from 'react';
import { Student, StudentFormData } from '@/types/student';

interface StudentFormProps {
  student?: Student;
  onSave: (data: StudentFormData) => void;
  onCancel: () => void;
}

export default function StudentForm({ student, onSave, onCancel }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    surname: '',
    otherNames: '',
    gender: 'Male',
    emailAddress: '',
    dateOfBirth: '',
    roleRank: '',
    emailStatus: 'Active',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormData, string>>>({});

  useEffect(() => {
    if (student) {
      setFormData({
        surname: student.surname,
        otherNames: student.otherNames,
        gender: student.gender,
        emailAddress: student.emailAddress,
        dateOfBirth: student.dateOfBirth,
        roleRank: student.roleRank,
        emailStatus: student.emailStatus,
      });
    }
  }, [student]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof StudentFormData, string>> = {};

    if (!formData.surname.trim()) {
      newErrors.surname = 'Surname is required';
    }

    if (!formData.otherNames.trim()) {
      newErrors.otherNames = 'Other names are required';
    }

    if (!formData.emailAddress.trim()) {
      newErrors.emailAddress = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailAddress)) {
      newErrors.emailAddress = 'Please enter a valid email address';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }

    if (!formData.roleRank.trim()) {
      newErrors.roleRank = 'Role/Rank is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof StudentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {student ? 'Edit Student' : 'Add New Student'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-2">
              Surname *
            </label>
            <input
              type="text"
              id="surname"
              value={formData.surname}
              onChange={(e) => handleChange('surname', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.surname ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter surname"
            />
            {errors.surname && (
              <p className="mt-1 text-sm text-red-600">{errors.surname}</p>
            )}
          </div>

          <div>
            <label htmlFor="otherNames" className="block text-sm font-medium text-gray-700 mb-2">
              Other Names *
            </label>
            <input
              type="text"
              id="otherNames"
              value={formData.otherNames}
              onChange={(e) => handleChange('otherNames', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.otherNames ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter other names"
            />
            {errors.otherNames && (
              <p className="mt-1 text-sm text-red-600">{errors.otherNames}</p>
            )}
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
              Gender *
            </label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="emailAddress"
              value={formData.emailAddress}
              onChange={(e) => handleChange('emailAddress', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.emailAddress ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="student@example.com"
            />
            {errors.emailAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.emailAddress}</p>
            )}
          </div>

          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
              Date of Birth *
            </label>
            <input
              type="date"
              id="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.dateOfBirth && (
              <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
            )}
          </div>

          <div>
            <label htmlFor="roleRank" className="block text-sm font-medium text-gray-700 mb-2">
              Role / Rank *
            </label>
            <input
              type="text"
              id="roleRank"
              value={formData.roleRank}
              onChange={(e) => handleChange('roleRank', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.roleRank ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Student, Teacher, Admin"
            />
            {errors.roleRank && (
              <p className="mt-1 text-sm text-red-600">{errors.roleRank}</p>
            )}
          </div>

          <div>
            <label htmlFor="emailStatus" className="block text-sm font-medium text-gray-700 mb-2">
              Email Status *
            </label>
            <select
              id="emailStatus"
              value={formData.emailStatus}
              onChange={(e) => handleChange('emailStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {student ? 'Update Student' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
