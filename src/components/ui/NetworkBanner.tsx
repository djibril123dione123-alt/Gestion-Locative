import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  if (!isOnline) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span>Connexion perdue — les données affichées peuvent être obsolètes.</span>
      </div>
    );
  }

  return (
    <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm font-medium z-50 flex-shrink-0">
      <Wifi className="w-4 h-4 flex-shrink-0" />
      <span>Connexion rétablie.</span>
    </div>
  );
}
