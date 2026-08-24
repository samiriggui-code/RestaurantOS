import { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getQueueSize, clearQueue } from '../services/offlineQueue';
import { processQueue } from '../services/syncService';
import { WifiOff, RefreshCw, Trash2 } from 'lucide-react';

export default function NetworkStatus() {
  const isOnline = useNetworkStatus();
  const [queueSize, setQueueSize] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const check = () => getQueueSize().then(setQueueSize);
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await processQueue();
    setSyncing(false);
    getQueueSize().then(setQueueSize);
  };

  if (isOnline && queueSize === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg text-sm font-medium transition-all ${
        isOnline ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{queueSize} طلب بانتظار الإرسال</span>
          {queueSize > 0 && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-2 py-1 bg-white/20 rounded-lg hover:bg-white/30 text-xs"
              >
                {syncing ? '...' : 'إرسال'}
              </button>
              <button
                onClick={() => clearQueue().then(() => setQueueSize(0))}
                className="p-1 hover:bg-white/20 rounded-lg"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>لا يوجد اتصال بالإنترنت</span>
        </>
      )}
    </div>
  );
}
