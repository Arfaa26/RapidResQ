import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gradioRequest } from '../src/services/gradioClient.js';

test('free hosting transport encodes media and reads chunked SSE without exposing the key in URLs', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.ok(!url.includes('test-key'));
    if (init?.method === 'POST') {
      const request = JSON.parse(init.body as string);
      assert.equal(request.data[0].body.media, 'YWJj');
      assert.equal(request.data[0].body.mimeType, 'image/png');
      assert.equal(request.data[1], 'test-key');
      return Response.json({ event_id: 'abc123' });
    }
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({ start(controller) {
      for (const part of ['event: heartbeat\ndata: null\n\n', 'event: com', 'plete\ndata: [{"source":"ml"}]\n\n']) controller.enqueue(encoder.encode(part));
      controller.close();
    } }));
  });
  const prior = process.env.ML_SERVICE_KEY;
  process.env.ML_SERVICE_KEY = 'test-key';
  try {
    const form = new FormData();
    form.append('media', new Blob(['abc'], { type: 'image/png' }), 'evidence.png');
    assert.deepEqual(await gradioRequest('https://example.invalid', '/analyze', form, AbortSignal.timeout(1000)), { source: 'ml' });
  } finally {
    if (prior === undefined) delete process.env.ML_SERVICE_KEY;
    else process.env.ML_SERVICE_KEY = prior;
  }
});

for (const [name, stream] of [
  ['quota or inference error', 'event: error\ndata: null\n\n'],
  ['incomplete result', 'event: heartbeat\ndata: null\n\n'],
]) test(`free hosting transport rejects ${name}`, async t => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? Response.json({ event_id: 'abc123' }) : new Response(stream));
  await assert.rejects(gradioRequest('https://example.invalid', '/health', undefined, AbortSignal.timeout(1000)));
});
