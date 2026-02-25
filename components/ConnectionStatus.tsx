'use client';

import { useState, useEffect } from 'react';
import { HybridStudentStorage, StorageMode } from '@/utils/hybridStudentStorage';

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [storageMode, setStorageMode] = useState<StorageMode>('hybrid');
  const [storage] = useState(() => HybridStudentStorage.getInstance());

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setStorageMode(storage.getMode());
    };

    updateStatus();

    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [storage]);

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-100 text-red-800 border-red-200';
    if (storageMode === 'firebase') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (storageMode === 'local') return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline - Local Storage Only';
    if (storageMode === 'firebase') return 'Online - Firebase Storage';
    if (storageMode === 'local') return 'Local Storage Mode';
    return 'Online - Hybrid Storage (Local + Firebase)';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '🔴';
    if (storageMode === 'firebase') return '☁️';
    if (storageMode === 'local') return '💾';
    return '🔄';
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
      <span className="mr-2">{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
    </div>
  );
}
