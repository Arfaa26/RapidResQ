import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { incidentStore } from '../src/services/incidentStore.ts';
import { manualReview } from '../src/services/mlTriage.ts';
import type { Incident, DuplicateMatch } from '../src/types/index.ts';

// Execute the production SQL in real embedded PostgreSQL. No external database is contacted.
const db = new PGlite();
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
delete process.env.VERCEL;
neonConfig.fetchFunction = async (_url: unknown, options: RequestInit) => {
  const { query, params } = JSON.parse(String(options.body));
  try {
    const result = await db.query(query, params);
    return Response.json({ fields: result.fields, rows: result.rows.map((row: any) => result.fields.map(field => {
      const value = row[field.name];
      return value === null ? null : typeof value === 'object' ? JSON.stringify(value) : String(value);
    })), command: query.trim().split(/\s+/)[0], rowCount: result.affectedRows });
  } catch (e: any) {
    return Response.json({ message: e.message, code: e.code || 'XX000' }, { status: 400 });
  }
};
after(async () => { neonConfig.fetchFunction = undefined; delete process.env.DATABASE_URL; await db.close(); });

function incident(id: string, parent?: string, priority: Incident['priority'] = 'HIGH'): Incident {
  const now = new Date().toISOString();
  const match: DuplicateMatch = { incidentId: parent || '', distanceMeters: 20, timeDifferenceMinutes: 1,
    textSimilarity: 1, imageHashDistance: null, locationUncertain: false, reason: 'Test fixture' };
  return { id, title: `Report ${id}`, description: 'Reported evidence retained', category: 'CIVIC', priority,
    department: 'MUNICIPALITY', status: 'PENDING', location: { lat: 19.04, lng: 73.06, address: 'Test' },
    reportedBy: { name: 'Test', phone: '', isAnonymous: false }, aiAnalysis: manualReview({ description: '' }, ''),
    timeline: [], createdAt: now, updatedAt: now, reportCount: 1,
    ...(parent ? { duplicate: { status: 'POSSIBLE' as const, of: parent, match } } : {}) };
}

test('PostgreSQL duplicate confirmation is atomic, idempotent, and preserves evidence', async () => {
  await incidentStore.createIncident(incident('parent'));
  await incidentStore.createIncident(incident('child', 'parent', 'CRITICAL'));
  const result = await incidentStore.reviewDuplicate('child', 'CONFIRM', 'Test authority');
  assert.equal(result?.duplicate?.status, 'CONFIRMED');
  assert.equal(result?.description, 'Reported evidence retained');
  assert.equal((await incidentStore.getIncidentById('parent'))?.reportCount, 2);
  assert.equal((await incidentStore.getIncidentById('parent'))?.priority, 'CRITICAL');
  assert.equal(await incidentStore.reviewDuplicate('child', 'CONFIRM', 'Repeat request'), null);
  assert.equal((await incidentStore.getIncidentById('parent'))?.reportCount, 2);
  assert.equal((await incidentStore.getAllIncidents()).length, 2);
  assert.equal((await incidentStore.getStats()).total, 1);
});

test('concurrent confirmations increment exactly once per report', async () => {
  await incidentStore.createIncident(incident('child2', 'parent'));
  await incidentStore.createIncident(incident('child3', 'parent'));
  await Promise.all([incidentStore.reviewDuplicate('child2', 'CONFIRM', 'A'), incidentStore.reviewDuplicate('child3', 'CONFIRM', 'B')]);
  assert.equal((await incidentStore.getIncidentById('parent'))?.reportCount, 4);
});

test('reject keeps independent incident; resolved and self targets cannot be grouped', async () => {
  await incidentStore.createIncident(incident('rejected', 'parent'));
  assert.equal((await incidentStore.reviewDuplicate('rejected', 'REJECT', 'A'))?.duplicate?.status, 'REJECTED');
  assert.equal((await incidentStore.getIncidentById('parent'))?.reportCount, 4);
  await incidentStore.createIncident(incident('self', 'self'));
  assert.equal(await incidentStore.reviewDuplicate('self', 'CONFIRM', 'A'), null);
  await incidentStore.updateIncidentStatus('parent', 'RESOLVED', 'Resolved', 'A');
  await incidentStore.createIncident(incident('late', 'parent'));
  assert.equal(await incidentStore.reviewDuplicate('late', 'CONFIRM', 'A'), null);
  assert.equal((await incidentStore.getIncidentById('child'))?.status, 'RESOLVED');
  assert.equal((await incidentStore.getIncidentById('child'))?.timeline.at(-1)?.note, 'Resolved');
});
