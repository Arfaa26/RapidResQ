import { useEffect, useState } from 'react';
import type { EvaluationResult, HotspotResult } from '../../types';
import { api } from '../../services/api';
import { InteractiveMap } from '../common/InteractiveMap';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const panel = 'rounded-2xl border border-slate-700 bg-slate-800 p-4 space-y-4';

export function HotspotAnalytics({ revision }: { revision: string }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<HotspotResult | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    api.getHotspots(days).then(result => { if (active) { setData(result); setError(''); } })
      .catch(e => { if (active) { setError(e.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, revision, refresh]);
  return <section className="p-4 space-y-4 text-sm" aria-label="Hotspot analytics">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="mr-auto text-lg font-bold">Incident hotspots</h2>
      <label>Time window <select className="ml-2 rounded-lg bg-slate-700 p-2" value={days} onChange={e => setDays(Number(e.target.value))}>
        <option value={1}>24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option>
      </select></label>
      <button className="rounded-lg bg-purple-600 px-3 py-2" onClick={() => setRefresh(x => x + 1)}>Refresh hotspots</button>
    </div>
    {loading && <p role="status">Updating hotspot analysis…</p>}
    {error && <p role="alert" className="rounded-lg bg-amber-900/30 p-3 text-amber-200">{error}</p>}
    {data && !loading && <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Hotspots', data.hotspots.length], ['Incidents in window', data.incidentCount], ['Outside clusters', data.noiseCount]].map(([label, count]) =>
          <div key={label} className={panel}><p>{label}</p><p className="text-2xl font-bold">{count}</p></div>)}
      </div>
      <p>Observed concentration using DBSCAN: {data.radiusMeters} m neighborhood, at least {data.minSamples} incidents. This does not forecast future emergencies.</p>
      <p>Confirmed duplicates count once. Unconfirmed reports remain separate. Seeded demo incidents are excluded ({data.excludedDemoCount || 0}).</p>
      {data.truncated && <p role="alert" className="text-amber-300">Limited to the latest 5,000 incidents in this window.</p>}
      <InteractiveMap hotspots={data.hotspots} height="360px" />
      {data.hotspots.length === 0 && <p className={panel}>No hotspot meets the clustering threshold in this time window.</p>}
      <div className="grid gap-3 md:grid-cols-2">{data.hotspots.map(h => <article key={h.id} className={panel}>
        <h3 className="font-bold">{h.count} incidents · Main category: {h.mainCategory}</h3>
        <p>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</p>
        <p>{Object.entries(h.categories).map(([c, n]) => `${c}: ${n}`).join(' · ')}</p>
      </article>)}</div>
      <div className={panel}><h3 className="font-bold">Daily incident counts (UTC)</h3>
        <div className="max-h-80 overflow-y-auto space-y-2">{data.trends.map(t => <div key={t.date} className="flex items-center gap-3">
          <span className="w-24 shrink-0">{t.date}</span>
          <progress value={t.count} max={Math.max(1, ...data.trends.map(x => x.count))} className="min-w-0 flex-1 accent-purple-500" aria-label={`${t.date}: ${t.count} incidents`} />
          <span>{t.count}</span>
        </div>)}</div>
      </div>
    </>}
  </section>;
}

export function MLEvaluation() {
  const [models, setModels] = useState<Record<string, EvaluationResult> | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api.getEvaluation().then(result => { if (active) { setModels(result); setError(''); } })
      .catch(e => { if (active) { setError(e.message); setModels(null); } });
    return () => { active = false; };
  }, [refresh]);
  return <section className="p-4 space-y-4 text-sm" aria-label="ML evaluation">
    <div className="flex justify-between gap-3"><h2 className="text-lg font-bold">ML evaluation</h2>
      <button className="rounded-lg bg-purple-600 px-3 py-2" onClick={() => setRefresh(x => x + 1)}>Refresh evaluation</button></div>
    <p>Metrics come from held-out test data and must match the loaded model version.</p>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {!models && !error && <p role="status">Loading evaluation artifacts…</p>}
    {models && Object.entries(models).map(([name, result]) => <article key={name} className={panel}>
      <h3 className="text-base font-bold capitalize">{name} model</h3>
      <p>Status: {result.model.status.replaceAll('_', ' ')}</p>
      {!result.evaluation ? <p className="rounded-lg bg-amber-900/20 p-3 text-amber-200">{result.model.status === 'ready' ? 'Held-out evaluation is required for this model version.' : 'Training and held-out evaluation are required.'} No accuracy values are available.</p> : <>
        <p>{result.evaluation.algorithm} · {result.evaluation.modelVersion}</p>
        <p>{result.evaluation.sampleCount} test samples · Evaluated {new Date(result.evaluation.evaluatedAt).toLocaleString()}</p>
        <p>Latency: mean {result.evaluation.latencyMs.mean.toFixed(1)} ms · p95 {result.evaluation.latencyMs.p95.toFixed(1)} ms</p>
        <p>{result.evaluation.latencyMs.scope}</p>
        <p>Abstentions: {result.evaluation.abstentionCount} (included as errors)</p>
        {Object.entries(result.evaluation.metrics).map(([task, metrics]) => <section key={task} className="space-y-3 border-t border-slate-600 pt-3">
          <h4 className="font-semibold capitalize">{task} classification</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{(['accuracy', 'precision', 'recall', 'f1'] as const).map(key => <div key={key}>
            <p className="capitalize">{key}</p><p className="text-xl font-bold">{percent(metrics[key])}</p>
          </div>)}</div>
          <p>Precision, recall and F1 use macro averaging over the target classes.</p>
          <div className="overflow-x-auto"><table className="w-full text-left"><caption className="mb-2 text-left font-bold">Per-class performance</caption>
            <thead><tr>{['Class', 'Precision', 'Recall', 'F1', 'Samples'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead>
            <tbody>{Object.entries(metrics.perClass).map(([c, m]) => <tr key={c} className="border-t border-slate-700">
              <th className="p-2">{c}</th><td className="p-2">{percent(m.precision)}</td><td className="p-2">{percent(m.recall)}</td><td className="p-2">{percent(m['f1-score'])}</td><td className="p-2">{m.support}</td>
            </tr>)}</tbody></table></div>
          <div className="overflow-x-auto"><table className="w-full text-center"><caption className="mb-2 text-left font-bold">Confusion matrix — rows: actual, columns: predicted</caption>
            <thead><tr><th className="p-2">Actual / Predicted</th>{metrics.labels.map(c => <th className="p-2" key={c}>{c}</th>)}</tr></thead>
            <tbody>{metrics.confusionMatrix.map((row, i) => <tr key={metrics.labels[i]}><th className="p-2">{metrics.labels[i]}</th>{row.map((n, j) => <td key={metrics.labels[j]} className={`p-2 border border-slate-600 ${i === j ? 'bg-purple-900/40' : ''}`}>{n}</td>)}</tr>)}</tbody>
          </table></div>
        </section>)}
      </>}
    </article>)}
  </section>;
}
