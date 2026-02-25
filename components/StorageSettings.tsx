'use client';

import { useState } from 'react';
import { HybridStudentStorage, StorageMode } from '@/utils/hybridStudentStorage';

interface StorageSettingsProps {
  onSyncComplete?: () => void;
}

export default function StorageSettings({ onSyncComplete }: StorageSettingsProps) {
  const [storageMode, setStorageMode] = useState<StorageMode>('hybrid');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [storage] = useState(() => HybridStudentStorage.getInstance());

  const handleModeChange = async (newMode: StorageMode) => {
    setStorageMode(newMode);
    storage.setMode(newMode);
    setSyncMessage(`Storage mode changed to ${newMode}`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleSyncToFirebase = async () => {
    if (!storage.isOnlineStatus()) {
      setSyncMessage('Cannot sync while offline');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Syncing to Firebase...');
    
    try {
      await storage.forceSyncToFirebase();
      setSyncMessage('Successfully synced to Firebase!');
      onSyncComplete?.();
    } catch (error) {
      setSyncMessage('Sync failed. Please try again.');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const handleSyncFromFirebase = async () => {
    if (!storage.isOnlineStatus()) {
      setSyncMessage('Cannot sync while offline');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Syncing from Firebase...');
    
    try {
      await storage.forceSyncFromFirebase();
      setSyncMessage('Successfully synced from Firebase!');
      onSyncComplete?.();
    } catch (error) {
      setSyncMessage('Sync failed. Please try again.');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Settings</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Storage Mode
          </label>
          <select
            value={storageMode}
            onChange={(e) => handleModeChange(e.target.value as StorageMode)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="hybrid">Hybrid (Recommended) - Local + Firebase</option>
            <option value="local">Local Only - No internet required</option>
            <option value="firebase">Firebase Only - Requires internet</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {storageMode === 'hybrid' && 'Works offline, syncs when online'}
            {storageMode === 'local' && 'Fast and reliable, no internet needed'}
            {storageMode === 'firebase' && 'Cloud storage, accessible anywhere'}
          </p>
        </div>

        {storageMode !== 'local' && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Sync Operations</h4>
            <div className="space-y-2">
              <button
                onClick={handleSyncToFirebase}
                disabled={isSyncing || !storage.isOnlineStatus()}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? 'Syncing...' : 'Sync Local Data to Firebase'}
              </button>
              
              <button
                onClick={handleSyncFromFirebase}
                disabled={isSyncing || !storage.isOnlineStatus()}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? 'Syncing...' : 'Sync Firebase Data to Local'}
              </button>
            </div>
          </div>
        )}

        {syncMessage && (
          <div className={`p-3 rounded-md text-sm ${
            syncMessage.includes('failed') || syncMessage.includes('Cannot')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {syncMessage}
          </div>
        )}
      </div>
    </div>
  );
}
