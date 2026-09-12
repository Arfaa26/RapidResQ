import { useState } from 'react';
import type { Incident } from '../../types';
import { api } from '../../services/api';

export function DuplicateReview({ incident, incidents, onUpdate, onOpen }: {
  incident: Incident; incidents: Incident[]; onUpdate: (incident: Incident) => void; onOpen: (incident: Incident) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const related = incidents.filter(i => i.duplicate?.of === incident.id && i.duplicate.status !== 'REJECTED');
  const target = incidents.find(i => i.id === incident.duplicate?.of);
  const review = async (decision: 'CONFIRM' | 'REJECT') => {
    setBusy(true); setError('');
    try { onUpdate(await api.reviewDuplicate(incident.id, decision)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Review failed.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Duplicate review" className="space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-4 text-sm">
    <h3 className="font-bold">Reports: {incident.reportCount ?? 1} confirmed</h3>
    {incident.duplicateCheck?.status === 'unavailable' && <p className="text-amber-300">Duplicate detection was unavailable at submission. Review nearby reports.</p>}
    {incident.duplicateCheck?.candidatesTruncated && <p className="text-amber-300">Duplicate search was limited to 500 nearby reports.</p>}
    {incident.duplicateCheck?.semanticModel && <p>Semantic text model: {incident.duplicateCheck.semanticModel.status.replaceAll('_', ' ')} · {incident.duplicateCheck.semanticCandidatesChecked ?? 0} candidates checked. Similarity suggests a match; it does not confirm one.</p>}
    {incident.duplicateCheck?.semanticCandidatesTruncated && <p>Semantic matching covered a bounded subset of nearby reports; the remaining reports used word similarity and image hashes.</p>}
    {incident.duplicate ? <>
      <p className="font-semibold">{incident.duplicate.status === 'POSSIBLE' ? 'Possible duplicate of' : incident.duplicate.status === 'CONFIRMED' ? 'Grouped under' : 'Duplicate suggestion rejected for'} {incident.duplicate.of}</p>
      <p>{incident.duplicate.match.reason} · {incident.duplicate.match.distanceMeters.toFixed(0)} m · {incident.duplicate.match.timeDifferenceMinutes.toFixed(1)} minutes apart</p>
      <p>Text similarity: {(incident.duplicate.match.textSimilarity * 100).toFixed(1)}%{incident.duplicate.match.imageHashDistance !== null ? ` · Image hash distance: ${incident.duplicate.match.imageHashDistance}/64 bits` : ''}</p>
      {incident.duplicate.match.locationUncertain && <p className="text-amber-300">GPS uncertainty exceeds the 200 m matching radius.</p>}
      {target && <button type="button" className="text-purple-300 underline" onClick={() => onOpen(target)}>Inspect original report and evidence</button>}
      {incident.duplicate.status === 'POSSIBLE' && <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="rounded-lg bg-purple-600 px-3 py-2 disabled:opacity-50" onClick={() => void review('CONFIRM')}>Confirm same incident</button>
        <button type="button" disabled={busy} className="rounded-lg bg-slate-700 px-3 py-2 disabled:opacity-50" onClick={() => void review('REJECT')}>Keep separate</button>
      </div>}
      {incident.duplicate.status === 'CONFIRMED' && <p>Original evidence is retained. Update dispatch status on the primary incident.</p>}
    </> : <p>{incident.duplicateCheck?.status === 'checked' ? 'No possible duplicate found at submission.' : 'No duplicate assessment recorded.'}</p>}
    {related.length > 0 && <div className="space-y-2"><h4 className="font-semibold">Linked reports</h4>{related.map(r =>
      <button key={r.id} className="block text-left text-purple-300 underline" onClick={() => onOpen(r)}>{r.id} · {r.duplicate?.status} · {r.title}</button>)}</div>}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
  </section>;
}
