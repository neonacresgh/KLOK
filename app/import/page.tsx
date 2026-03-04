'use client';

import { useState, useRef } from 'react';
import { importStudentsToFirebase } from '@/utils/dataImport';

export default function DataImport() {
  const [csvData, setCsvData] = useState('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message?: string;
    count?: number;
    skipped?: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!csvData.trim()) {
      setImportResult({ success: false, message: 'Please paste CSV data or upload a file' });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importStudentsToFirebase(csvData);
      setImportResult(result);
    } catch (error) {
      setImportResult({ success: false, message: (error as Error).message || 'Import failed' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
            KLOK
          </h1>
          <p className="text-gray-500 font-medium">Import</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Import</h2>
                <p className="text-blue-100 text-xs">Upload CSV or paste data below</p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {/* Upload Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-6 mb-6 cursor-pointer transition-all duration-200
                ${dragOver
                  ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-semibold text-sm">
                  {csvData ? 'File loaded - Click to change' : 'Drop CSV file here or click to browse'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Supports .csv files</p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Or paste data</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Textarea */}
            <div className="mb-6">
              <label htmlFor="csvData" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                CSV Data
              </label>
              <textarea
                id="csvData"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Surname,Other Names,Gender,Email Address,Date of Birth,Role / Rank,Email Status&#10;Smith,John,Male,john.smith@upsamail.edu.gh,2003-02-15,Student,Active&#10;..."
                className="w-full h-48 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-xs bg-gray-50 resize-none"
                disabled={isImporting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={isImporting || !csvData.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Import</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setCsvData('');
                  setImportResult(null);
                }}
                disabled={isImporting}
                className="px-5 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                Clear
              </button>
            </div>

            {/* Result Alert */}
            {importResult && (
              <div className={`
                mt-6 p-4 rounded-2xl border-2 animate-in fade-in slide-in-from-top-2
                ${importResult.success
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
                }
              `}>
                <div className="flex items-start gap-3">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                    ${importResult.success ? 'bg-emerald-100' : 'bg-red-100'}
                  `}>
                    {importResult.success ? (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${importResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {importResult.success
                        ? `Import Successful!`
                        : 'Import Failed'
                      }
                    </p>
                    <p className={`text-xs mt-0.5 ${importResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                      {importResult.success
                        ? `Successfully imported ${importResult.count || 0} students${importResult.skipped ? ` (${importResult.skipped} skipped)` : ''}`
                        : importResult.message
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Format Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expected CSV Format</p>
              <code className="block bg-white p-3 rounded-lg text-xs text-gray-600 border border-gray-200">
                Surname, Other Names, Gender, Email Address, Date of Birth, Role / Rank, Email Status
              </code>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/landing"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Search
          </a>
        </div>
      </div>
    </div>
  );
}
