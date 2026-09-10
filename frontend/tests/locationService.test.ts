import assert from 'node:assert/strict';
import { test } from 'node:test';

let testId = 0;
async function setup(t: any) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-09-10T12:00:00Z') });
  let onPosition: (value: any) => void = () => undefined;
  let onError: (value: any) => void = () => undefined;
  const geolocation = {
    watchPosition: t.mock.fn((success: any, failure: any) => { onPosition = success; onError = failure; return 1; }),
    clearWatch: t.mock.fn(),
    getCurrentPosition: t.mock.fn((success: any) => { onPosition = success; }),
  };
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.mock.method(globalThis, 'fetch', () => new Promise(() => undefined));
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    Reflect.deleteProperty(globalThis, 'window');
  });
  const { locationService, isFreshLiveLocation } = await import(`../src/services/locationService.ts?test=${++testId}`);
  const position = (accuracy = 178, age = 0, lat = 19.04) => onPosition({
    coords: { latitude: lat, longitude: 73.06, accuracy }, timestamp: Date.now() - age,
  });
  return { locationService, isFreshLiveLocation, geolocation, position, error: (code: number) => onError({ code }) };
}

test('178 m reading submits immediately despite slow address lookup and a later GPS timeout', async (t) => {
  const env = await setup(t);
  const updates: any[] = [];
  env.locationService.watchLiveLocation((location: any) => updates.push(location));
  env.position();
  env.error(3);
  const location = await env.locationService.getAccurateCurrentLocation();
  assert.equal(location.accuracyMeters, 178);
  assert.equal(location.lat, 19.04);
  assert.match(location.address, /GPS:/);
  assert.equal(updates.length, 1);
  assert.equal(env.geolocation.watchPosition.mock.callCount(), 1);
  assert.equal(env.geolocation.getCurrentPosition.mock.callCount(), 0);
});

test('simultaneous submissions share acquisition and accept an approximate fix', async (t) => {
  const env = await setup(t);
  const first = env.locationService.getAccurateCurrentLocation();
  const second = env.locationService.getAccurateCurrentLocation();
  env.position(1200);
  assert.equal((await first).accuracyMeters, 1200);
  assert.deepEqual(await first, await second);
  assert.equal(env.geolocation.watchPosition.mock.callCount(), 1);
  assert.equal(env.geolocation.clearWatch.mock.callCount(), 1);
});

test('stationary device keeps its timestamped last reading available for reporting', async (t) => {
  const env = await setup(t);
  env.locationService.watchLiveLocation(() => undefined);
  env.position();
  const capturedAt = new Date().toISOString();
  t.mock.timers.tick(180_000);
  env.error(3);
  const location = await env.locationService.getAccurateCurrentLocation();
  assert.equal(location.accuracyMeters, 178);
  assert.equal(location.capturedAt, capturedAt);
  assert.equal(env.geolocation.getCurrentPosition.mock.callCount(), 0);
});

test('expired stationary location requests a new reading; delayed readings never move the pin backwards', async (t) => {
  const env = await setup(t);
  env.locationService.watchLiveLocation(() => undefined);
  env.position();
  t.mock.timers.tick(301_000);
  const fresh = env.locationService.getAccurateCurrentLocation();
  assert.equal(env.geolocation.getCurrentPosition.mock.callCount(), 1);
  env.position(100, 0, 19.05);
  assert.equal((await fresh).lat, 19.05);
  env.position(1, 10_000, 19.01);
  assert.equal((await env.locationService.getAccurateCurrentLocation()).lat, 19.05);
});

test('permission denial clears the cached fix and does not send invented coordinates', async (t) => {
  const env = await setup(t);
  env.locationService.watchLiveLocation(() => undefined);
  env.position();
  env.error(1);
  const pending = env.locationService.getAccurateCurrentLocation();
  const rejected = assert.rejects(pending, /permission is blocked/);
  env.error(1);
  await rejected;
});

test('manual refresh obtains a new reading and survives a transient shared-watch timeout', async (t) => {
  const env = await setup(t);
  env.locationService.watchLiveLocation(() => undefined);
  env.position();
  t.mock.timers.tick(5_000);
  const refreshed = env.locationService.getAccurateCurrentLocation({ forceRefresh: true });
  assert.equal(env.geolocation.getCurrentPosition.mock.callCount(), 1);
  env.error(3);
  env.position(50, 0, 19.07);
  assert.equal((await refreshed).lat, 19.07);
});

test('missing GPS has a bounded timeout and cleans up the browser watch', async (t) => {
  const env = await setup(t);
  const pending = env.locationService.getAccurateCurrentLocation();
  const rejected = assert.rejects(pending, /No recent location/);
  t.mock.timers.tick(10_000);
  await rejected;
  assert.equal(env.geolocation.clearWatch.mock.callCount(), 1);
});

test('freshness rejects fallback, stale, future, and invalid locations', async (t) => {
  const env = await setup(t);
  const good = { source: 'GPS', lat: 19.04, lng: 73.06, accuracyMeters: 178, capturedAt: new Date().toISOString() };
  assert.equal(env.isFreshLiveLocation(good), true);
  for (const change of [
    { source: 'FALLBACK' }, { lat: 100 }, { lng: Infinity }, { accuracyMeters: -1 },
    { capturedAt: new Date(Date.now() - 301_000).toISOString() },
    { capturedAt: new Date(Date.now() + 1_000).toISOString() },
  ]) assert.equal(env.isFreshLiveLocation({ ...good, ...change }), false);
});
