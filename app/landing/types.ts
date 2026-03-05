export interface Student {
    id: string;
    surname: string;
    otherNames: string;
    emailAddress: string;
    gender: string;
    dateOfBirth: string;
    roleRank: string;
    emailStatus: string;
    phone: string;
    program?: string;
    imageUrl?: string;
    hostelName?: string;
    roomNumber?: string;
    bedNumber?: string;
    studentId?: string; // from hostel lookup
    name?: string;      // from hostel lookup
    room?: string;      // from hostel lookup
    createdAt?: string;
    updatedAt?: string;
}

export const getPhotoUrl = (email?: string) => {
    if (!email) return '';
    const id = email.split('@')[0];
    return `https://upsasip.com/images/students/contStudents/${id}.jpg`;
};
