import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { manualReview, triageIncident, validAnalysis } from '../src/services/mlTriage.ts';
import { resolveContext, distanceMeters } from '../src/services/incidentAnalytics.ts';
import { presentIncident } from '../src/services/presentIncident.ts';

let service: Server;
let reply: unknown = null;
before(async () => {
  service = createServer(async (req, res) => {
    for await (const _part of req) { /* consume multipart request */ }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(reply));
  });
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve));
});
after(() => new Promise<void>(resolve => service.close(() => resolve())));

test('missing ML configuration never fabricates a confidence', async () => {
  delete process.env.ML_SERVICE_URL;
  const input = { title: 'Fire', description: 'Smoke', categoryHint: 'FIRE' };
  const a = await triageIncident(input);
  assert.equal(a.confidence, null);
  assert.equal(a.source, 'manual_review');
  assert.equal(a.department, 'FIRE_DEPARTMENT');
  assert.deepEqual(a, await triageIncident(input));
});

test('malformed model response falls back to visible manual review', async () => {
  const address = service.address();
  assert.ok(address && typeof address === 'object');
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${address.port}`;
  reply = { confidence: 99, detectedCategory: 'FIRE' };
  const result = await triageIncident({ description: 'Report' });
  assert.equal(result.source, 'manual_review');
  assert.equal(result.confidence, null);
  assert.match(result.reasoning, /could not be validated/);
  reply = manualReview({ description: '' }, 'Training required.');
  assert.ok(validAnalysis(reply as ReturnType<typeof manualReview>));
});

test('model-ready claims require real distributions and provenance', () => {
  const manual = manualReview({ description: '' }, 'Not trained');
  assert.equal(validAnalysis({ ...manual, source: 'ml' }), false);
  assert.equal(validAnalysis({ ...manual, source: 'ml', image: { status: 'ready', modelVersion: 'test', probabilities: { FIRE: 9 } } }), false);
});

test('pretrained suggestions require uncalibrated provenance and human review', () => {
  const result = { ...manualReview({ description: '' }, ''), source: 'ml' as const, needsReview: true,
    text: { status: 'ready', modelVersion: 'fixture', category: 'FIRE' as const,
      categoryProbabilities: { FIRE: 1 }, probabilities: { HIGH: 1 }, inferenceMode: 'pretrained_zero_shot' as const,
      calibrated: false, trainedOnRapidResQ: false, scoreType: 'relative_candidate_score' } };
  assert.equal(validAnalysis(result), true);
  assert.equal(validAnalysis({ ...result, needsReview: false }), false);
  assert.equal(validAnalysis({ ...result, text: { ...result.text, calibrated: true } }), false);
  assert.equal(validAnalysis({ ...result, text: { ...result.text, categoryProbabilities: { FIRE: NaN } } }), false);
});

test('context comes only from configured geographic zones', () => {
  delete process.env.ML_CONTEXT_ZONES;
  assert.equal(resolveContext(19.04, 73.06), undefined);
  process.env.ML_CONTEXT_ZONES = JSON.stringify([{ lat: 19.04, lng: 73.06, radiusMeters: 300, populatedArea: true, source: 'Reviewed test zone' }]);
  assert.equal(resolveContext(19.04, 73.06)?.populatedArea, true);
  assert.equal(resolveContext(20, 74), undefined);
  assert.ok(distanceMeters({ lat: 19, lng: 73 }, { lat: 19.001, lng: 73 }) > 100);
  delete process.env.ML_CONTEXT_ZONES;
});

test('legacy scores cannot masquerade as trained-model probabilities', () => {
  const incident = { aiAnalysis: { ...manualReview({ description: '' }, ''), source: undefined, confidence: .97 } };
  const normalized = presentIncident(incident as Parameters<typeof presentIncident>[0]);
  assert.equal(normalized.aiAnalysis.confidence, null);
  assert.equal(normalized.aiAnalysis.source, 'legacy');
});


test('MEDIC low confidence must not be presented as an accepted disaster type', () => {
  const base = manualReview({ description: '' }, 'Fixture only');
  const disaster = { status: 'ready', dataset: 'MEDIC' as const, model: 'RapidResQ Disaster Classifier',
    modelVersion: 'fixture', incidentType: null, confidence: .4, threshold: .7,
    lowConfidence: true, needsReview: true,
    probabilities: { earthquake: .1, flood: .1, hurricane: .1, fire: .4, landslide: .1, not_disaster: .1, other_disaster: .1 } };
  assert.equal(validAnalysis({ ...base, disaster }), true);
  assert.equal(validAnalysis({ ...base, disaster: { ...disaster, incidentType: 'Fire' } }), false);
  assert.equal(validAnalysis({ ...base, disaster: { ...disaster, confidence: 9 } }), false);
});

test('video details reject invented audio analysis and invalid timestamps', () => {
  const base = manualReview({ description: '' }, 'Fixture only');
  const video = { status: 'ready', method: 'sampled_frames', sampledFrameCount: 1, analyzedFrameCount: 1,
    audioAnalyzed: false, explanation: 'Fixture', frames: [{ timestampSeconds: 1, status: 'ready', label: 'FIRE', confidence: .8, uncertain: false }] };
  assert.equal(validAnalysis({ ...base, video }), true);
  assert.equal(validAnalysis({ ...base, video: { ...video, audioAnalyzed: true } }), false);
  assert.equal(validAnalysis({ ...base, video: { ...video, frames: [{ ...video.frames[0], timestampSeconds: NaN }] } }), false);
});
