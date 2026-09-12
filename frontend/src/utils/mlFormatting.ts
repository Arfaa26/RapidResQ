import type { AIAnalysisResult } from '../types';

export const formatConfidence = (analysis: AIAnalysisResult) => analysis.source === 'ml' && analysis.confidence !== null
  ? `${(analysis.confidence * 100).toFixed(1)}% category probability` : 'No verified model confidence';
