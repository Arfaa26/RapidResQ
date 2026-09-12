import type { AIAnalysisResult } from '../../types';
import { formatConfidence, isPretrained } from '../../utils/mlFormatting';

export function MLPredictionDetails({ analysis, compact = false }: { analysis: AIAnalysisResult; compact?: boolean }) {
  const pretrained = isPretrained(analysis);
  return <section aria-label="ML prediction details" className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-2 font-semibold">
      <span>{analysis.source === 'ml' ? pretrained ? 'Pretrained ML suggestion' : 'ML recommendation' : analysis.source === 'demo' ? 'Demo scenario' : 'Manual review'}</span>
      <span>• {analysis.detectedCategory}</span>
      <span>• {analysis.priority}</span>
    </div>
    <p>{formatConfidence(analysis)}</p>
    {pretrained && <p>These models have not been trained or validated on RapidResQ incident data. Match scores are not probabilities of danger.</p>}
    {analysis.needsReview && <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">Authority review required. {analysis.status === 'training_required' ? 'Model training is required.' : ''}</p>}
    <p>Department: {analysis.department.replaceAll('_', ' ')}</p>
    <p className="leading-relaxed">{analysis.reasoning}</p>
    {analysis.image && <div>
      <h4 className="font-bold">Image: {analysis.image.status === 'unsupported_media' ? 'video retained as evidence' : analysis.image.status === 'not_provided' ? 'no photo attached' : analysis.image.status.replaceAll('_', ' ')}</h4>
      {analysis.image.status === 'unsupported_media' && <p>Video frames are not analyzed. Text analysis can still run when a description is provided.</p>}
      {analysis.image.uncertain && <p>Image category is uncertain. Review the photo and description together.</p>}
      {analysis.image.top3?.map(p => <div key={p.label} className="mt-1 flex items-center gap-3">
        <span className="w-24 shrink-0">{p.label}</span>
        <progress aria-label={`${p.label} ${pretrained ? 'match score' : 'probability'}`} value={p.probability} max={1} className="h-2 min-w-0 flex-1 accent-purple-500" />
        <span>{(p.probability * 100).toFixed(1)}%</span>
      </div>)}
      {analysis.image.explanationStatus === 'not_supported' && <p>Photo analysis is available; this model does not generate an attention heatmap.</p>}
      {analysis.image.gradCam && <figure className="mt-3">
        <img src={analysis.image.gradCam} alt="Grad-CAM activation on the image crop analyzed by the model" className="max-w-full w-56 rounded-lg" />
        <figcaption className="mt-1">Grad-CAM: model attention on the analyzed crop; it does not prove the incident type.</figcaption>
      </figure>}
    </div>}
    {analysis.text && <div>
      <h4 className="font-bold">Text: {analysis.text.status.replaceAll('_', ' ')}</h4>
      {analysis.text.priorityUncertain && <p>Insufficient certainty to infer urgency. Authority review required.</p>}
      {analysis.text.severityScore != null && <p>Severity score: {analysis.text.severityScore.toFixed(3)} / 1 · {analysis.text.priority}</p>}
      {analysis.text.confidence != null && <p>{pretrained ? 'Highest urgency-description match score' : 'Priority class probability'}: {(analysis.text.confidence * 100).toFixed(1)}%</p>}
    </div>}
    {!compact && <details className="rounded-lg border border-current/20 p-3">
      <summary className="cursor-pointer font-semibold">Model versions and explanation</summary>
      <div className="mt-3 space-y-2 break-words">
        <p>Image version: {analysis.image?.modelVersion || 'Unavailable'}</p>
        <p>Text version: {analysis.text?.modelVersion || 'Unavailable'}</p>
        {analysis.image?.explanation && <p>{analysis.image.explanation}</p>}
        {analysis.text?.explanation && <p>{analysis.text.explanation}</p>}
        {analysis.text?.hypotheses && <ul className="space-y-2">{analysis.text.hypotheses.map(h => <li key={h.label}><strong>{h.label}: {(h.score * 100).toFixed(1)}%</strong> · {h.description}</li>)}</ul>}
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
