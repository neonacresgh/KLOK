'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Student } from '@/types/student';

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
<style>body{background:#0d1117;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}
.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="spinner"></div><p style="color:#94a3b8;font-size:14px">Logging in to Student Portal…</p>
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

function UfisButton({ indexNum, dob }: { indexNum: string; dob: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => launchUfisPortal(indexNum, dob, () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3500);
      })}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] bg-emerald-950/60 border-emerald-800/40 hover:bg-emerald-900/60"
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center">
        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-white text-xs font-bold">Fees Portal (UFIS)</p>
        <p className={`text-[10px] mt-0.5 ${copied ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
          {copied ? '✓ Copied ID & Password!' : `Copy credentials & Open`}
        </p>
      </div>
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
        'relative overflow-hidden flex-shrink-0 bg-slate-600 flex items-center justify-center font-bold text-white select-none',
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
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6" onClick={onClose}>
      <div className="relative max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-9 right-0 text-white/50 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <img src={url} alt="Student photo" className="w-full rounded-2xl shadow-2xl object-cover" />
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
      className="ml-1.5 shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
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
    <div className="bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{label}</p>
        <p className="text-white text-sm font-semibold mt-0.5 break-words">{display}</p>
      </div>
      {display !== '—' && <Copy text={display} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<any>(null);

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
    if (upper.trim().length < 2) setSelected(null);
    setExpanded(false);
  };

  // ── Search (50ms debounce — near-instant, IndexedDB handles repeated queries) ──
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }

    const isNum = isNumericOnly(trimmed);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { collection, query: fsq, where, orderBy, limit, getDocs, doc, getDoc } =
          await import('firebase/firestore');
        const db = await getDb();
        let results: Student[] = [];

        if (isNum) {
          // Direct O(1) lookup
          const snap = await getDoc(doc(db, 'students', `${trimmed}@upsamail.edu.gh`));
          if (snap.exists()) {
            results = [{ id: snap.id, ...snap.data() } as Student];
          } else if (trimmed.length < 8) {
            const rs = await getDocs(fsq(collection(db, 'students'), where('emailAddress', '>=', trimmed), where('emailAddress', '<=', trimmed + '\uf8ff'), limit(6)));
            results = rs.docs.map(d => ({ id: d.id, ...d.data() } as Student));
          }
        } else {
          const surnamePrefix = trimmed.split(/\s+/)[0];
          const rs = await getDocs(fsq(collection(db, 'students'), where('surname', '>=', surnamePrefix), where('surname', '<=', surnamePrefix + '\uf8ff'), orderBy('surname'), limit(10)));
          const words = trimmed.split(/\s+/).filter(Boolean);
          results = rs.docs
            .map(d => ({ id: d.id, ...d.data() } as Student))
            .filter(s => {
              const full = `${s.surname} ${s.otherNames}`.toUpperCase();
              return words.every(w => full.includes(w));
            });
        }

        setSuggestions(results);
        setShowDrop(results.length > 0);
      } catch (err) {
        console.error('Search:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, isNumericOnly(query.trim()) ? 50 : 100); // fast!

    return () => clearTimeout(timer);
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
    setQuery(`${s.surname} ${s.otherNames}`);
    setSelected(s);
    setShowDrop(false);
    setExpanded(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0d1117] flex flex-col items-center px-4 pt-10 sm:pt-20 pb-10">

      {/* ── Logo ── */}
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-7 sm:mb-10 select-none">
        KLOK
      </h1>

      {/* ── Search area ── */}
      <div className="w-full max-w-xl relative z-30">

        {/* Dropdown backdrop — transparent, sits behind dropdown but above page */}
        {showDrop && (
          <div
            className="fixed inset-0 z-20"
            onClick={closeDrop}
            aria-hidden
          />
        )}

        <div className="relative z-30">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={(e) => {
              if (suggestions.length > 0 && query.trim().length >= 2) setShowDrop(true);
              setTimeout(() => (e.target as HTMLInputElement).scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
            }}
            placeholder="Search by name or index number…"
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500
                       text-sm sm:text-base font-semibold uppercase tracking-wide
                       px-5 pr-12 py-3.5 rounded-xl outline-none
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       transition-all duration-150"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin pointer-events-none" />
            ) : query.length > 0 ? (
              <button
                onClick={() => { setQuery(''); setSelected(null); setShowDrop(false); setSuggestions([]); inputRef.current?.focus(); }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-600 hover:bg-slate-500 active:scale-95 transition-all"
                aria-label="Clear"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <svg className="w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            )}
          </div>

          {/* Dropdown — rendered above backdrop (z-30 > z-20) */}
          {showDrop && suggestions.length > 0 && (
            <div
              ref={dropRef}
              className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => pick(s)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 text-left',
                    'hover:bg-slate-700 active:bg-slate-600 transition-colors',
                    i > 0 ? 'border-t border-slate-700/60' : '',
                  ].join(' ')}
                >
                  <Avatar student={s} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{s.surname} {s.otherNames}</p>
                    <p className="text-slate-400 text-xs truncate">{s.emailAddress}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400 bg-slate-700 px-2 py-0.5 rounded font-medium">
                    {buildRole(s.roleRank, s.emailStatus)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Student Card ── */}
      {selected && (
        <>
          {/* Card backdrop — only dismisses the card, not the search */}
          <div
            className="fixed inset-0 z-10"
            onClick={dismissCard}
            aria-hidden
          />

          <div ref={cardRef} className="relative z-20 w-full max-w-xl mt-4 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex gap-4 p-4 sm:p-5">
              <Avatar
                student={selected}
                large
                onClick={() => setLightbox(getPhotoUrl(selected.emailAddress))}
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight break-words">
                  {selected.surname} {selected.otherNames}
                </h2>
                <div className="flex items-center mt-1">
                  <span className="text-slate-400 text-xs sm:text-sm truncate">{selected.emailAddress}</span>
                  <Copy text={selected.emailAddress} />
                </div>
                <span className="inline-block mt-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                  {buildRole(selected.roleRank, selected.emailStatus)}
                </span>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900/50 border-t border-slate-700
                         text-slate-400 text-[10px] font-bold uppercase tracking-widest
                         hover:text-white hover:bg-slate-900/80 transition-colors"
            >
              {expanded ? 'Hide details' : 'Show details'}
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Expanded details */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-4 grid grid-cols-2 gap-2.5 border-t border-slate-700">
                <Cell label="Index Number" value={selected.emailAddress?.split('@')[0]} />
                <Cell label="Gender" value={selected.gender} />
                <Cell label="Date of Birth" value={buildDate(selected.dateOfBirth, selected.roleRank)} />
                <Cell label="Email Status" value={clean(selected.emailStatus)} />
              </div>

              {/* ── Portal shortcuts ── */}
              <div className="px-4 pb-5 flex flex-col gap-2">
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest pt-2 pb-1">Quick Login</p>

                <button
                  onClick={() => launchStudentPortal(
                    selected.emailAddress?.split('@')[0] || '',
                    toStudentPortalDOB(buildDate(selected.dateOfBirth, selected.roleRank))
                  )}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] bg-blue-950/60 border-blue-800/40 hover:bg-blue-900/60"
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7v-6m0 0l6.16-3.422" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white text-xs font-bold">Student Portal</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">
                      Auto-login as {selected.emailAddress?.split('@')[0]}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>

                <UfisButton
                  indexNum={`UPSA-${selected.emailAddress?.split('@')[0]}`}
                  dob={toUfisDOB(buildDate(selected.dateOfBirth, selected.roleRank))}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

      {/* Admin link */}
      <a href="/import" className="mt-auto pt-10 text-slate-700 hover:text-slate-500 text-[10px] uppercase tracking-widest transition-colors">
        Admin Import
      </a>
    </div>
  );
}
