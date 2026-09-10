import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

// Import the same ESM entry point that Vercel loads, without starting port 5000.
process.env.VERCEL = '1';
const { default: app } = await import('../../api/index.ts');
delete process.env.VERCEL;
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.GEMINI_API_KEY;
let server: Server;
let base = '';

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}/api`;
});
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

function report(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: 'Automated report delivery check', description: 'Road damage test', categoryHint: 'CIVIC',
    lat: '19.04', lng: '73.06', address: 'Test coordinates', locationSource: 'GPS',
    accuracyMeters: '178', capturedAt: new Date().toISOString(), reporterName: 'Test reporter',
    reporterPhone: 'TEST', isAnonymous: 'false', ...overrides,
  })) form.append(key, value);
  return form;
}

test('Vercel entry point loads as ESM and health is reachable', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).storage, 'local-demo');
});

test('178 m report is received with its message and location; authority status reaches the citizen', async () => {
  const createdResponse = await fetch(`${base}/incidents`, { method: 'POST', body: report({ isAnonymous: 'true' }) });
  assert.equal(createdResponse.status, 201);
  const { incident } = await createdResponse.json();
  assert.equal(incident.reportedBy.isAnonymous, false);
  const authority = await fetch(`${base}/incidents?department=${incident.department}`);
  assert.equal(authority.headers.get('cache-control'), 'no-store');
  const received = (await authority.json()).incidents.find((value: any) => value.id === incident.id);
  assert.equal(received.description, 'Road damage test');
  assert.equal(received.location.lat, 19.04);
  assert.equal(received.location.lng, 73.06);
  assert.equal(received.location.accuracyMeters, 178);
  assert.ok(received.location.capturedAt);
  const body = new FormData();
  body.append('status', 'ACKNOWLEDGED');
  body.append('note', 'Authority received coordinates');
  const update = await fetch(`${base}/incidents/${incident.id}/status`, { method: 'PATCH', body });
  assert.equal(update.status, 200);
  const citizen = (await (await fetch(`${base}/incidents/${incident.id}`)).json()).incident;
  assert.equal(citizen.status, 'ACKNOWLEDGED');
  assert.equal(citizen.timeline.at(-1).note, 'Authority received coordinates');
});

test('approximate SOS location is accepted and priority stays critical', async () => {
  const response = await fetch(`${base}/incidents`, { method: 'POST', body: report({ accuracyMeters: '1200', isEmergencySOS: 'true' }) });
  assert.equal(response.status, 201);
  const { incident } = await response.json();
  assert.equal(incident.priority, 'CRITICAL');
  assert.equal(incident.location.accuracyMeters, 1200);
});

test('recent stationary-device reading preserves its original capture time', async () => {
  const capturedAt = new Date(Date.now() - 180_000).toISOString();
  const response = await fetch(`${base}/incidents`, { method: 'POST', body: report({ capturedAt }) });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).incident.location.capturedAt, capturedAt);
});

test('invalid or stale GPS is rejected without a fake location', async () => {
  for (const changes of [
    { lat: '' }, { lat: 'NaN' }, { lng: '181' }, { accuracyMeters: '-1' },
    { capturedAt: new Date(Date.now() - 420_000).toISOString() }, { locationSource: 'FALLBACK' },
  ]) {
    const response = await fetch(`${base}/incidents`, { method: 'POST', body: report(changes) });
    assert.equal(response.status, 400);
  }
});

test('serverless instance without a database reports failure instead of accepting volatile reports', async () => {
  process.env.VERCEL = '1';
  try {
    assert.equal((await fetch(`${base}/health`)).status, 503);
    assert.notEqual((await fetch(`${base}/incidents`, { method: 'POST', body: report() })).status, 201);
  } finally {
    delete process.env.VERCEL;
  }
});
