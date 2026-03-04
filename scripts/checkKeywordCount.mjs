import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getCountFromServer } from 'firebase/firestore';

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

async function checkCount() {
    console.log('Checking student count with keywords in Firestore...');
    const coll = collection(db, 'students');
    const q = query(coll, where('searchKeywords', '!=', null));
    const snapshot = await getCountFromServer(q);
    console.log('Students with keywords:', snapshot.data().count);
    process.exit(0);
}

checkCount().catch(err => {
    console.error('Error checking count:', err);
    process.exit(1);
});
