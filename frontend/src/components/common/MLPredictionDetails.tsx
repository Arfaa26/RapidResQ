import type { AIAnalysisResult } from '../../types';
import { formatConfidence } from '../../utils/mlFormatting';

export function MLPredictionDetails({ analysis, compact = false }: { analysis: AIAnalysisResult; compact?: boolean }) {
  return <section aria-label="ML prediction details" className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-2 font-semibold">
      <span>{analysis.source === 'ml' ? 'ML recommendation' : analysis.source === 'demo' ? 'Demo scenario' : 'Manual review'}</span>
      <span>• {analysis.detectedCategory}</span>
      <span>• {analysis.priority}</span>
    </div>
    <p>{formatConfidence(analysis)}</p>
    {analysis.needsReview && <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">Authority review required. {analysis.status === 'training_required' ? 'Model training is required.' : ''}</p>}
    <p>Department: {analysis.department.replaceAll('_', ' ')}</p>
    <p className="leading-relaxed">{analysis.reasoning}</p>
    {analysis.image && <div>
      <h4 className="font-bold">Image: {analysis.image.status.replaceAll('_', ' ')}</h4>
      {analysis.image.top3?.map(p => <div key={p.label} className="mt-1 flex items-center gap-3">
        <span className="w-24 shrink-0">{p.label}</span>
        <progress aria-label={`${p.label} probability`} value={p.probability} max={1} className="h-2 min-w-0 flex-1 accent-purple-500" />
        <span>{(p.probability * 100).toFixed(1)}%</span>
      </div>)}
      {analysis.image.gradCam && <figure className="mt-3">
        <img src={analysis.image.gradCam} alt="Grad-CAM activation on the image crop analyzed by the model" className="max-w-full w-56 rounded-lg" />
        <figcaption className="mt-1">Grad-CAM: model attention on the analyzed crop; it does not prove the incident type.</figcaption>
      </figure>}
    </div>}
    {analysis.text && <div>
      <h4 className="font-bold">Text: {analysis.text.status.replaceAll('_', ' ')}</h4>
      {analysis.text.severityScore != null && <p>Severity score: {analysis.text.severityScore.toFixed(3)} / 1 · {analysis.text.priority}</p>}
      {analysis.text.confidence != null && <p>Priority class probability: {(analysis.text.confidence * 100).toFixed(1)}%</p>}
    </div>}
    {!compact && <details className="rounded-lg border border-current/20 p-3">
      <summary className="cursor-pointer font-semibold">Model versions and explanation</summary>
      <div className="mt-3 space-y-2 break-words">
        <p>Image version: {analysis.image?.modelVersion || 'Not trained'}</p>
        <p>Text version: {analysis.text?.modelVersion || 'Not trained'}</p>
        {analysis.latencyMs != null && <p>Analysis time: {analysis.latencyMs.toFixed(1)} ms (ML service only)</p>}
        {analysis.fusion?.score != null && <p>Fusion policy score: {analysis.fusion.score.toFixed(3)} · {analysis.fusion.version}. This is a decision score, not a probability.</p>}
        {analysis.text?.features?.length ? <>
          <p>Text features contributing to the predicted priority (positive supports, negative opposes):</p>
          <ul className="list-disc pl-5">{analysis.text.features.map(f => <li key={f.feature}>{f.feature}: {f.contribution.toFixed(3)}</li>)}</ul>
        </> : null}
      </div>
    </details>}
  </section>;
}
