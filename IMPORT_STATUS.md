# Student Import Progress

> Last updated: 2026-02-25 · Verified against live Firestore count

## Status

| Item | Count |
|---|---|
| 📄 Total students in CSV (`students_data.csv`) | **33,138** |
| ✅ Already in Firebase (verified live) | **19,631** |
| ⏳ Still to import | **13,507** |
| 📦 Batches remaining (200/batch) | **~68 batches** |

## Why It Stopped

Firebase **Spark (free) plan** has a **20,000 document writes/day** cap.  
Today's quota (~20,000) was reached at ~19,631 records.  
The quota resets at **midnight UTC** each day.

## How to Continue (for AI or human)

### Step 1 — Check current count in Firebase
```powershell
node -e "
import('firebase/app').then(({initializeApp}) => {
  import('firebase/firestore').then(({getFirestore, getCountFromServer, collection}) => {
    const app = initializeApp({apiKey:'AIzaSyC3NjNBNmXISEGZlITOA_b49W7N2blYybE',projectId:'klok-2a75e'});
    const db = getFirestore(app);
    getCountFromServer(collection(db,'students')).then(snap => {
      console.log('Students in Firebase: ' + snap.data().count + ' / 33,138');
      process.exit(0);
    });
  });
});
"
```

### Step 2 — Run the import script
```powershell
node scripts/importStudents.mjs
```

The script is **fully safe to re-run**:
- Uses **email address as the Firestore document ID**
- Uses `setDoc` (idempotent) — already-imported students are updated in-place, **never duplicated**
- Processes 200 students per batch with 1.5s delays to respect rate limits
- Automatically retries once if quota is hit mid-run (waits 60 seconds)

### Step 3 — Update this file after completion
Replace the table above with final counts once all 33,138 students are imported.

## Key Files

| File | Purpose |
|---|---|
| `students_data.csv` | Source data — 33,138 students |
| `scripts/importStudents.mjs` | Import script — run with `node scripts/importStudents.mjs` |
| `utils/dataImport.ts` | Browser import utility (also duplicate-safe) |
| `firestore.rules` | Allows public read/write on `students` collection |

## Firebase Project

- **Project ID:** `klok-2a75e`
- **Console:** https://console.firebase.google.com/project/klok-2a75e/firestore
- **Upgrade to Blaze** (skip daily limit): https://console.firebase.google.com/project/klok-2a75e/usage/details
