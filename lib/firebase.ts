import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC3NjNBNmXISEGZlITOA_b49W7N2blYybE",
  authDomain: "klok-2a75e.firebaseapp.com",
  projectId: "klok-2a75e",
  storageBucket: "klok-2a75e.firebasestorage.app",
  messagingSenderId: "1056407177150",
  appId: "1:1056407177150:web:7bfaf5e283b9d9c721dbef",
  measurementId: "G-R27KZ5HC36",
};

const app = initializeApp(firebaseConfig);

// Enable IndexedDB offline persistence — after first load, searches work offline too
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({ forceOwnership: true }),
  }),
});

const auth = getAuth(app);

export { app, db, auth };
export default app;
