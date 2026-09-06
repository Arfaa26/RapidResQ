import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  MapPin, 
  Sparkles, 
  ArrowLeft, 
  AlertCircle, 
  Flame, 
  Car, 
  Building, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2,
  ArrowRight
} from 'lucide-react';
import { Incident, LocationData, AIAnalysisResult, IncidentCategory } from '../../types';
import { api } from '../../services/api';
import { InteractiveMap } from '../common/InteractiveMap';
import { soundAlerts } from '../../utils/audioAlert';
import { locationService } from '../../services/locationService';

interface ReportIncidentScreenProps {
  onBack: () => void;
  onIncidentSubmitted: (incident: Incident) => void;
  currentLocation: LocationData;
}

export const ReportIncidentScreen: React.FC<ReportIncidentScreenProps> = ({
  onBack,
  onIncidentSubmitted,
  currentLocation,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>('CIVIC');
  const [selectedLocation, setSelectedLocation] = useState<LocationData>(currentLocation);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiPreview, setAiPreview] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories: { id: IncidentCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'FIRE', label: 'Fire & Rescue', icon: <Flame size={14} />, color: 'bg-red-50 text-red-600 border-red-200' },
    { id: 'ACCIDENT', label: 'Road Accident', icon: <Car size={14} />, color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'CIVIC', label: 'Civic / Pothole', icon: <Building size={14} />, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'CRIME', label: 'Crime / Safety', icon: <ShieldAlert size={14} />, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  ];

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
      triggerAiPreview(file, description, selectedCategory);
    }
  };

  const triggerAiPreview = async (file?: File, desc?: string, cat?: IncidentCategory) => {
    try {
      setIsAnalyzingAi(true);
      const formData = new FormData();
      if (file || mediaFile) formData.append('media', file || mediaFile!);
      if (desc || description) formData.append('description', desc || description);
      if (cat || selectedCategory) formData.append('categoryHint', cat || selectedCategory);

      const preview = await api.previewAI(formData);
      setAiPreview(preview);
    } catch (err) {
      console.warn('AI preview error', err);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description && !mediaFile) {
      alert('Please add a description or photo of the incident.');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      if (title) formData.append('title', title);
      formData.append('description', description);
      formData.append('categoryHint', selectedCategory);
      formData.append('lat', selectedLocation.lat.toString());
      formData.append('lng', selectedLocation.lng.toString());
      formData.append('address', selectedLocation.address);
      formData.append('reporterName', isAnonymous ? 'Anonymous Citizen' : 'Olivia Smith');
      formData.append('reporterPhone', isAnonymous ? '' : '+1 (555) 019-2834');
      formData.append('isAnonymous', isAnonymous ? 'true' : 'false');
      if (mediaFile) formData.append('media', mediaFile);

      const created = await api.createIncident(formData);
      soundAlerts.playChime();
      onIncidentSubmitted(created);
    } catch (err: any) {
      alert('Failed to submit report: ' + err.message);
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
              <img src={mediaPreview} alt="Incident Preview" className="w-full h-44 object-cover" />
              <button
                type="button"
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview(null);
                  setAiPreview(null);
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm"
              >
                Change Photo
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
              <span className="text-[10px] text-gray-500">AI automatically detects hazard type & priority</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaChange}
            className="hidden"
          />
        </div>

        {/* AI Triage Live Assistant Badge */}
        {(aiPreview || isAnalyzingAi) && (
          <div className="bg-gradient-to-r from-purple-900 via-[#5E43F3] to-[#7B61FF] text-white rounded-2xl p-3.5 shadow-md shadow-purple-500/15">
            <div className="flex items-center space-x-2 mb-1.5">
              <Sparkles size={16} className="text-yellow-300 animate-pulse" />
              <span className="text-xs font-extrabold tracking-wide">
                {isAnalyzingAi ? 'AI Analyzing Media & Text...' : 'AI Triage Detection'}
              </span>
            </div>

            {isAnalyzingAi ? (
              <div className="flex items-center space-x-2 text-xs text-white/80 py-1">
                <Loader2 size={14} className="animate-spin" />
                <span>Extracting visual features, hazard classification & priority...</span>
              </div>
            ) : aiPreview && (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white/90">Hazard: {aiPreview.hazardType}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    aiPreview.priority === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black'
                  }`}>
                    {aiPreview.priority} PRIORITY
                  </span>
                </div>
                <div className="text-[11px] text-white/80 leading-tight">
                  Routing: <span className="font-bold underline">{aiPreview.department.replace('_', ' ')}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category Picker Chips */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <label className="text-xs font-bold text-[#1E1B4B] block mb-2">
            2. Incident Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  triggerAiPreview(mediaFile || undefined, description, cat.id);
                }}
                className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? 'border-[#5E43F3] bg-purple-50 text-[#5E43F3] shadow-sm font-bold'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Incident Details Input */}
        <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-[#1E1B4B] block">
            3. Details & Description
          </label>
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
            onBlur={() => triggerAiPreview(mediaFile || undefined, description, selectedCategory)}
            className="w-full bg-[#F4F3FA] border-0 rounded-xl p-3.5 text-xs text-[#1E1B4B] placeholder-gray-400 focus:ring-2 focus:ring-[#5E43F3] outline-none resize-none"
          />
        </div>

        {/* Location Pin Card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#1E1B4B]">
              4. Incident Location
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={async () => {
                  const live = await locationService.getCurrentLocation();
                  setSelectedLocation(live);
                }}
                className="text-[11px] bg-purple-50 text-[#5E43F3] px-2 py-0.5 rounded-lg font-bold hover:bg-purple-100 flex items-center space-x-1 active:scale-95 transition-all"
              >
                <span>📍 Live GPS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="text-[11px] text-[#5E43F3] font-bold hover:underline"
              >
                {showMapPicker ? 'Hide Map' : 'Adjust Pin'}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#F4F3FA] p-2.5 rounded-xl text-xs text-[#1E1B4B] mb-2">
            <MapPin size={16} className="text-[#5E43F3] flex-shrink-0" />
            <span className="truncate font-medium">{selectedLocation.address}</span>
          </div>

          {showMapPicker && (
            <div className="h-36 rounded-xl overflow-hidden border border-gray-100 mb-2">
              <InteractiveMap
                selectedLocation={selectedLocation}
                onLocationSelect={(loc) => setSelectedLocation(loc)}
                height="144px"
                isPicker
              />
            </div>
          )}
        </div>

        {/* Anonymous Toggle */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm">
          <div className="text-xs font-medium text-[#4B5563]">Submit Anonymously</div>
          <button
            type="button"
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              isAnonymous ? 'bg-[#5E43F3]' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              isAnonymous ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Submit Pill Button matching design */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#5E43F3] hover:bg-[#4E33EC] active:scale-[0.98] transition-all text-white font-semibold py-4 px-6 rounded-full flex items-center justify-between shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50"
        >
          <span className="text-sm font-bold pl-2">
            {isSubmitting ? 'Routing to Emergency Authorities...' : 'Submit Incident Report'}
          </span>
          <div className="w-10 h-10 rounded-full bg-white text-[#5E43F3] flex items-center justify-center shadow-md">
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
