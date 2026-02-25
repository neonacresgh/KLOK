'use client';

import { useState } from 'react';
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

  const handleImport = async () => {
    if (!csvData.trim()) {
      setImportResult({ success: false, message: 'Please paste CSV data' });
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Import Student Data
          </h1>

          <div className="mb-6">
            <label htmlFor="csvData" className="block text-sm font-medium text-gray-700 mb-2">
              Paste CSV Data
            </label>
            <textarea
              id="csvData"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="Paste your CSV data here..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
              disabled={isImporting}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={isImporting || !csvData.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? 'Importing...' : 'Import to Firebase'}
            </button>

            <button
              onClick={() => {
                setCsvData('');
                setImportResult(null);
              }}
              className="px-6 py-3 bg-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Clear
            </button>
          </div>

          {importResult && (
            <div className={`mt-6 p-4 rounded-md ${importResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
              <div className="font-medium">
                {importResult.success
                  ? `✅ ${importResult.message || `Imported ${importResult.count || 0} students`}`
                  : `❌ Error: ${importResult.message}`
                }
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Expected CSV Format:</p>
            <code className="block bg-gray-100 p-3 rounded text-xs">
              Surname,Other Names,Gender,Email Address,Date of Birth,Role / Rank,Email Status
            </code>
            <p className="mt-2">Make sure your data matches this format exactly.</p>
          </div>

          <div className="mt-6">
            <a
              href="/landing"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Search
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
