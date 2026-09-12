import type { Incident } from '../types/index.js';

export function presentIncident(incident: Incident): Incident {
  if (incident.aiAnalysis.source) return incident;
  return { ...incident, aiAnalysis: { ...incident.aiAnalysis, confidence: null, source: 'legacy',
    needsReview: true, reasoning: 'Legacy triage record; no verifiable trained-model provenance. ' + incident.aiAnalysis.reasoning } };
}

export function resolveGroupedReports(incidents: Incident[]): Incident[] {
  const byId = new Map(incidents.map(i => [i.id, i]));
  return incidents.map(i => {
    const parent = i.duplicate?.status === 'CONFIRMED' ? byId.get(i.duplicate.of) : undefined;
    const result = parent ? { ...i, status: parent.status, assignedUnit: parent.assignedUnit,
      updatedAt: parent.updatedAt > i.updatedAt ? parent.updatedAt : i.updatedAt,
      timeline: [...i.timeline, ...parent.timeline.filter(t => t.timestamp > (i.duplicate?.reviewedAt || i.createdAt))]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)) } : i;
    return presentIncident(result);
  });
}
