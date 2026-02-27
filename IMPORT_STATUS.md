# Student Import Progress

> Last updated: 2026-02-26 · Clear & Reseed run in progress

## Status
| Item | Count |
|---|---|
| 📄 Total students in CSV (`students_data.csv`) | **33,138** |
| ✅ Unique students in Firebase | **33,137** |
| 🏁 Status | **Completed** |

## Why It Paused

Firebase **Spark (free) plan** has a **20,000 document writes/day** cap.
Today's quota was reached at 20,000 records. The quota resets at **midnight UTC** each day.

> The 20,000 records already in Firebase are **fully clean** — no duplicates.
> Every document ID = student email address (e.g. `20123456@upsamail.edu.gh`).

## How to Continue (run after midnight UTC)

```powershell
node scripts/clearAndReseed.mjs
```

> **Safe to re-run at any time.**
> - The delete phase clears whatever old data remains
> - The import uses `setDoc` with email as document ID — **never creates duplicates**
> - Auto-retries when quota is hit

## Key Files

| File | Purpose |
|---|---|
| `students_data.csv` | Source data — 33,138 students |
| `scripts/clearAndReseed.mjs` | **Main script** — clear all + reimport (no duplicates) |
| `scripts/importStudents.mjs` | Import-only script (no clear) |
| `utils/dataImport.ts` | Browser import utility |
| `firestore.rules` | Allows public read/write on `students` collection |

## Firebase Project

- **Project ID:** `klok-2a75e`
- **Console:** https://console.firebase.google.com/project/klok-2a75e/firestore
- **Upgrade to Blaze** (skip daily limit): https://console.firebase.google.com/project/klok-2a75e/usage/details
