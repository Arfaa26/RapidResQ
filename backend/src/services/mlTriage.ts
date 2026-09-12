import type { AIAnalysisResult, IncidentCategory, DepartmentType } from '../types/index.js';
import { mlRequest, MLUnavailableError } from './mlClient.js';

export const categories = ['FIRE', 'ACCIDENT', 'FLOOD', 'MEDICAL', 'CRIME', 'CIVIC', 'HAZARD'] as const;
export interface TriageInput {
  title?: string;
  description: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  categoryHint?: string;
  context?: { populatedArea: boolean; source: string };
  explain?: boolean;
}

export function manualReview(input: TriageInput, reason: string): AIAnalysisResult {
  const category = categories.includes(input.categoryHint as IncidentCategory) ? input.categoryHint as IncidentCategory : 'HAZARD';
  const routing: Record<IncidentCategory, DepartmentType> = {
    FIRE: 'FIRE_DEPARTMENT', FLOOD: 'FIRE_DEPARTMENT', MEDICAL: 'EMS_AMBULANCE',
    ACCIDENT: 'POLICE_DEPARTMENT', CRIME: 'POLICE_DEPARTMENT', CIVIC: 'MUNICIPALITY', HAZARD: 'MUNICIPALITY',
  };
  return {
    confidence: null, detectedCategory: category, priority: 'HIGH', department: routing[category],
    hazardType: category, extractedKeywords: [], recommendedAction: 'Authority review required before dispatch.',
    reasoning: `${reason} Category uses the citizen selection. HIGH is a manual-review queue policy, not an ML prediction.`,
    source: 'manual_review', status: 'unavailable', needsReview: true,
  };
}

const probability = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
export function validAnalysis(value: AIAnalysisResult): boolean {
  if (!value || !categories.includes(value.detectedCategory) || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value.priority)
    || !['FIRE_DEPARTMENT', 'POLICE_DEPARTMENT', 'EMS_AMBULANCE', 'MUNICIPALITY'].includes(value.department)
    || !(value.confidence === null || probability(value.confidence))
    || typeof value.reasoning !== 'string' || typeof value.hazardType !== 'string'
    || typeof value.recommendedAction !== 'string' || !Array.isArray(value.extractedKeywords)
    || !value.extractedKeywords.every(k => typeof k === 'string')
    || !['ml', 'manual_review'].includes(value.source || '')) return false;
  for (const model of [value.image, value.text]) {
    if (model?.status !== 'ready') continue;
    if (!model.modelVersion || !model.probabilities) return false;
    const values = Object.values(model.probabilities);
    if (!values.length || !values.every(probability) || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > .001) return false;
    if (model.inferenceMode === 'pretrained_zero_shot' && (model.calibrated !== false
      || model.trainedOnRapidResQ !== false || model.scoreType !== 'relative_candidate_score' || value.needsReview !== true)) return false;
    if (model.confidence !== undefined && !probability(model.confidence)) return false;
    if (model.severityScore !== undefined && !probability(model.severityScore)) return false;
  }
  if (value.text?.status === 'ready') {
    const text = value.text;
    if (!text.category || !categories.includes(text.category) || !text.categoryProbabilities) return false;
    const scores = Object.values(text.categoryProbabilities);
    if (!scores.length || !scores.every(probability) || Math.abs(scores.reduce((a, b) => a + b, 0) - 1) > .001) return false;
  }
  if (value.source === 'ml' && value.image?.status !== 'ready' && value.text?.status !== 'ready') return false;
  if (value.image?.status === 'ready' && (value.image.top3?.length !== 3 || !value.image.top3.every(p => probability(p.probability) && categories.includes(p.label as IncidentCategory)))) return false;
  return true;
}

export async function triageIncident(input: TriageInput): Promise<AIAnalysisResult> {
  const form = new FormData();
  form.append('title', String(input.title || '').slice(0, 500));
  form.append('description', String(input.description || '').slice(0, 10000));
  form.append('categoryHint', input.categoryHint || '');
  form.append('context', JSON.stringify(input.context || {}));
  form.append('explain', String(input.explain === true));
  if (input.imageBuffer) form.append('media', new Blob([new Uint8Array(input.imageBuffer)], { type: input.mimeType }), 'report');
  try {
    const result = await mlRequest<AIAnalysisResult>('/analyze', form);
    if (!validAnalysis(result)) return manualReview(input, 'ML response could not be validated.');
    return result;
  } catch (error) {
    if (error instanceof MLUnavailableError && (error.message.startsWith('The free AI host') || error.message.startsWith('The AI host'))) {
      return manualReview(input, error.message);
    }
    return manualReview(input, process.env.ML_SERVICE_URL
      ? 'AI analysis is temporarily unavailable. The host may be busy, starting, or at its usage limit. Retry shortly or submit for authority review.'
      : 'ML service is not configured.');
  }
}
