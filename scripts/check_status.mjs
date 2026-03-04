import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getCountFromServer, limit, getDocs } from 'firebase/firestore';

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

async function check() {
    try {
        const studentsCol = collection(db, 'students');

        // Count total
        const totalCount = (await getCountFromServer(studentsCol)).data().count;
        console.log(`Total students in Firestore: ${totalCount}`);

        // Count with keywords
        const keywordsQuery = query(studentsCol, where('searchKeywords', '!=', null));
        const keywordsCount = (await getCountFromServer(keywordsQuery)).data().count;
        console.log(`Students with searchKeywords: ${keywordsCount}`);

        if (totalCount > keywordsCount) {
            console.log(`Remaining: ${totalCount - keywordsCount}`);

            // Get one example without keywords to find starting point
            const sampleQuery = query(studentsCol, limit(10)); // Can't easily filter for "field does not exist" in v9 without index
            const sampleSnap = await getDocs(sampleQuery);
            console.log("\nSample check (first 10):");
            sampleSnap.forEach(doc => {
                console.log(`${doc.id}: ${doc.data().searchKeywords ? '✅ Has Keywords' : '❌ Missing Keywords'}`);
            });
        } else {
            console.log("All students have searchKeywords!");
        }

    } catch (err) {
        console.error('Error during status check:', err);
    }
    process.exit(0);
}

check();
