import { useEffect, useState } from 'react';
import type { LocationData } from '../../types';
import { LIVE_LOCATION_AGE_MS } from '../../services/locationService';

export function LiveLocationStatus({ location }: { location: LocationData }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (location.source !== 'GPS' || !location.capturedAt) return <p className="text-xs text-amber-700">Waiting for device location. Enable precise location permission on your phone.</p>;
  const age = Math.max(0, now - Date.parse(location.capturedAt));
  const fresh = age <= LIVE_LOCATION_AGE_MS;
  const precise = location.accuracyMeters !== undefined && location.accuracyMeters <= 50;
  return <div className={`space-y-1 text-xs ${fresh && precise ? 'text-emerald-700' : 'text-amber-700'}`}>
    <p>{fresh ? 'Fresh device reading' : 'Last known device reading'} · {Math.floor(age / 1000)} seconds ago</p>
    <p>Estimated accuracy: ±{location.accuracyMeters ?? '?'} m{!precise ? ' · approximate location' : ''}</p>
    <p className="text-slate-500">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
  </div>;
}
