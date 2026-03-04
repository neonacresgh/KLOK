'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Student } from '@/types/student';
import CascadingHostelRoomSelector, { Roommate } from '@/components/CascadingHostelRoomSelector';

// ─── IndexedDB offline cache ──────────────────────────────────────────────────
const IDB_NAME = 'klok-cache';
const IDB_STORE = 'searches';
const IDB_VERSION = 1;

function openCache(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function getCached(key: string): Promise<Student[] | null> {
  try {
    const db = await openCache();
    return new Promise((res) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function putCached(key: string, value: Student[]): Promise<void> {
  try {
    const db = await openCache();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch { /* non-fatal */ }
}

// Deduplicate by emailAddress — same index = same person
function dedup(arr: Student[]): Student[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    const key = (s.emailAddress || s.id || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPhotoUrl = (email: string) =>
  `https://upsasip.com/images/students/contStudents/${email?.split('@')[0]}.jpg`;

const clean = (s?: string) => (s ?? '').replace(/^"+|"+$/g, '').trim() || '—';

const buildDate = (dob: string, role: string) =>
  dob?.startsWith('"') && role?.endsWith('"')
    ? clean(`${dob}, ${role}`)
    : clean(dob);

const buildRole = (role: string, emailStatus?: string) => {
  if (!role) return '—';
  const c = clean(role);
  if (/^\d{4}$/.test(c)) return clean(emailStatus) || 'Student';
  return c;
};

const isNumericOnly = (v: string) => /^\d+$/.test(v.trim());

// ─── Date formatters for UPSA portals ─────────────────────────────────────────
// Parses our stored "February 11, 2003" → a JS Date
const parseStoredDate = (raw: string): Date | null => {
  if (!raw || raw === '—') return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// Student portal: DD-MM-YYYY  e.g. 11-02-2003
const toStudentPortalDOB = (raw: string): string => {
  const d = parseStoredDate(raw);
  if (!d) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// UFIS fees portal: YYYY-MMM-DD with 3-letter month  e.g. 1999-MAR-18
const MONTHS_3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const toUfisDOB = (raw: string): string => {
  const d = parseStoredDate(raw);
  if (!d) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS_3[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${yyyy}-${mmm}-${dd}`;
};

// ─── Auto-login launchers ─────────────────────────────────────────────────────
// Student Portal: real auto-submit via hidden POST form opened in new tab
const launchStudentPortal = (indexNum: string, dob: string) => {
  const w = window.open('about:blank', '_blank');
  if (!w) {
    // Popup blocked — fallback: copy + open
    navigator.clipboard.writeText(`${indexNum}\n${dob}`).catch(() => { });
    window.open('https://upsasip.com/student-portal', '_blank', 'noopener');
    return;
  }
  w.document.write(`<!DOCTYPE html>
<html>
<head><title>Logging in to UPSA Student Portal...</title>
<style>body{background:#f9fafb;color:#111827;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}
.spinner{width:36px;height:36px;border:3px solid rgba(0,0,0,.1);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="spinner"></div><p style="color:#6b7280;font-size:14px">Logging in to Student Portal…</p>
<form id="f" method="POST" action="https://upsasip.com/home/processStudentLogin/">
<input type="hidden" name="index_num" value="${indexNum}">
<input type="hidden" name="stud_pswrd" value="${dob}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`);
  w.document.close();
};

// UFIS: SPA — can't auto-submit; copy credentials + open portal
const launchUfisPortal = (indexNum: string, dob: string, onCopied: () => void) => {
  const text = `${indexNum}\n${dob}`;
  navigator.clipboard.writeText(text).then(onCopied).catch(() => { });
  window.open('https://student.upsa-ufis.com/#/auth/login', '_blank', 'noopener');
};

// Hostel: Auto-login via Next.js Proxy to bypass CSRF & Same-Origin restrictions
const launchHostelPortal = async (indexNum: string, dob: string, onStart: () => void, onEnd: () => void) => {
  onStart();
  try {
    // We send a POST request to our own backend proxy.
    // The proxy dynamically fetches the CSRF token and submits the login to upsahostels.com.
    // It returns an HTML form that sets the authenticated session cookie and redirects.
    const res = await fetch('/api/upsa-hostel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indexNum, password: dob })
    });

    if (!res.ok) {
      alert('Hostel login failed. Invalid credentials or portal down.');
      return;
    }

    const html = await res.text();

    // Open a new window and render the proxy's session-forwarding HTML
    const w = window.open('about:blank', '_blank');
    if (!w) {
      alert('Popup blocker prevented opening the Hostel portal.');
      return;
    }
    w.document.write(html);
    w.document.close();
  } catch (error) {
    console.error('Hostel proxy error:', error);
    alert('An unexpected error occurred connecting to the Hostel portal.');
  } finally {
    onEnd();
  }
};

function UfisButton({ indexNum, dob }: { indexNum: string; dob: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => launchUfisPortal(indexNum, dob, () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3500);
      })}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-gray-900 text-xs font-bold">Fees Portal (UFIS)</p>
        <p className={`text-[10px] mt-0.5 ${copied ? 'text-emerald-600 font-semibold' : 'text-gray-500'}`}>
          {copied ? '✓ Copied ID & Password!' : `Copy credentials & Open`}
        </p>
      </div>
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </button>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ student, large, onClick }: { student: Student; large?: boolean; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const initials = (student.surname?.[0] ?? '') + (student.otherNames?.[0] ?? '');
  return (
    <div
      onClick={!failed ? onClick : undefined}
      className={[
        'relative overflow-hidden flex-shrink-0 bg-gray-300 flex items-center justify-center font-bold text-gray-700 select-none',
        large ? 'w-20 h-20 sm:w-24 sm:h-24 text-2xl rounded-xl' : 'w-10 h-10 text-sm rounded-lg',
        onClick && !failed ? 'cursor-pointer hover:brightness-110 transition-all active:scale-95' : '',
      ].join(' ')}
    >
      {!failed
        ? <img src={getPhotoUrl(student.emailAddress)} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : <span>{initials}</span>
      }
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 sm:p-12"
      onClick={onClose}
      style={{ animation: 'fadeInLightbox 0.2s ease-out' }}
    >
      <div className="relative max-w-3xl w-full max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-14 right-0 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center transition-all group active:scale-90"
        >
          <svg className="w-6 h-6 text-white group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={url}
          alt="Student photo"
          className="max-w-full max-h-[80vh] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain border border-white/20"
          style={{ animation: 'scaleInLightbox 0.3s cubic-bezier(0.2, 1, 0.3, 1)' }}
        />
      </div>
    </div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }); }}
      className="ml-1.5 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
    >
      {ok
        ? <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      }
    </button>
  );
}

// ─── Detail Cell ──────────────────────────────────────────────────────────────
function Cell({ label, value }: { label: string; value: string }) {
  const display = value?.trim() || '—';
  return (
    <div className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">{label}</p>
        <p className="text-gray-900 text-sm font-semibold mt-0.5 break-words">{display}</p>
      </div>
      {display !== '—' && <Copy text={display} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Room ranges logic removed in favor of PremiumRoomSelector

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Pagination state for infinite scroll
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  // Track current query for pagination
  const currentQueryRef = useRef('');
  const isLoadingMoreRef = useRef(false);

  // Transcript states
  const [transcriptHtml, setTranscriptHtml] = useState<string | null>(null);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Reset state
  const [isResetting, setIsResetting] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  // Hostel Section state
  const [showHostelSection, setShowHostelSection] = useState(false);
  const [isLoggingInHostel, setIsLoggingInHostel] = useState(false);
  const [isHostelLoggedIn, setIsHostelLoggedIn] = useState(false);
  const [hostelSearchQuery, setHostelSearchQuery] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regResults, setRegResults] = useState<any[]>([]);
  const [isSearchingHostel, setIsSearchingHostel] = useState(false);
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [extraHostelInfo, setExtraHostelInfo] = useState<any>(null);
  const [loadingExtraInfo, setLoadingExtraInfo] = useState(false);
  const [roommateLightbox, setRoommateLightbox] = useState<Roommate | null>(null);

  // View Roommates for student search results
  const [selectedStudentRoom, setSelectedStudentRoom] = useState<{ roomId: string, studentName: string } | null>(null);
  const [showRoommatesForStudent, setShowRoommatesForStudent] = useState(false);

  // Tab switcher state
  const [activeTab, setActiveTab] = useState<'main' | 'hostel'>('main');

  // Room options logic removed as it's now handled by the component

  useEffect(() => {
    if (!showHostelSection) return;

    const autoLogin = async () => {
      setIsLoggingInHostel(true);
      try {
        const res = await fetch('/api/hostel-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
          const data = await res.json();
          setIsHostelLoggedIn(true);
          console.log('Hostel auto-login:', data.cached ? 'Using cached session' : 'New login successful');
        } else {
          console.error('Hostel auto-login failed');
          setIsHostelLoggedIn(false);
        }
      } catch (err) {
        console.error('Hostel auto-login error:', err);
        setIsHostelLoggedIn(false);
      } finally {
        setIsLoggingInHostel(false);
      }
    };

    autoLogin();
  }, [showHostelSection]);

  // Track online / offline status
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Escape key closes roommate lightbox
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setRoommateLightbox(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<any>(null);
  // Prevents search from re-opening the dropdown after the user picks a student
  const pickedRef = useRef(false);

  const getDb = useCallback(async () => {
    if (!dbRef.current) {
      const { db } = await import('@/lib/firebase');
      dbRef.current = db;
    }
    return dbRef.current;
  }, []);

  // ── Input handler ──────────────────────────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setQuery(upper);
    // Only clear the card if user fully erases the query
    if (upper.trim().length < 1) setSelected(null);
    setExpanded(false);
  };

  // ── Search: cache-first (instant) + Firebase refresh ────────────────────
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }

    // If the user just picked a student, skip this search cycle entirely
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }

    const isNum = isNumericOnly(trimmed);

    // 1️⃣ Show cached results instantly (0ms) so the list appears immediately
    getCached(trimmed).then(cached => {
      if (cached && cached.length > 0 && !pickedRef.current) {
        setSuggestions(cached);
        setShowDrop(true);
      }
    });

    // 2️⃣ Fetch fresh from Firebase and update (debounced)
    const timer = setTimeout(async () => {
      if (pickedRef.current) return; // guard again after delay
      setLoading(true);
      try {
        const { collection, query: fsq, where, orderBy, limit, getDocs, doc, getDoc } =
          await import('firebase/firestore');
        const db = await getDb();
        let results: Student[] = [];

        if (isNum) {
          const snap = await getDoc(doc(db, 'students', `${trimmed}@upsamail.edu.gh`));
          if (snap.exists()) {
            results = [{ id: snap.id, ...snap.data() } as Student];
          } else if (trimmed.length < 8) {
            const rs = await getDocs(fsq(collection(db, 'students'), where('emailAddress', '>=', trimmed), where('emailAddress', '<=', trimmed + '\uf8ff'), limit(6)));
            results = rs.docs.map(d => ({ id: d.id, ...d.data() } as Student));
          }
        } else {
          const words = trimmed.split(/\s+/).filter(Boolean);
          const firstWord = words[0];
          const firstWordUpper = firstWord.toUpperCase();
          const firstWordLower = firstWord.toLowerCase();

          // 🌟 The Brilliant Fix: 3-Way Parallel Search
          // This gives instant "as-you-type" feedback without waiting for full words.

          // 1. Prefix search on Surname (Super fast, instant feedback for surnames)
          const q1 = getDocs(fsq(
            collection(db, 'students'),
            where('surname', '>=', firstWordUpper),
            where('surname', '<=', firstWordUpper + '\uf8ff'),
            limit(10)
          )).catch(() => ({ docs: [] }));

          // 2. Prefix search on First Name (Instant feedback for first names)
          const q2 = getDocs(fsq(
            collection(db, 'students'),
            where('otherNames', '>=', firstWordUpper),
            where('otherNames', '<=', firstWordUpper + '\uf8ff'),
            limit(10)
          )).catch(() => ({ docs: [] }));

          // 3. Keyword exact match (Catches middle names and full word matches)
          const q3 = getDocs(fsq(
            collection(db, 'students'),
            where('searchKeywords', 'array-contains', firstWordLower),
            limit(10)
          )).catch(() => ({ docs: [] }));

          // Run them all at the exact same time
          const [rs1, rs2, rs3] = await Promise.all([q1, q2, q3]);

          // Merge results and remove duplicates
          const map = new Map<string, Student>();
          rs1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));
          rs2.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));
          rs3.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));

          results = Array.from(map.values());

          // If multiple words typed, refine locally for exact multi-word match
          if (words.length > 1) {
            const lowerWords = words.map(w => w.toLowerCase());
            results = results.filter(s => {
              const full = `${s.surname} ${s.otherNames}`.toLowerCase();
              return lowerWords.every(w => full.includes(w));
            });
          }
        }

        if (pickedRef.current) return; // student was picked while we were fetching
        const unique = dedup(results);
        await putCached(trimmed, unique);
        setSuggestions(unique);
        setShowDrop(unique.length > 0);

        // Reset load more state on a new search
        setHasMore(unique.length >= 10);
        setLoadingMore(false);
        isLoadingMoreRef.current = false;
      } catch {
        // Offline — cache already shown above; nothing more to do
      } finally {
        setLoading(false);
      }
    }, isNum ? 50 : 80);

    return () => clearTimeout(timer);
  }, [query, getDb]);

  // ── Load more results for infinite scroll ───────────────────────────────────
  const loadMoreResults = useCallback(async (newLimit: number) => {
    const trimmed = query.trim();
    if (trimmed.length < 1) return;

    // This check is now here to prevent redundant triggers
    if (isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;
    setLoadingMore(true);

    const isNum = isNumericOnly(trimmed);

    try {
      const { collection, query: fsq, where, orderBy, limit, getDocs, doc, getDoc } =
        await import('firebase/firestore');
      const db = await getDb();
      let results: Student[] = [];

      if (isNum) {
        // For numeric queries, just fetch up to the new limit
        const snap = await getDoc(doc(db, 'students', `${trimmed}@upsamail.edu.gh`));
        if (snap.exists()) {
          results = [{ id: snap.id, ...snap.data() } as Student];
        } else if (trimmed.length < 8) {
          const rs = await getDocs(fsq(collection(db, 'students'), where('emailAddress', '>=', trimmed), where('emailAddress', '<=', trimmed + '\uf8ff'), limit(newLimit)));
          results = rs.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        }
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        const firstWord = words[0];
        const firstWordUpper = firstWord.toUpperCase();
        const firstWordLower = firstWord.toLowerCase();

        // Fetch with increased limit from all three sources
        const q1 = getDocs(fsq(
          collection(db, 'students'),
          where('surname', '>=', firstWordUpper),
          where('surname', '<=', firstWordUpper + '\uf8ff'),
          limit(newLimit)
        )).catch(() => ({ docs: [] }));

        const q2 = getDocs(fsq(
          collection(db, 'students'),
          where('otherNames', '>=', firstWordUpper),
          where('otherNames', '<=', firstWordUpper + '\uf8ff'),
          limit(newLimit)
        )).catch(() => ({ docs: [] }));

        const q3 = getDocs(fsq(
          collection(db, 'students'),
          where('searchKeywords', 'array-contains', firstWordLower),
          limit(newLimit)
        )).catch(() => ({ docs: [] }));

        const [rs1, rs2, rs3] = await Promise.all([q1, q2, q3]);

        const map = new Map<string, Student>();
        rs1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));
        rs2.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));
        rs3.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Student));

        results = Array.from(map.values());

        if (words.length > 1) {
          const lowerWords = words.map(w => w.toLowerCase());
          results = results.filter(s => {
            const full = `${s.surname} ${s.otherNames}`.toLowerCase();
            return lowerWords.every(w => full.includes(w));
          });
        }
      }

      const unique = dedup(results);
      setSuggestions(unique);
      setHasMore(unique.length >= newLimit && newLimit < 50);
      await putCached(trimmed, unique);
    } catch {
      // Ignore errors during load more
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [query, getDb]);

  // ── Dismiss: BACKDROP approach (no global listener issues on mobile) ────────
  // Dropdown backdrop — only closes the dropdown
  // Card backdrop — only shows when card is expanded; clicking it collapses card
  const closeDrop = useCallback(() => {
    setShowDrop(false);
  }, []);

  const dismissCard = useCallback(() => {
    setSelected(null);
    setExpanded(false);
    setQuery('');
    setSuggestions([]);
  }, []);

  const pick = (s: Student) => {
    pickedRef.current = true; // suppress the next search cycle
    setLastQuery(query); // Save original query to go back
    setQuery(`${s.surname} ${s.otherNames}`);
    setSelected(s);
    setShowDrop(false);
    // suggestions remain in state
    setExpanded(false);
    setHasMore(true);
    inputRef.current?.blur(); // dismiss keyboard on mobile
  };

  // ── Fetch Extra Hostel Info ──
  useEffect(() => {
    if (!selected || isOffline) {
      setExtraHostelInfo(null);
      return;
    }

    const fetchExtraInfo = async () => {
      setLoadingExtraInfo(true);
      setExtraHostelInfo(null);
      const indexNum = selected.emailAddress.split('@')[0];

      try {
        // Step 1: Search student in hostel portal to get roomId
        const searchRes = await fetch('/api/hostel-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: indexNum })
        });
        const searchData = await searchRes.json();
        const student = searchData.results?.find((s: any) => s.studentId === indexNum);

        if (student && student.roomId) {
          // Step 2: Fetch roommates to get detailed info (Tel, Level, Hall)
          const roommatesRes = await fetch('/api/hostel-roommates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: student.roomId })
          });
          const roommatesData = await roommatesRes.json();
          const detail = roommatesData.roommates?.find((m: any) => m.index_num === indexNum);

          if (detail) {
            setExtraHostelInfo({
              ...student,
              ...detail,
              // Merge if titles differ
              phone: detail.phone,
              hall: detail.hall,
              level: detail.level
            });
          } else {
            setExtraHostelInfo(student);
          }
        }
      } catch (err) {
        console.error('Failed to fetch extra hostel info:', err);
      } finally {
        setLoadingExtraInfo(false);
      }
    };

    fetchExtraInfo();
  }, [selected, isOffline]);

  const fetchTranscript = async () => {
    if (!selected || isOffline) return;
    setIsFetchingTranscript(true);
    setTranscriptError(null);
    try {
      const indexNum = selected.emailAddress.split('@')[0];
      const dob = buildDate(selected.dateOfBirth, selected.roleRank);
      const formattedDob = toStudentPortalDOB(dob);

      // ── Atomic Fetch: Reset (if needed) + Warmup + Login + Fetch in one go ──
      const res = await fetch('/api/upsa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexNum, password: formattedDob, bypass: true })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch transcript');
      }

      const html = await res.text();
      setTranscriptHtml(html);
    } catch (err: any) {
      setTranscriptError(err.message);
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const performHostelSearch = async (q: string, h: string, r: string, s: string) => {
    if (!q.trim() && !h.trim() && !r.trim() && !s.trim()) {
      setRegResults([]);
      return;
    }
    setIsSearchingHostel(true);
    try {
      let finalQuery = q.trim();

      // --- Smart Name Resolution ---
      // If the query is a name (non-numeric), try to find the index number locally first
      const isNumeric = /^\d+$/.test(finalQuery);
      if (finalQuery.length > 2 && !isNumeric) {
        try {
          const { collection, query: fsq, where, limit, getDocs } = await import('firebase/firestore');
          const db = await getDb();
          const words = finalQuery.split(/\s+/).filter(Boolean);
          const firstWord = words[0].toUpperCase();

          // Try to find the student in our robust local database
          const qry = fsq(collection(db, 'students'),
            where('surname', '>=', firstWord),
            where('surname', '<=', firstWord + '\uf8ff'),
            limit(5));
          const snap = await getDocs(qry);
          const localResults = snap.docs.map(d => d.data() as Student);

          // If we find a student whose name matches what the user typed
          const match = localResults.find(student => {
            const fullName = `${student.surname} ${student.otherNames}`.toLowerCase();
            const searchLower = finalQuery.toLowerCase();
            return fullName.includes(searchLower) || searchLower.includes(student.surname.toLowerCase());
          });

          if (match && match.emailAddress) {
            const foundIndex = match.emailAddress.split('@')[0];
            console.log(`Smart Resolution: Resolved "${finalQuery}" to Index ${foundIndex}`);
            finalQuery = foundIndex; // Switch to the reliable index number!
          }
        } catch (err) {
          console.warn('Smart Name Resolution skipped due to error:', err);
        }
      }

      const res = await fetch('/api/hostel-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          hostelName: h,
          roomName: r,
          status: s
        })
      });
      const data = await res.json();
      if (data.results) setRegResults(data.results);
    } catch (e) {
      console.error('Hostel Search Error:', e);
    } finally {
      setIsSearchingHostel(false);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      performHostelSearch(hostelSearchQuery, hostelFilter, roomFilter, statusFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [hostelSearchQuery, hostelFilter, roomFilter, statusFilter]);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 pt-10 sm:pt-20 pb-10 overflow-x-hidden">

      {/* ── Logo ── */}
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 mb-4 select-none">
        KLOK
      </h1>

      {/* ── Tab Switcher ── */}
      <div className="w-full max-w-xl mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-1.5 flex gap-1 shadow-sm">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${activeTab === 'main'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Main
          </button>
          <button
            onClick={() => {
              setActiveTab('hostel');
              // Auto-expand hostel section when switching to hostel tab
              if (!showHostelSection) setShowHostelSection(true);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${activeTab === 'hostel'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Hostel
          </button>
        </div>
      </div>

      {/* ── Hostel Portal Section ── */}
      {activeTab === 'hostel' && (
        <div className="w-full max-w-xl pb-10 flex flex-col gap-5">


          {/* ── Room Selector Section ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Browse by Room
            </p>

            <CascadingHostelRoomSelector
              hostelValue={hostelFilter}
              roomValue={roomFilter}
              onHostelChange={setHostelFilter}
              onRoomChange={(room) => {
                setRoomFilter(room);
                if (!room) setRoommates([]);
              }}
              onRoommatesLoaded={setRoommates}
            />
          </div>

          {/* ── Roommates Display ── */}
          {roommates.length > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Room Members · {roommates.length}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {roommates.map((mate, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl flex items-center gap-3 p-3 shadow-sm group hover:border-blue-200 transition-all">
                    <button
                      type="button"
                      onClick={() => setRoommateLightbox(mate)}
                      className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100 cursor-pointer hover:scale-105 transition-all active:scale-95"
                    >
                      {mate.imageUrl ? (
                        <div className="relative w-full h-full">
                          <img
                            src={mate.imageUrl}
                            alt={mate.full_name}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="hidden absolute inset-0 w-full h-full items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                            <span className="text-xl font-black text-blue-600">{mate.full_name.charAt(0)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                          <span className="text-xl font-black text-blue-600">{mate.full_name.charAt(0)}</span>
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 leading-tight truncate">{mate.full_name}</p>
                      <p className="text-[11px] font-semibold text-blue-600 mt-0.5">{mate.index_num || '—'}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {mate.phone && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                            {mate.phone}
                          </span>
                        )}
                        {mate.bed && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium whitespace-nowrap">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>
                            Bed {mate.bed}
                          </span>
                        )}
                        {mate.level && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium whitespace-nowrap">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                            Lvl {mate.level}
                          </span>
                        )}
                        {mate.hall && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium whitespace-nowrap truncate max-w-[120px]">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-3h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                            {mate.hall}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setRoommateLightbox(mate)}
                      className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Quick Actions ── */}
          <div className="mt-2 text-center items-center flex justify-center">
            <button
              onClick={() => window.open('https://upsahostels.com/index.php?r=hostel%2Frooms%2Froomsview', '_blank', 'noopener')}
              className="group flex items-center justify-between w-full px-5 py-4 rounded-3xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all active:scale-[0.98] shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-gray-900 uppercase tracking-tight">Hostel Portal</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Instant Access</p>
                </div>
              </div>

              {/* Status Dot */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
                <div className={`w-2 h-2 rounded-full ${isLoggingInHostel ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]' : isHostelLoggedIn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-300'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {isLoggingInHostel ? 'Connecting' : isHostelLoggedIn ? 'Connected' : 'Offline'}
                </span>
              </div>
            </button>
          </div>

          {/* ── Roommate Photo Lightbox ── */}
          {roommateLightbox && (
            <div
              className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 sm:p-12"
              onClick={() => setRoommateLightbox(null)}
              style={{ animation: 'fadeInLightbox 0.25s ease-out' }}
            >
              <div
                className="relative max-w-3xl w-full max-h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setRoommateLightbox(null)}
                  className="absolute -top-14 right-0 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center transition-all group active:scale-90"
                >
                  <svg className="w-6 h-6 text-white group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {roommateLightbox.imageUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={roommateLightbox.imageUrl}
                      alt={roommateLightbox.full_name}
                      className="max-w-full max-h-[80vh] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain border border-white/20"
                      style={{ animation: 'scaleInLightbox 0.3s cubic-bezier(0.2, 1, 0.3, 1)' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const f = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (f) f.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 w-full h-full items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl">
                      <span className="text-9xl font-black text-white">{roommateLightbox.full_name.charAt(0)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl shadow-2xl">
                    <span className="text-9xl font-black text-white">{roommateLightbox.full_name.charAt(0)}</span>
                  </div>
                )}
              </div>
              <style jsx>{`
                @keyframes fadeInLightbox {
                  from { opacity: 0; }
                  to   { opacity: 1; }
                }
                @keyframes scaleInLightbox {
                  from { opacity: 0; transform: scale(0.95); }
                  to   { opacity: 1; transform: scale(1); }
                }
              `}</style>
            </div>
          )}
        </div>
      )}

      {/* ── Offline banner ── */}
      {isOffline && (
        <div className="w-full max-w-xl mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-4 py-2 rounded-xl">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          Offline — showing cached results
        </div>
      )}

      {/* ── Main Search area ── */}
      {activeTab === 'main' && (
        <div className="w-full max-w-xl min-w-0 relative z-30">

          {/* Dropdown backdrop — transparent, sits behind dropdown but above page */}
          {showDrop && (
            <div
              className="fixed inset-0 z-20"
              onClick={closeDrop}
              aria-hidden
            />
          )}

          <div className="relative z-30 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInput}
              onFocus={() => {
                if (suggestions.length > 0 && query.trim().length >= 1) setShowDrop(true);
              }}
              placeholder="Search by name or index number…"
              autoComplete="off"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400
                       text-base sm:text-base font-semibold uppercase tracking-wide
                       px-5 pr-12 py-3.5 rounded-xl outline-none shadow-sm
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       transition-all duration-150"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin pointer-events-none" />
              ) : query.length > 0 ? (
                <button
                  onClick={() => { setQuery(''); setSelected(null); setShowDrop(false); setSuggestions([]); inputRef.current?.focus(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 active:scale-95 transition-all"
                  aria-label="Clear"
                >
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <svg className="w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              )}
            </div>

            {/* Dropdown — rendered above backdrop (z-30 > z-20) */}
            {showDrop && suggestions.length > 0 && (
              <div
                ref={dropRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const scrollPercent = (target.scrollTop + target.clientHeight) / target.scrollHeight;
                  if (scrollPercent > 0.85 && hasMore && !loadingMore) {
                    // Trigger load more by increasing effective limit
                    const newLimit = Math.min(suggestions.length + PAGE_SIZE, 50);
                    loadMoreResults(newLimit);
                  }
                }}
                className="absolute inset-x-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto overscroll-contain"
                style={{ zIndex: 40 }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => pick(s)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 text-left min-w-0',
                      'hover:bg-gray-50 active:bg-gray-100 transition-colors',
                      i > 0 ? 'border-t border-gray-100' : '',
                    ].join(' ')}
                  >
                    <div className="shrink-0">
                      <Avatar student={s} />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-gray-900 text-sm font-semibold truncate leading-tight">{s.surname} {s.otherNames}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{s.emailAddress}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-semibold ml-1">
                      {buildRole(s.roleRank, s.emailStatus)}
                    </span>
                  </button>
                ))}
                {/* Load more button - shows when hasMore and not currently loading */}
                {hasMore && !loadingMore && suggestions.length >= 10 && (
                  <button
                    onClick={() => {
                      const newLimit = Math.min(suggestions.length + PAGE_SIZE, 50);
                      loadMoreResults(newLimit);
                    }}
                    className="w-full py-3 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100 transition-colors"
                  >
                    Load more results
                  </button>
                )}

                {loadingMore && (
                  <div className="flex items-center justify-center py-4 border-t border-gray-100">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-gray-500">Loading more...</span>
                  </div>
                )}

                {/* End of results message */}
                {!hasMore && suggestions.length > 0 && (
                  <div className="py-3 text-center text-xs text-gray-400 border-t border-gray-100">
                    No more results
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Student Card ── */}
      {selected && (
        <>
          {/* Card backdrop — only dismisses the card, not the search */}
          <div
            className="fixed inset-0 z-10"
            onClick={dismissCard}
            aria-hidden
          />

          <div ref={cardRef} className="relative z-20 w-full max-w-xl mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">

            {/* Header */}
            <div className="flex gap-4 p-4 sm:p-5">
              <Avatar
                student={selected}
                large
                onClick={() => setLightbox(getPhotoUrl(selected.emailAddress))}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h2 className="text-gray-900 font-bold text-base sm:text-lg leading-tight break-words pr-2">
                    {selected.surname} {selected.otherNames}
                  </h2>
                  {suggestions.length > 1 && (
                    <button
                      onClick={() => {
                        setSelected(null);
                        setQuery(lastQuery);
                        setShowDrop(true);
                        // Focus the input to allow quick refinement
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all active:scale-95 border border-blue-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wide">Back</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center mt-1">
                  <span className="text-gray-500 text-xs sm:text-sm truncate">{selected.emailAddress}</span>
                  <Copy text={selected.emailAddress} />
                </div>
                <span className="inline-block mt-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold">
                  {buildRole(selected.roleRank, selected.emailStatus)}
                </span>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 border-t border-gray-200
                         text-gray-400 text-[10px] font-bold uppercase tracking-widest
                         hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {expanded ? 'Hide details' : 'Show details'}
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Expanded details */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-4 grid grid-cols-2 gap-2.5 border-t border-gray-200">
                <Cell label="Index Number" value={selected.emailAddress?.split('@')[0]} />
                <Cell label="Gender" value={selected.gender} />
                <Cell label="Date of Birth" value={buildDate(selected.dateOfBirth, selected.roleRank)} />
                <Cell label="Program" value={selected.program || '—'} />
                <Cell label="Email Status" value={clean(selected.emailStatus)} />

                {/* ── Additional Hostel Info ── */}
                {loadingExtraInfo ? (
                  <div className="col-span-2 bg-blue-50/50 rounded-xl px-4 py-3 border border-blue-100/50 animate-pulse flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Searching hostel portal...</p>
                  </div>
                ) : extraHostelInfo ? (
                  <>
                    <Cell label="Hostel / Hall" value={extraHostelInfo.hall || extraHostelInfo.hostel} />
                    <Cell label="Room & Bed" value={extraHostelInfo.room ? `Rm ${extraHostelInfo.room} · Bed ${extraHostelInfo.bed}` : '—'} />
                    <Cell label="Phone Number" value={extraHostelInfo.phone} />
                    <Cell label="Academic Level" value={extraHostelInfo.level ? `Lvl ${extraHostelInfo.level}` : '—'} />
                  </>
                ) : null}
              </div>

              {/* ── Portal shortcuts ── */}
              <div className="px-4 pb-5 flex flex-col gap-2">
                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest pt-2 pb-1">Quick Login</p>

                <button
                  onClick={async () => {
                    const idx = selected.emailAddress?.split('@')[0];
                    if (!idx) return;
                    setIsResetting(true);
                    try {
                      await fetch('/api/upsa-reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ indexNum: idx })
                      });
                    } catch (e) {
                      console.error('Reset failed', e);
                    } finally {
                      setIsResetting(false);
                    }
                    launchStudentPortal(idx, toStudentPortalDOB(buildDate(selected.dateOfBirth, selected.roleRank)));
                  }}
                  disabled={isResetting || isOffline}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] bg-amber-50 border-amber-200 hover:bg-amber-100 mb-1"
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    {isResetting ? (
                      <div className="w-4 h-4 border-2 border-amber-600 border-r-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 text-xs font-bold">Bypass Password & Login</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Securely access the portal without password
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => launchStudentPortal(
                    selected.emailAddress?.split('@')[0] || '',
                    toStudentPortalDOB(buildDate(selected.dateOfBirth, selected.roleRank))
                  )}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] bg-blue-50 border-blue-200 hover:bg-blue-100"
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7v-6m0 0l6.16-3.422" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 text-xs font-bold">Student Portal</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Auto-login as {selected.emailAddress?.split('@')[0]}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>

                <UfisButton
                  indexNum={`UPSA - ${selected.emailAddress?.split('@')[0]} `}
                  dob={toUfisDOB(buildDate(selected.dateOfBirth, selected.roleRank))}
                />


                <button
                  onClick={fetchTranscript}
                  disabled={isFetchingTranscript || isOffline}
                  className="w-full bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl p-3 flex items-center gap-3 transition-colors text-left active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-3"
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                    {isFetchingTranscript ? (
                      <div className="w-4 h-4 border-2 border-purple-600 border-r-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-xs font-bold">Fetch Transcript</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      {isOffline ? 'Unavailable offline' : (transcriptError || 'Pull directly from portal')}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transcript Modal */}
      {transcriptHtml && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Transcript</h2>
              <p className="text-xs text-gray-500">{selected?.surname} {selected?.otherNames}</p>
            </div>
            <button
              onClick={() => setTranscriptHtml(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 bg-gray-50 overflow-auto">
            <iframe
              title="Transcript"
              srcDoc={transcriptHtml}
              className="w-full h-full border-none"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )
      }

      {/* Lightbox */}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

      {/* Admin link */}
      <a href="/import" className="mt-auto pt-10 text-gray-300 hover:text-gray-500 text-[10px] uppercase tracking-widest transition-colors">
        Admin Import
      </a>
    </div >
  );
}
