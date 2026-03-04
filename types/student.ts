export interface Student {
  id: string;
  surname: string;
  otherNames: string;
  gender: 'Male' | 'Female' | 'Other';
  emailAddress: string;
  dateOfBirth: string;
  roleRank: string;
  emailStatus: 'Active' | 'Inactive' | 'Pending';
  program?: string;
  phone?: string;
  imageUrl?: string;
  // Hostel-specific fields
  hostelName?: string;
  roomNumber?: string;
  bedNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFormData {
  surname: string;
  otherNames: string;
  gender: 'Male' | 'Female' | 'Other';
  emailAddress: string;
  dateOfBirth: string;
  roleRank: string;
  emailStatus: 'Active' | 'Inactive' | 'Pending';
}

export interface SearchFilters {
  query: string;
  gender?: string;
  emailStatus?: string;
  roleRank?: string;
}
