import type { AIAnalysisResult } from '../../types';
import { formatConfidence, isPretrained } from '../../utils/mlFormatting';

export function MLPredictionDetails({ analysis, compact = false }: { analysis: AIAnalysisResult; compact?: boolean }) {
  const pretrained = isPretrained(analysis);
  return <section aria-label="ML prediction details" className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-2 font-semibold">
      <span>{analysis.source === 'ml' ? analysis.disaster?.status === 'ready' ? 'ML-assisted triage' : pretrained ? 'Pretrained ML suggestion' : 'ML recommendation' : analysis.source === 'demo' ? 'Demo scenario' : 'Manual review'}</span>
      <span>• {analysis.detectedCategory}</span>
      <span>• {analysis.priority} ({({ CRITICAL: 'P1', HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' })[analysis.priority]})</span>
    </div>
    <p>{formatConfidence(analysis)}</p>
    {pretrained && <p>General scene and text models use pretrained matching. Their match scores are not probabilities of danger.</p>}
    {analysis.needsReview && <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">Authority review required. {analysis.status === 'training_required' ? 'Model training is required.' : ''}</p>}
    <p>Department: {analysis.department.replaceAll('_', ' ')}</p>
    <p className="leading-relaxed">{analysis.reasoning}</p>
    {analysis.disaster && <div className="rounded-xl border border-current/20 p-3">
      <h4 className="font-bold">Disaster analysis · MEDIC</h4>
      {analysis.disaster.status === 'ready' ? <>
        <p>{analysis.disaster.incidentType || 'Low confidence — Manual verification required.'}</p>
        {analysis.disaster.confidence != null && <p>Model confidence: {(analysis.disaster.confidence * 100).toFixed(1)}%</p>}
        <p>{analysis.disaster.message}</p>
      </> : <p>MEDIC-trained model is not available. Other analysis, when available, is shown separately.</p>}
    </div>}
    {analysis.video && <div className="rounded-xl border border-current/20 p-3">
      <h4 className="font-bold">Video analysis</h4>
      <p>{analysis.video.analyzedFrameCount} frames analyzed{analysis.video.durationSeconds ? ` from a ${analysis.video.durationSeconds.toFixed(1)} second clip` : ''}.</p>
      <p>{analysis.video.explanation}</p>
      {analysis.video.disagreement && <p>Frames suggest different scenes. Manual verification required.</p>}
      <ol className="mt-2 space-y-1">{analysis.video.frames.map((frame, i) => <li key={i}>
        {frame.timestampSeconds.toFixed(1)}s · {frame.label || frame.status}{frame.uncertain ? ' · uncertain' : ''}
      </li>)}</ol>
      {analysis.video.eventModel?.status === 'ready' && <p>Experimental event model: {analysis.video.eventModel.label} · authority review required.</p>}
    </div>}
    {analysis.objects && <div>
      <h4 className="font-bold">Detected objects · YOLOX</h4>
      <p>{analysis.objects.explanation}</p>
      {analysis.objects.status !== 'ready' ? <p>Object detection is unavailable.</p> : analysis.objects.frames.map((frame, i) => <p key={i}>
        {frame.timestampSeconds != null ? `${frame.timestampSeconds.toFixed(1)}s: ` : ''}
        {frame.detections.length ? Object.entries(frame.detections.reduce<Record<string, number>>((counts, d) => ({ ...counts, [d.label]: (counts[d.label] || 0) + 1 }), {})).map(([label, count]) => `${count} ${label}`).join(', ') : 'No supported objects detected above the score threshold.'}
      </p>)}
    </div>}
    {analysis.image && <div>
      <h4 className="font-bold">{analysis.video ? 'Video scenes' : 'Image'}: {analysis.image.status === 'unsupported_media' ? 'unsupported file format' : analysis.image.status === 'not_provided' ? 'no photo attached' : analysis.image.status.replaceAll('_', ' ')}</h4>
      {analysis.image.status === 'unsupported_media' && <p>Use a photo or an MP4, MOV or WebM clip. Text analysis can still run.</p>}
      {analysis.image.uncertain && <p>Visual category is uncertain. Review the media and description together.</p>}
      {analysis.disaster?.status !== 'ready' && analysis.image.top3?.map(p => <div key={p.label} className="mt-1 flex items-center gap-3">
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
        <p>MEDIC version: {analysis.disaster?.modelVersion || 'Unavailable'}</p>
        <p>Object detector: {analysis.objects?.modelVersion || 'Unavailable'}</p>
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
