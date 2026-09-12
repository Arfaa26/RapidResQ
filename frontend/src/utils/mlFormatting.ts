import type { AIAnalysisResult } from '../types';

export const isPretrained = (analysis: AIAnalysisResult) => [analysis.image, analysis.text].some(m => m?.inferenceMode === 'pretrained_zero_shot');

export const formatConfidence = (analysis: AIAnalysisResult) => analysis.source === 'ml' && analysis.confidence !== null
  ? `${(analysis.confidence * 100).toFixed(1)}% ${analysis.image?.modelVersion?.startsWith('medic-') ? 'category model score · authority review required' : isPretrained(analysis) ? 'category match score · uncalibrated' : 'category probability'}`
  : 'Category requires review';
