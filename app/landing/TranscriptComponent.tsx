'use client';

import React, { useState, useEffect } from 'react';
import { Student, getPhotoUrl } from './types';

interface ProfessionalTranscriptProps {
    html: string;
    selected: Student | null;
    onBack: () => void;
}

const ProfessionalTranscript: React.FC<ProfessionalTranscriptProps> = ({ html, selected, onBack }) => {
    const [parsedData, setParsedData] = useState<{
        photo?: string;
        name?: string;
        index?: string;
        gpa?: string;
        cgp?: string;
        tables: { title: string; rows: any[]; footer?: { label: string, value: string }[] }[];
    } | null>(null);

    useEffect(() => {
        if (!html) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 1. Extract Photo
        const img = doc.querySelector('img[src*="/images/students/"]');
        const photo = img?.getAttribute('src');

        // 2. Extract Basic Info
        const extractLabel = (label: string) => {
            const elements = Array.from(doc.querySelectorAll('td, span, b, strong, p'));
            const el = elements.find(e => e.textContent?.toLowerCase().includes(label.toLowerCase()));
            if (el && el.nextElementSibling) return el.nextElementSibling.textContent?.trim();
            if (el) {
                const text = el.textContent || '';
                const parts = text.split(':');
                if (parts.length > 1) return parts[1].trim();
            }
            return '';
        };

        const name = extractLabel('Name');
        const index = extractLabel('Index');
        const gpa = extractLabel('GPA');
        const cgp = extractLabel('CGPA');

        // 3. Extract Tables
        const tables: { title: string; rows: any[]; footer?: { label: string, value: string }[] }[] = [];
        const docTables = Array.from(doc.querySelectorAll('table'));

        docTables.forEach((table, idx) => {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) return;

            let title = `Section ${idx + 1}`;
            let prev = table.previousElementSibling;
            while (prev && !prev.textContent?.trim()) prev = prev.previousElementSibling;
            if (prev) title = prev.textContent?.trim() || title;

            const dataRows: any[] = [];
            const footerItems: { label: string, value: string }[] = [];
            const headers = Array.from(rows[0].querySelectorAll('td, th')).map(h => h.textContent?.trim() || '');

            if (headers.length < 3) return;

            for (let i = 1; i < rows.length; i++) {
                const tr = rows[i];
                const cells = Array.from(tr.querySelectorAll('td')).map(c => c.textContent?.trim() || '');
                const rowText = tr.textContent?.toLowerCase() || '';

                if (rowText.includes('totals') || rowText.includes('semester gpa')) {
                    if (rowText.includes('semester gpa')) {
                        const val = cells[cells.length - 1];
                        if (val) footerItems.push({ label: 'Semester GPA', value: val });
                    } else if (rowText.includes('totals')) {
                        const credits = cells[headers.indexOf('CREDITS')] || cells[1] || '';
                        const gp = cells[headers.indexOf('GP')] || cells[cells.length - 1] || '';
                        if (credits || gp) {
                            footerItems.push({ label: 'Credits', value: credits });
                            footerItems.push({ label: 'Total GP', value: gp });
                        }
                    }
                    continue;
                }

                if (cells.length >= headers.length) {
                    dataRows.push(cells);
                }
            }

            if (dataRows.length > 0) {
                tables.push({
                    title,
                    rows: dataRows.map(r => r.reduce((acc: any, val: string, i: number) => {
                        acc[headers[i] || `col${i}`] = val;
                        return acc;
                    }, {})),
                    footer: footerItems.length > 0 ? footerItems : undefined
                });
            }
        });

        setParsedData({ photo: photo || undefined, name, index, gpa, cgp, tables });
    }, [html]);

    if (!parsedData) return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold uppercase tracking-widest">Parsing Official Data...</p>
        </div>
    );

    return (
        <div id="professional-transcript-view" className="flex-1 bg-white overflow-auto pb-20">
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * { visibility: hidden; }
          #professional-transcript-view, #professional-transcript-view * { visibility: visible; }
          #professional-transcript-view { 
            position: fixed; 
            left: 0; 
            top: 0; 
            width: 100vw; 
            height: auto;
            overflow: visible;
          }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />

            <div className="bg-gradient-to-b from-blue-50/50 to-transparent px-6 py-8 flex flex-col items-center border-b border-gray-100">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-2xl bg-gray-50 mb-6 transition-transform duration-300">
                        <img
                            src={parsedData.photo || selected?.imageUrl || getPhotoUrl(selected?.emailAddress || '')}
                            alt="Passport"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = getPhotoUrl(selected?.emailAddress || '');
                            }}
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-xl border-4 border-white shadow-lg">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 00-1.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    </div>
                </div>

                <h2 className="text-2xl font-black text-gray-900 tracking-tight text-center">{parsedData.name || `${selected?.surname} ${selected?.otherNames}`}</h2>
                <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-[10px] mt-1.5">{parsedData.index || selected?.emailAddress?.split('@')[0]}</p>

                <div className="flex gap-4 mt-8">
                    <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CWA</p>
                        <p className="text-xl font-black text-gray-900">{parsedData.gpa || '—'}</p>
                    </div>
                    <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CGPA</p>
                        <p className="text-xl font-black text-blue-600">{parsedData.cgp || '—'}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">
                {parsedData.tables.map((table, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">{table.title}</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {table.rows.map((row, j) => {
                                const keys = Object.keys(row);
                                const code = row[keys[0]] || '';
                                const title = row[keys[1]] || '';
                                const grade = row[keys.find(k => k.toLowerCase().includes('grade')) || keys[keys.length - 1]] || '';

                                return (
                                    <div key={j} className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-2xl transition-all group">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{code}</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 mt-1 truncate">{title}</p>
                                        </div>
                                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm">
                                            <span className={`text-base font-black ${grade === 'A' ? 'text-emerald-500' : grade === 'B+' || grade === 'B' ? 'text-blue-500' : 'text-gray-900'}`}>
                                                {grade}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {table.footer && (
                                <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                    {table.footer.map((item, k) => (
                                        <div key={k} className="flex-1 min-w-[140px] bg-blue-50/50 px-3 py-2 rounded-xl flex items-center justify-between">
                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">{item.label}</span>
                                            <span className="text-sm font-black text-blue-900">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {parsedData.tables.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No results data found in document</p>
                        <button onClick={onBack} className="mt-4 text-blue-600 text-xs font-black underline no-print">Back to Search</button>
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 no-print">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-50 transition-all active:scale-95 shadow-lg shadow-gray-500/10"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back to Search
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/25"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download
                </button>
            </div>
        </div>
    );
};

export default ProfessionalTranscript;
