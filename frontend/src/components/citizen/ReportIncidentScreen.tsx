import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Camera, 
  MapPin, 
  Sparkles, 
  ArrowLeft, 
  Flame, 
  Car, 
  Building, 
  ShieldAlert, 
  Loader2,
  ArrowRight
} from 'lucide-react';
import { Incident, LocationData, AIAnalysisResult, IncidentCategory } from '../../types';
import { MLPredictionDetails } from '../common/MLPredictionDetails';
import { api } from '../../services/api';
import { createPreviewQueue } from '../../services/previewQueue';
import { InteractiveMap } from '../common/InteractiveMap';
import { LiveLocationStatus } from '../common/LiveLocationStatus';
import { soundAlerts } from '../../utils/audioAlert';
import { isFreshLiveLocation, LIVE_LOCATION_AGE_MS, locationService } from '../../services/locationService';

interface ReportIncidentScreenProps {
  onBack: () => void;
  onIncidentSubmitted: (incident: Incident) => void;
  currentLocation: LocationData;
  initialMedia?: File | null;
  initialCaptureMode?: 'photo' | 'video' | null;
}

export const ReportIncidentScreen: React.FC<ReportIncidentScreenProps> = ({
  onBack,
  onIncidentSubmitted,
  currentLocation,
  initialMedia = null,
  initialCaptureMode = null,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>('HAZARD');
  const [acquiredLocation, setAcquiredLocation] = useState<LocationData>(currentLocation);
  const selectedLocation = Date.parse(currentLocation.capturedAt || '') >= Date.parse(acquiredLocation.capturedAt || '')
    ? currentLocation : acquiredLocation;
  const [mediaFile, setMediaFile] = useState<File | null>(initialMedia);
  const [mediaPreview, setMediaPreview] = useState<string | null>(() => (initialMedia ? URL.createObjectURL(initialMedia) : null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [aiError, setAiError] = useState('');
  const [explain, setExplain] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewQueueRef = useRef(createPreviewQueue<AIAnalysisResult>());
  const previewLocationRef = useRef(selectedLocation);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationRequestRef = useRef<Promise<LocationData> | null>(null);

  const [isManualCategory, setIsManualCategory] = useState(false);
  const isManualCategoryRef = useRef(false);

  useEffect(() => {
    if (initialCaptureMode && !initialMedia && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [initialCaptureMode, initialMedia]);

  const aiSuggestedCategory: IncidentCategory | null = React.useMemo(() => {
    if (!aiPreview) return null;
    if (aiPreview.detectedCategory && aiPreview.detectedCategory !== 'HAZARD') {
      return aiPreview.detectedCategory;
    }
    if (aiPreview.disaster?.status === 'ready' && aiPreview.disaster.routingCategory && aiPreview.disaster.routingCategory !== 'HAZARD') {
      return aiPreview.disaster.routingCategory as IncidentCategory;
    }
    if (aiPreview.image?.top3?.[0]?.label && aiPreview.image.top3[0].label !== 'HAZARD') {
      return aiPreview.image.top3[0].label as IncidentCategory;
    }
    if (aiPreview.text?.category && aiPreview.text.category !== 'HAZARD') {
      return aiPreview.text.category as IncidentCategory;
    }
    return null;
  }, [aiPreview]);

  useEffect(() => { previewLocationRef.current = selectedLocation; }, [selectedLocation]);

  const refreshAccurateLocation = useCallback(async (forceRefresh = false): Promise<LocationData> => {
    if (locationRequestRef.current) return locationRequestRef.current;

    setIsLocating(true);
    setLocationError(null);
    const request = locationService.getAccurateCurrentLocation({ forceRefresh, refine: true });
    locationRequestRef.current = request;

    try {
      const liveLocation = await request;
      setAcquiredLocation(liveLocation);
      return liveLocation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to acquire precise GPS location.';
      setLocationError(message);
      throw error;
    } finally {
      locationRequestRef.current = null;
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  useEffect(() => {
    // Start acquiring a fresh GPS fix as soon as the report screen opens.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshAccurateLocation().catch(() => undefined);
  }, [refreshAccurateLocation]);

  const categories: { id: IncidentCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'HAZARD', label: 'Not sure', icon: <ShieldAlert size={14} />, color: 'bg-gray-50' },
    { id: 'FLOOD', label: 'Flood', icon: <Building size={14} />, color: 'bg-blue-50' },
    { id: 'MEDICAL', label: 'Medical', icon: <ShieldAlert size={14} />, color: 'bg-red-50' },
    { id: 'FIRE', label: 'Fire & Rescue', icon: <Flame size={14} />, color: 'bg-red-50 text-red-600 border-red-200' },
    { id: 'ACCIDENT', label: 'Road Accident', icon: <Car size={14} />, color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'CIVIC', label: 'Civic / Pothole', icon: <Building size={14} />, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'CRIME', label: 'Crime / Safety', icon: <ShieldAlert size={14} />, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  ];

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if ((!file.type.startsWith('image/') && !file.type.startsWith('video/')) || file.size > 4 * 1024 * 1024) {
        alert('Choose an image or video smaller than 4 MB.');
        e.target.value = '';
        return;
      }
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
      setIsManualCategory(false);
      isManualCategoryRef.current = false;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setAiError('');
    if (!mediaFile && !title.trim() && !description.trim()) {
      setAiPreview(null);
      setIsAnalyzingAi(false);
      return;
    }
    setIsAnalyzingAi(true);
    const timer = window.setTimeout(async () => {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('categoryHint', isManualCategoryRef.current ? selectedCategory : '');
      form.append('lat', String(previewLocationRef.current.lat));
      form.append('lng', String(previewLocationRef.current.lng));
      form.append('explain', String(explain));
      if (mediaFile) form.append('media', mediaFile);
      try {
        // Aborting a browser fetch does not stop a cloud GPU job. Let it finish
        // before sending the latest draft; discard responses to older drafts.
        const result = await previewQueueRef.current.run(() => api.previewAI(form), controller.signal);
        if (result && !controller.signal.aborted) {
          setAiPreview(result);
          const suggested: IncidentCategory | null = (
            (result.detectedCategory && result.detectedCategory !== 'HAZARD') ? result.detectedCategory :
            (result.disaster?.status === 'ready' && result.disaster.routingCategory && result.disaster.routingCategory !== 'HAZARD') ? result.disaster.routingCategory as IncidentCategory :
            (result.image?.top3?.[0]?.label && result.image.top3[0].label !== 'HAZARD') ? result.image.top3[0].label as IncidentCategory :
            (result.text?.category && result.text.category !== 'HAZARD') ? result.text.category as IncidentCategory :
            null
          );
          if (suggested && !isManualCategoryRef.current) {
            setSelectedCategory(suggested);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) setAiError(e instanceof Error ? e.message : 'Analysis unavailable. You can still submit this report.');
      } finally {
        if (!controller.signal.aborted) setIsAnalyzingAi(false);
      }
    }, 600);
    return () => { window.clearTimeout(timer); controller.abort(); };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFile, title, description, explain, previewAttempt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const finalDescription = description.trim() || (mediaFile ? 'Citizen captured emergency scene evidence.' : '');
    if (!finalDescription && !mediaFile) {
      alert('Please add a photo/video or description of the incident.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmissionError(null);
      const liveLocation = await locationService.getReportLocation();
      setAcquiredLocation(liveLocation);

      const autoTitle = title.trim() || (
        aiPreview?.hazardType && aiPreview.hazardType !== 'HAZARD'
          ? `${aiPreview.hazardType} near ${liveLocation.address.split(',')[0]}`
          : `${categories.find(c => c.id === selectedCategory)?.label || 'Emergency Incident'} near ${liveLocation.address.split(',')[0]}`
      );

      const formData = new FormData();
      formData.append('title', autoTitle);
      formData.append('description', finalDescription);
      formData.append('explain', String(explain));
      formData.append('categoryHint', selectedCategory);
      formData.append('lat', liveLocation.lat.toString());
      formData.append('lng', liveLocation.lng.toString());
      formData.append('address', liveLocation.address);
      formData.append('locationSource', 'GPS');
      if (liveLocation.accuracyMeters !== undefined) {
        formData.append('accuracyMeters', liveLocation.accuracyMeters.toString());
      }
      if (liveLocation.capturedAt) formData.append('capturedAt', liveLocation.capturedAt);
      formData.append('reporterName', 'Arfa Altaf');
      formData.append('reporterPhone', '+1 (555) 019-2834');
      formData.append('isAnonymous', 'false');
      if (mediaFile) formData.append('media', mediaFile);

      const created = await api.createIncident(formData);
      soundAlerts.playChime();
      onIncidentSubmitted(created);
    } catch (error: unknown) {
      setSubmissionError('Report not submitted: ' + (error instanceof Error ? error.message : 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F5F4FA] text-[#1E1B4B] p-4 select-none pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1E1B4B] shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-extrabold text-[#1E1B4B] tracking-wide">Report Incident</h1>
        <div className="w-10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Media Upload Area */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <label className="text-xs font-bold text-[#1E1B4B] block mb-2">
            1. Photo / Video Evidence
          </label>

          {mediaPreview ? (
            <div className="relative rounded-2xl overflow-hidden mb-2 border border-purple-100 shadow-inner">
              {mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} className="w-full h-44 object-cover" controls />
              ) : (
                <img src={mediaPreview} alt="Incident Preview" className="w-full h-44 object-cover" />
              )}
              <button
                type="button"
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview(null);
                  setAiPreview(null);
                  setIsManualCategory(false);
                  isManualCategoryRef.current = false;
                  setSelectedCategory('HAZARD');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm"
              >
                Change Media
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-200 hover:border-[#5E43F3] bg-purple-50/40 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#5E43F3]/10 text-[#5E43F3] flex items-center justify-center mb-2">
                <Camera size={22} />
              </div>
              <span className="text-xs font-bold text-[#1E1B4B] mb-0.5">Take Photo or Upload Media</span>
              <span className="text-[10px] text-gray-500">Pretrained ML suggestions support authority review</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            onChange={handleMediaChange}
            className="hidden"
          />
        </div>

        {aiPreview?.image?.status === 'ready' && aiPreview.image.inferenceMode !== 'pretrained_zero_shot' && !aiPreview.image.modelVersion?.startsWith('medic-') && !aiPreview.video && <label className="flex items-center gap-2 px-2 text-sm">
          <input type="checkbox" checked={explain} onChange={e => setExplain(e.target.checked)} />
          Include image attention heatmap
        </label>}
        {mediaFile?.type.startsWith('video/') && <p className="px-2 text-xs text-slate-600">Upload a clip up to 30 seconds, 1080p and 4 MB. AI checks up to 6 frames; audio is not analyzed. Add a description for urgency assessment.</p>}
        {aiError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{aiError} You can still submit for authority review.</p>}
        {/* AI Triage Live Assistant Badge */}
        {(aiPreview || isAnalyzingAi) && (
          <div className="bg-gradient-to-r from-purple-900 via-[#5E43F3] to-[#7B61FF] text-white rounded-2xl p-3.5 shadow-md shadow-purple-500/15">
            <div className="flex items-center space-x-2 mb-1.5">
              <Sparkles size={16} className="text-yellow-300 animate-pulse" />
              <span className="text-xs font-extrabold tracking-wide">
                {isAnalyzingAi ? 'Checking your report…' : 'AI Triage Detection'}
              </span>
            </div>

            {isAnalyzingAi && !aiPreview ? (
              <div className="flex items-center space-x-2 text-xs text-white/80 py-1">
                <Loader2 size={14} className="animate-spin" />
                <span>Waiting for AI analysis. You can continue editing or submit for authority review.</span>
              </div>
            ) : aiPreview ? (
              <div>
                {isAnalyzingAi && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-yellow-300 mb-1.5 font-bold">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Refining AI triage with new text…</span>
                  </div>
                )}
                <MLPredictionDetails analysis={aiPreview} compact />
              </div>
            ) : null}
          </div>
        )}
        {!isAnalyzingAi && (aiError || aiPreview?.status === 'unavailable') && <button
          type="button" onClick={() => setPreviewAttempt(attempt => attempt + 1)}
          className="rounded-xl bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-800"
        >Retry AI analysis</button>}

        {/* Category Picker Chips */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <label className="text-xs font-bold text-[#1E1B4B]">
              2. Incident Category
            </label>
            <div className="flex items-center gap-1.5">
              {aiSuggestedCategory && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5E43F3] bg-purple-100/80 px-2 py-0.5 rounded-full border border-purple-200">
                  <Sparkles size={11} className="text-yellow-600" />
                  {selectedCategory === aiSuggestedCategory ? 'AI Auto-Selected' : `AI detected: ${categories.find(c => c.id === aiSuggestedCategory)?.label || aiSuggestedCategory}`}
                </span>
              )}
              {isManualCategory && aiSuggestedCategory && selectedCategory !== aiSuggestedCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(aiSuggestedCategory);
                    setIsManualCategory(false);
                    isManualCategoryRef.current = false;
                  }}
                  className="text-[10px] font-bold text-[#5E43F3] bg-white border border-[#5E43F3]/30 px-1.5 py-0.5 rounded-md hover:bg-purple-50 transition-colors"
                >
                  Reset to AI
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => {
              const isAiMatch = aiSuggestedCategory === cat.id;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setIsManualCategory(true);
                    isManualCategoryRef.current = true;
                  }}
                  className={`relative flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'border-[#5E43F3] bg-purple-50 text-[#5E43F3] shadow-sm font-bold ring-1 ring-[#5E43F3]/30'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {cat.icon}
                  <span className="truncate">{cat.label}</span>
                  {isAiMatch && (
                    <span className="ml-auto text-[10px] font-bold bg-[#5E43F3] text-white px-1.5 py-0.5 rounded-full">
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Incident Details Input */}
        <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-[#1E1B4B] block">
            3. Details & Description
          </label>
          <p className="text-xs text-slate-500">For automatic text analysis, write a short report in English. Include immediate danger and any injuries.</p>
          <input
            type="text"
            placeholder="Short Title (e.g. Broken pipe flooding sidewalk)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#F4F3FA] border-0 rounded-xl px-3.5 py-2.5 text-xs text-[#1E1B4B] placeholder-gray-400 focus:ring-2 focus:ring-[#5E43F3] outline-none"
          />
          <textarea
            rows={3}
            placeholder="Describe what you see, any immediate danger or trapped individuals..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            className="w-full bg-[#F4F3FA] border-0 rounded-xl p-3.5 text-xs text-[#1E1B4B] placeholder-gray-400 focus:ring-2 focus:ring-[#5E43F3] outline-none resize-none"
          />
        </div>

        {/* Live GPS Card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#1E1B4B]">
              4. Device Location
            </label>
            <button
              type="button"
              onClick={() => void refreshAccurateLocation(true).catch(() => undefined)}
              disabled={isLocating}
              className="text-[11px] bg-purple-50 text-[#5E43F3] px-2 py-0.5 rounded-lg font-bold hover:bg-purple-100 flex items-center space-x-1 active:scale-95 transition-all disabled:opacity-60"
            >
              <span>{isLocating ? 'Acquiring GPS…' : 'Refresh Precise GPS'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 bg-[#F4F3FA] p-2.5 rounded-xl text-xs text-[#1E1B4B] mb-2">
            <MapPin size={16} className="text-[#5E43F3] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{selectedLocation.address}</div>
              <LiveLocationStatus location={selectedLocation} />
            </div>
          </div>

          {locationError && !isFreshLiveLocation(selectedLocation, LIVE_LOCATION_AGE_MS) && (
            <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700">
              {locationError}
            </div>
          )}

          <div className="h-36 rounded-xl overflow-hidden border border-gray-100 mb-2">
            <InteractiveMap selectedLocation={selectedLocation} height="144px" />
          </div>

          <p className="text-[10px] leading-relaxed text-gray-500">
            Reports use a device reading from the last 15 seconds. We request high accuracy and allow up to 10 seconds for GPS to improve. The shaded circle shows the device's estimated uncertainty; accuracy depends on your device and signal.
          </p>
        </div>

        {submissionError && (
          <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {submissionError}
          </div>
        )}

        {/* Submit Pill Button matching design */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-[#5E43F3] via-[#6D52F7] to-[#7B61FF] hover:from-[#4E33EC] hover:to-[#6B51EF] active:scale-[0.98] transition-all text-white font-semibold py-4 px-5 rounded-2xl flex items-center justify-between shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50 border border-purple-400/30"
        >
          <div className="flex flex-col text-left pl-1">
            <span className="text-sm font-black tracking-wide">
              {isSubmitting
                ? (isLocating ? 'Acquiring Precise GPS…' : 'Dispatching Emergency Report…')
                : aiPreview?.department
                ? `🚀 Dispatch to ${aiPreview.department.replace('_', ' ')}`
                : '🚀 Submit Emergency Report'}
            </span>
            <span className="text-[10px] text-white/80 font-medium">
              {isSubmitting ? 'Sending location & evidence' : 'Direct authority notification with live GPS'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-white text-[#5E43F3] flex items-center justify-center shadow-md flex-shrink-0 ml-2">
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} className="stroke-[2.5]" />
            )}
          </div>
        </button>
      </form>
    </div>
  );
};
