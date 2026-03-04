'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface RoomOption {
  id: string;
  code: string;
  room: string;
  hostel: string;
  label: string;
}

export interface Roommate {
  full_name: string;
  index_num: string;
  phone: string;
  dob?: string;
  hall: string;
  bed: string;
  level: string;
  imageUrl?: string;
}

interface CascadingHostelRoomSelectorProps {
  hostelValue: string;
  roomValue: string;
  onHostelChange: (value: string) => void;
  onRoomChange: (value: string, roomId?: string) => void;
  onRoommatesLoaded?: (roommates: Roommate[]) => void;
}

const HOSTELS = [
  { value: '', label: 'All Hostels' },
  { value: 'UPSA Hostel A', label: 'UPSA Hostel A' },
  { value: 'Matthew Opoku Prempeh Hostel', label: 'Matthew Opoku Prempeh' },
  { value: 'Amon Kotei Hostel', label: 'Amon Kotei Hostel' },
];

const CascadingHostelRoomSelector: React.FC<CascadingHostelRoomSelectorProps> = ({
  hostelValue,
  roomValue,
  onHostelChange,
  onRoomChange,
  onRoommatesLoaded,
}) => {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [isLoadingRoommates, setIsLoadingRoommates] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const listRef = useRef<HTMLUListElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load all rooms once
  useEffect(() => {
    fetch('/hostel_rooms.json')
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => console.error('Failed to load rooms:', err));
  }, []);

  // Filter rooms by hostel + search
  const filteredRooms = useMemo(() => {
    let filtered = rooms;
    if (hostelValue) filtered = filtered.filter((r) => r.hostel === hostelValue);
    if (roomSearchTerm) {
      const s = roomSearchTerm.toLowerCase();
      filtered = filtered.filter((r) => r.room.toLowerCase().includes(s));
    }
    return filtered;
  }, [rooms, hostelValue, roomSearchTerm]);

  // Selected room — hostel-aware to prevent cross-hostel duplicates
  const selectedRoom = useMemo(() => {
    if (!roomValue) return undefined;
    return (
      rooms.find((r) => r.room === roomValue && (!hostelValue || r.hostel === hostelValue)) ??
      rooms.find((r) => r.room === roomValue)
    );
  }, [roomValue, rooms, hostelValue]);

  // Label for the trigger button
  const selectedRoomLabel = useMemo(() => {
    if (!roomValue) return '';
    const r =
      rooms.find((rr) => rr.room === roomValue && (!hostelValue || rr.hostel === hostelValue)) ??
      rooms.find((rr) => rr.room === roomValue);
    return r ? r.label : roomValue;
  }, [roomValue, rooms, hostelValue]);

  // Auto-focus search + scroll selected item into view when opened
  useEffect(() => {
    if (!isRoomOpen) return;
    // Use rAF so the DOM is painted before we try to focus/scroll
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      if (selectedItemRef.current && listRef.current) {
        selectedItemRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isRoomOpen]);

  // Lock body scroll on mobile while sheet is open
  useEffect(() => {
    if (isMobile) document.body.style.overflow = isRoomOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isRoomOpen, isMobile]);

  // Fetch roommates in the background — selection already feels instant
  const fetchRoommates = useCallback(async (roomId: string) => {
    if (!roomId || !onRoommatesLoaded) return;
    setIsLoadingRoommates(true);
    try {
      const res = await fetch('/api/hostel-roommates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      if (!res.ok) throw new Error('Failed to fetch roommates');
      const data = await res.json();
      onRoommatesLoaded(data.roommates || []);
    } catch {
      onRoommatesLoaded?.([]);
    } finally {
      setIsLoadingRoommates(false);
    }
  }, [onRoommatesLoaded]);

  const handleHostelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onHostelChange(e.target.value);
    onRoomChange('');
    setRoomSearchTerm('');
    setIsRoomOpen(false);
    onRoommatesLoaded?.([]);
  };

  const openRoomDropdown = () => {
    if (!hostelValue) return;
    setRoomSearchTerm(''); // clear search so full list shows, selected room is visible
    setIsRoomOpen(true);
  };

  // Instantaneous selection — update UI first, fetch data in background
  const handleRoomSelect = (room: RoomOption) => {
    onRoomChange(room.room, room.id);  // update parent state immediately
    setRoomSearchTerm('');
    setIsRoomOpen(false);
    fetchRoommates(room.id);           // async, non-blocking
  };

  const closeDropdown = () => {
    setIsRoomOpen(false);
    setRoomSearchTerm('');
  };

  // Shared room list item renderer — avoids code duplication between mobile/desktop
  const renderRoomItem = (r: RoomOption, mobileSized = false) => {
    const isSelected = selectedRoom?.id === r.id;
    return (
      <li
        key={r.id}
        ref={isSelected ? selectedItemRef : null}
        onPointerDown={(e) => {
          // Use pointerDown so the list item registers before the input blur event
          e.preventDefault();
          handleRoomSelect(r);
        }}
        className={`flex items-center justify-between rounded-2xl cursor-pointer transition-colors active:scale-[0.98] select-none ${mobileSized ? 'px-4 py-3.5' : 'px-3 py-2.5'
          } ${isSelected
            ? 'bg-blue-600 shadow-md shadow-blue-200/50'
            : 'hover:bg-blue-50 active:bg-blue-100'
          }`}
      >
        <div className="flex flex-col">
          <span className={`font-black tracking-tight ${mobileSized ? 'text-base' : 'text-sm'} ${isSelected ? 'text-white' : 'text-gray-800'}`}>
            {mobileSized ? `Room ${r.room}` : r.room}
          </span>
          <span className={`font-medium mt-0.5 uppercase tracking-wide ${mobileSized ? 'text-[11px]' : 'text-[10px]'} ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
            {r.hostel}
          </span>
        </div>
        {isSelected && (
          <div className={`flex items-center justify-center rounded-full bg-white/20 ${mobileSized ? 'w-6 h-6' : 'w-5 h-5'}`}>
            <svg className={`${mobileSized ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-white`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </li>
    );
  };

  // Shared search input — same ref so it stays focused
  const SearchInput = (
    <div className="relative">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z" />
      </svg>
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search room number..."
        value={roomSearchTerm}
        onChange={(e) => setRoomSearchTerm(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
      />
    </div>
  );

  const EmptyState = (
    <li className="flex flex-col items-center py-10 gap-2">
      <svg className="w-7 h-7 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z" />
      </svg>
      <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
        {roomSearchTerm ? 'No rooms match' : 'No rooms available'}
      </p>
    </li>
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col sm:flex-row gap-3">

        {/* ── Hostel Select ── */}
        <div className="relative flex-1">
          <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1 tracking-wider">
            Select Hostel
          </label>
          <div className="relative group">
            <select
              value={hostelValue}
              onChange={handleHostelChange}
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 appearance-none cursor-pointer transition-all shadow-sm hover:border-gray-300"
            >
              {HOSTELS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Room Trigger ── */}
        <div className="relative flex-1">
          <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1 tracking-wider">
            Room Number
          </label>
          <button
            type="button"
            onClick={openRoomDropdown}
            disabled={!hostelValue}
            className={`w-full flex items-center justify-between bg-white border rounded-2xl px-4 py-3 text-left transition-all shadow-sm ${!hostelValue
                ? 'border-gray-200 opacity-60 cursor-not-allowed bg-gray-50'
                : isRoomOpen
                  ? 'border-blue-500 ring-4 ring-blue-50/50'
                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
              }`}
          >
            <span className={`text-xs sm:text-sm font-semibold truncate ${selectedRoomLabel ? 'text-gray-800' : 'text-gray-400'}`}>
              {selectedRoomLabel || (hostelValue ? 'Select room...' : 'Select hostel first')}
            </span>
            <div className={`shrink-0 ml-2 text-gray-400 transition-all duration-200 ${isRoomOpen ? 'rotate-180 text-blue-500' : ''} ${!hostelValue ? 'opacity-30' : ''}`}>
              {isLoadingRoommates
                ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              }
            </div>
          </button>

          {/* ── Desktop floating dropdown (inline JSX, not a sub-component) ── */}
          {isRoomOpen && !isMobile && (
            <>
              <div className="fixed inset-0 z-[100]" onPointerDown={closeDropdown} />
              <div className="absolute z-[200] w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.1)] overflow-hidden" style={{ animation: 'ddropIn 0.15s ease-out' }}>
                <div className="p-2 border-b border-gray-100">
                  {SearchInput}
                </div>
                <ul ref={listRef} className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
                  {filteredRooms.length > 0 ? filteredRooms.map((r) => renderRoomItem(r, false)) : EmptyState}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Sheet (inline JSX, not a sub-component) ── */}
      {isRoomOpen && isMobile && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            style={{ animation: 'fadeInBd 0.18s ease-out' }}
            onPointerDown={closeDropdown}
          />
          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[400] bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ animation: 'slideUpSh 0.26s cubic-bezier(0.32,0.72,0,1)', maxHeight: '82vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0.5">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-black text-gray-900">Select Room</p>
                <p className="text-[11px] text-gray-400 font-medium">{hostelValue}</p>
              </div>
              <button
                onPointerDown={(e) => { e.preventDefault(); closeDropdown(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              {SearchInput}
            </div>
            {/* Room list */}
            <ul ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-1" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              {filteredRooms.length > 0 ? filteredRooms.map((r) => renderRoomItem(r, true)) : EmptyState}
            </ul>
          </div>
        </>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

        @keyframes ddropIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInBd {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUpSh {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CascadingHostelRoomSelector;
