import type { AIAnalysisResult, IncidentCategory, DepartmentType } from '../types/index.js';
import { mlRequest } from './mlClient.js';

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
  } catch {
    return manualReview(input, 'ML service unavailable or not configured.');
  }
}
