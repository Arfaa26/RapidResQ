import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatConfidence } from '../src/utils/mlFormatting.ts';
import type { AIAnalysisResult } from '../src/types/index.ts';

test('pretrained scores never appear as verified category probabilities', () => {
  const analysis = { source: 'ml', confidence: .91, image: { inferenceMode: 'pretrained_zero_shot' } } as AIAnalysisResult;
  assert.match(formatConfidence(analysis), /match score.*uncalibrated/);
  assert.doesNotMatch(formatConfidence(analysis), /probability/);
  assert.equal(formatConfidence({ ...analysis, confidence: null }), 'Category requires review');
});
