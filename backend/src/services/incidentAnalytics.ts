import type { Incident, DuplicateMatch, DuplicateCheck, HotspotResult } from '../types/index.js';
import { mlRequest } from './mlClient.js';

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function resolveContext(lat: number, lng: number): { populatedArea: boolean; source: string } | undefined {
  try {
    const zones = JSON.parse(process.env.ML_CONTEXT_ZONES || '[]') as Array<{ lat: number; lng: number; radiusMeters: number; source: string; populatedArea: boolean }>;
    if (!Array.isArray(zones)) return undefined;
    const zone = zones.find(z => z.populatedArea === true && typeof z.source === 'string' && z.source.trim()
      && Number.isFinite(z.lat) && Math.abs(z.lat) <= 90 && Number.isFinite(z.lng) && Math.abs(z.lng) <= 180
      && Number.isFinite(z.radiusMeters) && z.radiusMeters > 0 && z.radiusMeters <= 100000
      && distanceMeters({ lat, lng }, z) <= z.radiusMeters);
    return zone ? { populatedArea: true, source: zone.source.slice(0, 300) } : undefined;
  } catch { return undefined; }
}

const compact = (i: Incident) => ({
  id: i.id,
  title: i.reportText?.title ?? i.title.slice(0, 500),
  description: i.reportText?.description ?? i.description.slice(0, 10000), category: i.category,
  location: i.location, createdAt: i.createdAt, imageHash: i.aiAnalysis.imageHash || null,
});

export async function checkDuplicates(incident: Incident, existing: Incident[]): Promise<DuplicateCheck> {
  const candidates = existing.filter(i => !i.isDemo && i.status !== 'RESOLVED' && !['POSSIBLE', 'CONFIRMED'].includes(i.duplicate?.status || '')
    && Math.abs(Date.parse(i.createdAt) - Date.parse(incident.createdAt)) <= 7200000
    && distanceMeters(i.location, incident.location) <= 200);
  if (candidates.length === 0) return { status: 'checked', matches: [], method: 'phash-tfidf-geo-time-v1' };
  try {
    const result = await mlRequest<DuplicateCheck>('/duplicates', { report: compact(incident), candidates: candidates.slice(0, 500).map(compact) });
    if (!Array.isArray(result.matches)) throw new Error('Invalid duplicate response');
    result.matches = result.matches.filter((m: DuplicateMatch) => candidates.some(c => c.id === m.incidentId)
      && Number.isFinite(m.distanceMeters) && m.distanceMeters <= 200
      && Number.isFinite(m.textSimilarity) && m.textSimilarity >= 0 && m.textSimilarity <= 1);
    return { ...result, candidatesTruncated: candidates.length > 500 };
  } catch { return { status: 'unavailable', matches: [], method: 'phash-tfidf-geo-time-v1' }; }
}

export async function analyzeHotspots(incidents: Incident[], days: number): Promise<HotspotResult> {
  const cutoff = Date.now() - days * 86400000;
  const selected = incidents.filter(i => !i.isDemo && i.duplicate?.status !== 'CONFIRMED' && Date.parse(i.createdAt) >= cutoff);
  const result = await mlRequest<HotspotResult>('/hotspots', { days, incidents: selected.slice(0, 5000).map(compact) });
  return { ...result, truncated: selected.length > 5000, excludedDemoCount: incidents.filter(i => i.isDemo).length };
}
