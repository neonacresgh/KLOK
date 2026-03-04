import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, limit, getDocs } from 'firebase/firestore';

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

async function getSample() {
    try {
        const { where, orderBy } = await import('firebase/firestore');
        const studentsCol = collection(db, 'students');
        // Search for any student with 'program' field
        const programQuery = query(studentsCol, where('program', '!=', ''), limit(5));
        const programSnap = await getDocs(programQuery);

        if (!programSnap.empty) {
            console.log(`Found ${programSnap.size} students with program field:`);
            programSnap.forEach(d => console.log(d.id, ':', d.data().program));
        } else {
            console.log('No students found with program field.');
        }

        // Also just look at one random student
        const randomQuery = query(studentsCol, limit(1));
        const randomSnap = await getDocs(randomQuery);
        if (!randomSnap.empty) {
            console.log('\nRandom student record structure:');
            console.log(JSON.stringify(randomSnap.docs[0].data(), null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

getSample();
