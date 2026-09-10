import type { LocationData } from '../types';

// Stationary browsers may stop emitting fixes. Reuse a recent observation,
// preserving its original timestamp so both citizen and dispatcher can assess it.
const MAX_LOCATION_AGE_MS = 5 * 60_000;
const LOCATION_TIMEOUT_MS = 10_000;
const listeners = new Map<number, { update: (location: LocationData) => void; error?: (error: Error) => void }>();
let nextListenerId = 0;
let browserWatchId: number | null = null;
let latestLocation: LocationData | null = null;
let pendingLocation: Promise<LocationData> | null = null;
let addressRequestRunning = false;
let lastAddressRequestAt = 0;
const addresses = new Map<string, { address: string; expiresAt: number }>();
class DeviceLocationError extends Error {
  constructor(message: string, readonly code: number) { super(message); }
}

// Accuracy is information for the dispatcher, not a reason to discard an alert.
export function isFreshLiveLocation(location: LocationData, maxAgeMs = MAX_LOCATION_AGE_MS): boolean {
  if (location.source !== 'GPS' || !location.capturedAt) return false;
  const ageMs = Date.now() - new Date(location.capturedAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs
    && Number.isFinite(location.lat) && Math.abs(location.lat) <= 90
    && Number.isFinite(location.lng) && Math.abs(location.lng) <= 180
    && Number.isFinite(location.accuracyMeters) && location.accuracyMeters! >= 0;
}

function publish(location: LocationData) {
  // A delayed browser callback/address lookup must never move the pin backwards.
  if (latestLocation && Date.parse(location.capturedAt!) < Date.parse(latestLocation.capturedAt!)) return;
  latestLocation = location;
  listeners.forEach(({ update }) => update(location));
}

function addressKey(location: LocationData) {
  return `${location.lat.toFixed(3)},${location.lng.toFixed(3)}`;
}

function receivePosition(position: GeolocationPosition) {
  const location: LocationData = {
    lat: Number(position.coords.latitude.toFixed(6)),
    lng: Number(position.coords.longitude.toFixed(6)),
    address: `GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
    accuracyMeters: Math.round(position.coords.accuracy),
    capturedAt: new Date(position.timestamp).toISOString(),
    source: 'GPS',
  };
  if (!isFreshLiveLocation(location)) return;
  const cached = addresses.get(addressKey(location));
  if (cached && cached.expiresAt > Date.now()) location.address = cached.address;
  publish(location);
  // Coordinates reach the map and submission immediately, even if geocoding is slow.
  if (!cached || cached.expiresAt <= Date.now()) void enrichAddress(location);
}

function receiveError(error: GeolocationPositionError) {
  if (error.code === 1) latestLocation = null;
  const message = error.code === 1
    ? 'Location permission is blocked. Allow location for this site in your browser settings, then refresh GPS.'
    : error.code === 3
      ? 'No recent location was received. Check device location services and refresh GPS.'
      : 'Device location is unavailable. Check location services and refresh GPS.';
  listeners.forEach(({ error: onError }) => onError?.(new DeviceLocationError(message, error.code)));
}

export const locationService = {
  getCurrentLocation(): Promise<LocationData> {
    return this.getAccurateCurrentLocation({ forceRefresh: true });
  },

  async getAccurateCurrentLocation({ forceRefresh = false } = {}): Promise<LocationData> {
    if (!forceRefresh && latestLocation && isFreshLiveLocation(latestLocation)) return latestLocation;
    if (pendingLocation) return pendingLocation;
    if (!navigator.geolocation) throw new Error('This browser does not support device location.');

    const hadLiveWatch = browserWatchId !== null;
    pendingLocation = new Promise<LocationData>((resolve, reject) => {
      let subscription: number | null = null;
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('No recent location was received. Allow location access, check device location services, and try again.'));
      }, LOCATION_TIMEOUT_MS);
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.clearWatch(subscription);
      };
      subscription = this.watchLiveLocation((location) => {
        if (!isFreshLiveLocation(location, forceRefresh ? 1_000 : MAX_LOCATION_AGE_MS)) return;
        cleanup();
        resolve(location);
      }, (error) => {
        // A shared watch timeout must not cancel a new one-shot acquisition.
        if (error instanceof DeviceLocationError && error.code !== 1) return;
        cleanup();
        reject(error);
      });
      // A stationary device may not emit watch updates. Ask for a new reading
      // when its last observation has expired, while still sharing the live feed.
      if (hadLiveWatch || forceRefresh) navigator.geolocation.getCurrentPosition(receivePosition, receiveError, {
        enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: forceRefresh ? 0 : MAX_LOCATION_AGE_MS,
      });
    }).finally(() => { pendingLocation = null; });
    return pendingLocation;
  },

  // All screens and pending submissions share one browser GPS watch.
  watchLiveLocation(onUpdate: (location: LocationData) => void, onError?: (error: Error) => void): number | null {
    if (!navigator.geolocation) return null;
    const id = ++nextListenerId;
    listeners.set(id, { update: onUpdate, error: onError });
    if (browserWatchId === null) {
      browserWatchId = navigator.geolocation.watchPosition(receivePosition, receiveError, {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: MAX_LOCATION_AGE_MS,
      });
    }
    return id;
  },

  clearWatch(id: number | null) {
    if (id !== null) listeners.delete(id);
    if (listeners.size === 0 && browserWatchId !== null) {
      navigator.geolocation.clearWatch(browserWatchId);
      browserWatchId = null;
    }
  },
};

async function enrichAddress(location: LocationData): Promise<void> {
  // Cache nearby address labels and rate-limit the optional lookup.
  if (addressRequestRunning || Date.now() - lastAddressRequestAt < 1_100) return;
  addressRequestRunning = true;
  lastAddressRequestAt = Date.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' }, signal: controller.signal },
    );
    if (!response.ok) return;
    const data = await response.json();
    if (!data.display_name) return;
    const addr = data.address || {};
    const address = [addr.road || addr.pedestrian || addr.suburb, addr.city || addr.town || addr.village || addr.county, addr.state]
      .filter(Boolean).join(', ') || data.display_name.split(',').slice(0, 3).join(',');
    const key = addressKey(location);
    if (addresses.size >= 100) addresses.clear();
    addresses.set(key, { address, expiresAt: Date.now() + 300_000 });
    if (latestLocation && addressKey(latestLocation) === key) publish({ ...latestLocation, address });
  } catch {
    // The coordinate label remains usable when the address service is unavailable.
  } finally {
    window.clearTimeout(timeout);
    addressRequestRunning = false;
  }
}
