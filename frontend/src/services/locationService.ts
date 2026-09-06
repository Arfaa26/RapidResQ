import { LocationData } from '../types';

const TARGET_ACCURACY_METERS = 30;
const MAX_ACCEPTABLE_ACCURACY_METERS = 250;
const ACCURATE_FIX_TIMEOUT_MS = 15_000;

const positionOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 0,
};

export const locationService = {
  // Best-effort location for passive home-screen telemetry.
  async getCurrentLocation(): Promise<LocationData> {
    try {
      const position = await getOneTimePosition();
      return await locationFromPosition(position);
    } catch (error) {
      console.warn('Geolocation permission error or unavailable:', error);
      return getDefaultLocation();
    }
  },

  // A fresh GPS fix used for incident and SOS submission. It waits for a
  // high-accuracy reading and never substitutes demo coordinates.
  async getAccurateCurrentLocation(): Promise<LocationData> {
    const position = await getAccuratePosition();
    return locationFromPosition(position);
  },

  // Watch position in real-time
  watchLiveLocation(onUpdate: (loc: LocationData) => void): number | null {
    if (!navigator.geolocation) return null;

    return navigator.geolocation.watchPosition(
      async (position) => {
        onUpdate(await locationFromPosition(position));
      },
      (err) => console.warn('Live watch position error:', err.message),
      { ...positionOptions, maximumAge: 5_000 }
    );
  },

  clearWatch(watchId: number | null) {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};

export function isFreshLiveLocation(location: LocationData, maxAgeMs = 30_000): boolean {
  if (location.source !== 'GPS' || !location.capturedAt) return false;
  const ageMs = Date.now() - new Date(location.capturedAt).getTime();
  return Number.isFinite(ageMs)
    && ageMs >= 0
    && ageMs <= maxAgeMs
    && (location.accuracyMeters ?? Number.POSITIVE_INFINITY) <= MAX_ACCEPTABLE_ACCURACY_METERS;
}

function getOneTimePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(toLocationError(error)), positionOptions);
  });
}

function getAccuratePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (bestPosition && bestPosition.coords.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
        finish(bestPosition);
        return;
      }

      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      const detail = bestPosition
        ? `The best GPS reading was only accurate to ${Math.round(bestPosition.coords.accuracy)} metres.`
        : 'No GPS reading was received.';
      reject(new Error(`${detail} Move near a window or outdoors and try again.`));
    }, ACCURATE_FIX_TIMEOUT_MS);

    const finish = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(position);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= TARGET_ACCURACY_METERS) finish(position);
      },
      (error) => {
        if (settled) return;
        if (bestPosition && bestPosition.coords.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
          finish(bestPosition);
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(toLocationError(error));
      },
      positionOptions,
    );
  });
}

async function locationFromPosition(position: GeolocationPosition): Promise<LocationData> {
  const lat = Number(position.coords.latitude.toFixed(6));
  const lng = Number(position.coords.longitude.toFixed(6));
  const address = await reverseGeocode(lat, lng);

  return {
    lat,
    lng,
    address,
    accuracyMeters: Math.round(position.coords.accuracy),
    capturedAt: new Date(position.timestamp).toISOString(),
    source: 'GPS',
  };
}

function toLocationError(error: GeolocationPositionError): Error {
  if (error.code === error.PERMISSION_DENIED) {
    return new Error('Location permission is blocked. Allow precise location for this site, then try again.');
  }
  if (error.code === error.TIMEOUT) {
    return new Error('GPS timed out before an accurate location was available. Try again near a window or outdoors.');
  }
  return new Error('Your current GPS location is unavailable. Check location services and try again.');
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) throw new Error('Geocoding response not ok');
    const data = await res.json();
    
    if (data && data.display_name) {
      // Create concise readable address
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.suburb || '';
      const city = addr.city || addr.town || addr.village || addr.county || '';
      const state = addr.state || '';
      
      const parts = [road, city, state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
    }
    return `Live Location at ${lat}, ${lng}`;
  } catch {
    return `Live GPS: ${lat}, ${lng}`;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getDefaultLocation(): LocationData {
  return {
    lat: 40.7128,
    lng: -74.0060,
    address: 'Waiting for precise GPS location',
    capturedAt: new Date().toISOString(),
    source: 'FALLBACK',
  };
}
