'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface RoomOption {
    id: string;
    code: string;
    room: string;
    hostel: string;
    label: string;
}

interface PremiumRoomSelectorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const PremiumRoomSelector: React.FC<PremiumRoomSelectorProps> = ({ value, onChange, placeholder = "Search Room..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rooms, setRooms] = useState<RoomOption[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        fetch('/hostel_rooms.json')
            .then(res => res.json())
            .then(data => setRooms(data))
            .catch(err => console.error('Failed to load rooms:', err));
    }, []);

    const filteredRooms = useMemo(() => {
        if (!searchTerm) return rooms;
        const lowerSearch = searchTerm.toLowerCase();
        return rooms.filter(r =>
            r.room.toLowerCase().includes(lowerSearch) ||
            r.hostel.toLowerCase().includes(lowerSearch)
        );
    }, [rooms, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (room: RoomOption) => {
        onChange(room.room);
        setSearchTerm(room.room);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setFocusedIndex(prev => Math.min(prev + 1, filteredRooms.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault();
            handleSelect(filteredRooms[focusedIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (focusedIndex >= 0 && listRef.current) {
            const activeElement = listRef.current.children[focusedIndex] as HTMLElement;
            if (activeElement) {
                activeElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={isOpen ? searchTerm : (value || searchTerm)}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        setFocusedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-gray-50/50 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-transform duration-300 group-focus-within:rotate-180">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <ul
                        ref={listRef}
                        className="max-h-60 overflow-y-auto py-2 px-1 custom-scrollbar"
                    >
                        {filteredRooms.length > 0 ? (
                            filteredRooms.map((r, index) => (
                                <li
                                    key={`${r.id}-${index}`}
                                    onClick={() => handleSelect(r)}
                                    onMouseEnter={() => setFocusedIndex(index)}
                                    className={`
                    flex flex-col px-3 py-2 rounded-xl cursor-pointer transition-all duration-200
                    ${focusedIndex === index ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'hover:bg-gray-50 text-gray-700'}
                  `}
                                >
                                    <span className="text-[11px] font-black tracking-tight">{r.room}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider opacity-70 ${focusedIndex === index ? 'text-blue-50' : 'text-gray-400'}`}>
                                        {r.hostel}
                                    </span>
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-8 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No rooms found</p>
                            </li>
                        )}
                    </ul>
                </div>
            )}

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
        </div>
    );
};

export default PremiumRoomSelector;
