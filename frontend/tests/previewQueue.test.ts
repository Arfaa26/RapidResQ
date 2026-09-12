import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewQueue } from '../src/services/previewQueue.ts';

test('rapid edits never overlap cloud requests and skip replaced drafts', async () => {
  const queue = createPreviewQueue<string>();
  const first = new AbortController();
  const replaced = new AbortController();
  const latest = new AbortController();
  const started: string[] = [];
  let finish!: (value: string) => void;
  const initial = queue.run(() => { started.push('first'); return new Promise(resolve => { finish = resolve; }); }, first.signal);
  await Promise.resolve();
  first.abort();
  const stale = queue.run(async () => { started.push('stale'); return 'stale'; }, replaced.signal);
  replaced.abort();
  const current = queue.run(async () => { started.push('latest'); return 'latest'; }, latest.signal);
  assert.deepEqual(started, ['first']);
  finish('old');
  await initial;
  assert.equal(await stale, undefined);
  assert.equal(await current, 'latest');
  assert.deepEqual(started, ['first', 'latest']);
});

test('a failed preview does not prevent an explicit retry', async () => {
  const queue = createPreviewQueue<string>();
  const signal = new AbortController().signal;
  await assert.rejects(queue.run(async () => { throw new Error('busy'); }, signal));
  assert.equal(await queue.run(async () => 'ready', signal), 'ready');
});
