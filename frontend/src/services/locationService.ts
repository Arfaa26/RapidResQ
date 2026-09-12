import type { LocationData } from '../types';

// Stationary browsers may stop emitting fixes. Reuse a recent observation,
// preserving its original timestamp so both citizen and dispatcher can assess it.
const MAX_LOCATION_AGE_MS = 5 * 60_000;
export const LIVE_LOCATION_AGE_MS = 15_000;
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
  if (latestLocation && location.capturedAt === latestLocation.capturedAt
    && location.accuracyMeters! > latestLocation.accuracyMeters!) return;
  latestLocation = location;
  listeners.forEach(({ update }) => update(location));
}

function addressKey(location: LocationData) {
  return `${location.lat.toFixed(3)},${location.lng.toFixed(3)}`;
}

function receivePosition(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0
    || Math.abs(position.timestamp) > 8.64e15) return;
  const location: LocationData = {
    lat: latitude,
    lng: longitude,
    address: `GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
    accuracyMeters: Math.ceil(accuracy),
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
    return this.getAccurateCurrentLocation({ forceRefresh: true, refine: true });
  },

  async getAccurateCurrentLocation({ forceRefresh = false, refine = false } = {}): Promise<LocationData> {
    if (!forceRefresh && !refine && latestLocation && isFreshLiveLocation(latestLocation)) return latestLocation;
    if (pendingLocation) return pendingLocation;
    if (!navigator.geolocation) throw new Error('This browser does not support device location.');

    const hadLiveWatch = browserWatchId !== null;
    pendingLocation = new Promise<LocationData>((resolve, reject) => {
      let subscription: number | null = null;
      let best: LocationData | null = null;
      const timeout = window.setTimeout(() => {
        cleanup();
        if (best && isFreshLiveLocation(best, LIVE_LOCATION_AGE_MS)) { resolve(best); return; }
        reject(new Error('No recent location was received. Allow location access, check device location services, and try again.'));
      }, LOCATION_TIMEOUT_MS);
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.clearWatch(subscription);
      };
      subscription = this.watchLiveLocation((location) => {
        if (!isFreshLiveLocation(location, forceRefresh || refine ? LIVE_LOCATION_AGE_MS : MAX_LOCATION_AGE_MS)) return;
        if (!best || location.accuracyMeters! <= best.accuracyMeters!) best = location;
        // Let a coarse network fix improve for up to ten seconds. SOS does not wait for refinement.
        if (refine && best.accuracyMeters! > 50) return;
        cleanup();
        resolve(best);
      }, (error) => {
        // A shared watch timeout must not cancel a new one-shot acquisition.
        if (error instanceof DeviceLocationError && error.code !== 1) return;
        cleanup();
        reject(error);
      });
      // A stationary device may not emit watch updates. Ask for a new reading
      // when its last observation has expired, while still sharing the live feed.
      if (hadLiveWatch || forceRefresh) navigator.geolocation.getCurrentPosition(receivePosition, receiveError, {
        enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0,
      });
    }).finally(() => { pendingLocation = null; });
    return pendingLocation;
  },

  async getReportLocation({ emergency = false } = {}): Promise<LocationData> {
    if (latestLocation && isFreshLiveLocation(latestLocation, LIVE_LOCATION_AGE_MS)
      && (emergency || latestLocation.accuracyMeters! <= 50)) return latestLocation;
    try {
      const location = await this.getAccurateCurrentLocation({ forceRefresh: true, refine: !emergency });
      if (!isFreshLiveLocation(location, LIVE_LOCATION_AGE_MS)) throw new Error('Refresh GPS to capture your current location.');
      return location;
    } catch (error) {
      // Never invent a position or change its timestamp. A denied permission clears this cache.
      if (emergency && latestLocation && isFreshLiveLocation(latestLocation)
        && !(error instanceof DeviceLocationError && error.code === 1)) return latestLocation;
      throw error;
    }
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
        maximumAge: 0,
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
