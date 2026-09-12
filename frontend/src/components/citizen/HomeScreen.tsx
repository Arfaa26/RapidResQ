import React, { useEffect, useRef, useState } from 'react';
import { 
  Bell, 
  MapPin, 
  ShieldAlert, 
  Mic, 
  ChevronRight, 
  ArrowRight,
  Flame, 
  Building2, 
  AlertTriangle,
  Camera,
  Video,
  Sparkles,
  Zap
} from 'lucide-react';
import { Incident, LocationData } from '../../types';
import { soundAlerts } from '../../utils/audioAlert';
import { isFreshLiveLocation, locationService } from '../../services/locationService';
import { LiveLocationStatus } from '../common/LiveLocationStatus';

interface HomeScreenProps {
  onTriggerSos: () => void;
  onNavigateReport: (initialMedia?: File, captureMode?: 'photo' | 'video') => void;
  onNavigateAlerts: () => void;
  onSelectIncident: (inc: Incident) => void;
  recentIncidents: Incident[];
  userLocation: LocationData;
  onRefreshLocation: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onTriggerSos,
  onNavigateReport,
  onNavigateAlerts,
  onSelectIncident,
  recentIncidents,
  userLocation,
  onRefreshLocation,
}) => {
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 mins
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTimerActive) return;

    const timeoutId = window.setTimeout(() => {
      if (timerSeconds <= 1) {
        setTimerSeconds(0);
        setIsTimerActive(false);
        setShowTimerModal(false);
        soundAlerts.playEmergencySiren();
        onTriggerSos();
        return;
      }
      setTimerSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [isTimerActive, onTriggerSos, timerSeconds]);

  const safetyTips = [
    {
      title: 'Travel Safe',
      desc: 'Share your live location with trusted contacts when commuting at night.',
      icon: '🎒',
    },
    {
      title: 'AI Auto-Triage',
      desc: 'Snap a photo or record video. AI identifies the emergency and dispatches the authority instantly.',
      icon: '🤖',
    },
    {
      title: 'Emergency SOS Protocol',
      desc: 'Press SOS for instant high-priority siren dispatch to Police, Fire, and EMS.',
      icon: '🚨',
    },
  ];

  const handleSosPress = () => {
    soundAlerts.playEmergencySiren();
    onTriggerSos();
  };

  const handleShareLocation = async () => {
    try {
      const location = isFreshLiveLocation(userLocation) ? userLocation : await locationService.getAccurateCurrentLocation();
      const mapsUrl = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`;
      const text = `My device location (accuracy ±${location.accuracyMeters} m): ${location.address}\n${mapsUrl}`;
      if (navigator.share) {
        await navigator.share({ title: 'RapidResQ live location', text, url: mapsUrl });
        setShareFeedback('Location shared.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareFeedback('Location link copied.');
      } else {
        setShareFeedback(text);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareFeedback('Unable to share automatically. Copy the location from the GPS card.');
    }

    window.setTimeout(() => setShareFeedback(null), 3500);
  };

  const handleMediaCaptured = (e: React.ChangeEvent<HTMLInputElement>, mode: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert('Choose an image or video smaller than 4 MB.');
        e.target.value = '';
        return;
      }
      onNavigateReport(file, mode);
    }
  };

  const formattedTimer = `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col min-h-full pb-20 bg-[#F5F4FA] text-[#1E1B4B] p-4 select-none">
      {/* Hidden Media Inputs for Native Camera/Video Triggers */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleMediaCaptured(e, 'photo')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        capture="environment"
        onChange={(e) => handleMediaCaptured(e, 'video')}
        className="hidden"
      />

      {/* 1. Header Card with Purple Gradient */}
      <div className="w-full bg-gradient-to-r from-[#6247F5] via-[#755DF7] to-[#8872FA] rounded-2xl p-4 flex items-center justify-between shadow-md shadow-purple-500/15 mb-4 text-white">
        <div className="flex items-center space-x-3">
          <div
            aria-label="Arfa Altaf"
            className="w-12 h-12 rounded-full border-2 border-white/60 bg-white/20 shadow-sm flex items-center justify-center text-sm font-black text-white"
          >
            AA
          </div>
          <div>
            <div className="text-xs text-white/80 font-medium">Welcome back,</div>
            <div className="text-base font-bold text-white tracking-wide">Arfa Altaf</div>
          </div>
        </div>

        {/* Bell with red unread notification indicator */}
        <button 
          onClick={onNavigateAlerts}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center relative transition-all active:scale-95"
        >
          <Bell size={18} className="text-white" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF3B30] border border-white" />
        </button>
      </div>

      {/* Live GPS Telemetry Status Pill */}
      <div className="bg-white/80 backdrop-blur-sm border border-purple-100/80 rounded-2xl px-3.5 py-2 flex items-center justify-between shadow-sm mb-4 text-xs">
        <div className="flex items-center space-x-2 truncate pr-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            userLocation.source === 'GPS' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
          }`} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#1E1B4B] truncate">
              📍 {userLocation.address}
            </div>
            <LiveLocationStatus location={userLocation} />
          </div>
        </div>
        <button
          onClick={onRefreshLocation}
          className="text-[10px] text-[#5E43F3] font-extrabold hover:underline flex-shrink-0 bg-purple-50 px-2 py-0.5 rounded-lg active:scale-95 transition-transform cursor-pointer"
        >
          Sync GPS
        </button>
      </div>

      {/* 2. Hero SOS Banner (Coral Red Gradient matching design) */}
      <div className="w-full bg-gradient-to-r from-[#FF5252] via-[#FA3E3E] to-[#E52D2D] rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-lg shadow-red-500/20 mb-4 text-white relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

        <div className="max-w-[58%] z-10">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full">
              Emergency
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-white mb-0.5">Need Help?</h2>
          <p className="text-[11px] text-white/90 leading-snug font-medium">
            1-tap instant high-priority siren dispatch with live device GPS
          </p>
        </div>

        {/* SOS Circular Button with Concentric Rings */}
        <div className="relative flex items-center justify-center z-10">
          <div className="absolute w-20 h-20 rounded-full border-2 border-white/30 animate-ping opacity-30 pointer-events-none" />
          <div className="w-16 h-16 rounded-full border-2 border-white/40 flex items-center justify-center p-1">
            <button
              onClick={handleSosPress}
              className="w-full h-full rounded-full bg-white text-[#FA3E3E] font-black text-sm tracking-wider flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
            >
              SOS
            </button>
          </div>
        </div>
      </div>

      {/* 3. CENTER HERO FEATURE: Prominent 1-Tap Camera & Video Quick-Report Hub */}
      <div className="w-full bg-gradient-to-br from-[#1E1B4B] via-[#2D1B69] to-[#432391] rounded-3xl p-4 sm:p-5 text-white shadow-xl shadow-purple-900/25 mb-4 relative overflow-hidden border border-purple-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#755DF7]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-[#FF5252]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-[#1E1B4B]">
                <Zap size={14} className="fill-current" />
              </span>
              <span className="text-xs font-black tracking-wider uppercase text-yellow-300">
                1-Tap Quick Report
              </span>
            </div>
            <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full text-white/90">
              ⚡ Auto AI Dispatch
            </span>
          </div>

          <p className="text-xs text-purple-100 font-medium leading-snug mb-3.5">
            Capture image or video — AI auto-identifies the disaster, determines severity, and dispatches to the correct authority immediately.
          </p>

          {/* Dual Action Central Capture Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Camera / Photo Capture */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="bg-gradient-to-r from-[#6247F5] to-[#7B61FF] hover:from-[#5237E5] hover:to-[#6B51EF] text-white p-3.5 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-purple-600/30 active:scale-95 transition-all group border border-white/20"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Camera size={22} className="text-white" />
              </div>
              <span className="text-xs font-extrabold text-white tracking-wide">Take Photo</span>
              <span className="text-[10px] text-purple-200 font-medium">Camera or Gallery</span>
            </button>

            {/* Video Clip Capture */}
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-[#D94E06] hover:to-[#EA580C] text-white p-3.5 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-orange-600/30 active:scale-95 transition-all group border border-white/20"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Video size={22} className="text-white" />
              </div>
              <span className="text-xs font-extrabold text-white tracking-wide">Record Video</span>
              <span className="text-[10px] text-orange-200 font-medium">Multi-Frame AI</span>
            </button>
          </div>

          {/* Fast Direct Flow Button */}
          <button
            type="button"
            onClick={() => onNavigateReport()}
            className="w-full bg-white/10 hover:bg-white/20 active:scale-98 transition-all text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-between backdrop-blur-sm border border-white/10"
          >
            <span className="flex items-center space-x-1.5">
              <Sparkles size={14} className="text-yellow-300" />
              <span>Open Full Quick-Report Screen</span>
            </span>
            <ArrowRight size={14} className="text-white/80" />
          </button>
        </div>
      </div>

      {/* 4. Quick Actions Header */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h3 className="text-sm font-bold text-[#1E1B4B]">Quick Actions</h3>
        <button 
          onClick={() => onNavigateReport()}
          className="text-xs text-[#6B7280] font-semibold hover:text-[#5E43F3] transition-colors"
        >
          View all
        </button>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {/* Share Location */}
        <button 
          onClick={() => void handleShareLocation()}
          className="bg-white rounded-2xl p-2.5 flex flex-col items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-[#5E43F3]/15 flex items-center justify-center mb-1.5 text-[#5E43F3] group-hover:scale-105 transition-transform">
            <MapPin size={18} />
          </div>
          <span className="text-[11px] font-semibold text-[#4B5563] text-center leading-tight">Share Location</span>
        </button>

        {/* Safety Timer */}
        <button 
          onClick={() => setShowTimerModal(true)}
          className="bg-white rounded-2xl p-2.5 flex flex-col items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-[#F59E0B]/15 flex items-center justify-center mb-1.5 text-[#F59E0B] group-hover:scale-105 transition-transform">
            <ShieldAlert size={18} />
          </div>
          <span className="text-[11px] font-semibold text-[#4B5563] text-center leading-tight">
            {isTimerActive ? formattedTimer : 'Safety Timer'}
          </span>
        </button>

        {/* Voice Record / Report */}
        <button 
          onClick={() => onNavigateReport()}
          className="bg-white rounded-2xl p-2.5 flex flex-col items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-[#3B82F6]/15 flex items-center justify-center mb-1.5 text-[#3B82F6] group-hover:scale-105 transition-transform">
            <Mic size={18} />
          </div>
          <span className="text-[11px] font-semibold text-[#4B5563] text-center leading-tight">Voice Record</span>
        </button>
      </div>

      {/* 5. Safety Tips Carousel */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-bold text-[#1E1B4B]">Safety Tips</h3>
        <span className="text-xs text-[#6B7280] font-semibold">Tips</span>
      </div>

      <div className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm mb-4 relative overflow-hidden">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
            {safetyTips[activeTipIndex].icon}
          </div>
          <div className="pr-2">
            <div className="text-xs font-bold text-[#1E1B4B] mb-0.5">
              {safetyTips[activeTipIndex].title}
            </div>
            <div className="text-[11px] text-[#6B7280] leading-snug line-clamp-2 font-medium">
              {safetyTips[activeTipIndex].desc}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setActiveTipIndex((prev) => (prev + 1) % safetyTips.length)}
          className="w-7 h-7 rounded-full bg-[#F4F3FA] hover:bg-purple-100 flex items-center justify-center text-[#5E43F3] flex-shrink-0 transition-colors"
        >
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Carousel dots */}
      <div className="flex justify-center space-x-1.5 -mt-2 mb-4">
        {safetyTips.map((_, i) => (
          <div
            key={i}
            onClick={() => setActiveTipIndex(i)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              activeTipIndex === i ? 'w-5 bg-[#5E43F3]' : 'w-1.5 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* 6. Recent Alerts List */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h3 className="text-sm font-bold text-[#1E1B4B]">Recent Alerts</h3>
        <button 
          onClick={onNavigateAlerts}
          className="text-xs text-[#6B7280] font-semibold hover:text-[#5E43F3]"
        >
          View all
        </button>
      </div>

      <div className="space-y-2 mb-2">
        {recentIncidents.slice(0, 3).map((inc) => {
          let icon = <Bell size={16} className="text-[#FA3E3E]" />;
          let iconBg = 'bg-red-50';

          if (inc.category === 'FIRE') {
            icon = <Flame size={16} className="text-orange-500" />;
            iconBg = 'bg-orange-50';
          } else if (inc.category === 'CIVIC') {
            icon = <Building2 size={16} className="text-[#5E43F3]" />;
            iconBg = 'bg-purple-50';
          } else if (inc.category === 'ACCIDENT') {
            icon = <AlertTriangle size={16} className="text-amber-500" />;
            iconBg = 'bg-amber-50';
          }

          return (
            <div
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm hover:shadow-md cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                  {icon}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-[#1E1B4B] truncate">{inc.title}</div>
                  <div className="text-[10px] text-[#9CA3AF] font-medium truncate">
                    {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {inc.location.address.split(',')[0]}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                  inc.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {inc.status}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Timer Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 flex flex-col items-center text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <ShieldAlert size={24} />
            </div>
            <div className="text-base font-bold text-[#1E1B4B] mb-1">SafeWalk Safety Timer</div>
            <div className="text-xs text-gray-500 mb-4">
              If not cancelled before the timer ends, an SOS with your device location will be sent to the authority dashboard.
            </div>

            <div className="text-3xl font-black text-[#5E43F3] mb-6 font-mono">
              {formattedTimer}
            </div>

            <button
              onClick={() => {
                setTimerSeconds(300);
                setIsTimerActive(true);
                soundAlerts.playChime();
              }}
              disabled={isTimerActive}
              className="w-full bg-[#5E43F3] text-white py-3 rounded-full font-bold text-xs shadow-md shadow-purple-500/25"
            >
              {isTimerActive ? 'Timer Running' : 'Start 5-Minute Timer'}
            </button>

            <button
              onClick={() => {
                setIsTimerActive(false);
                setTimerSeconds(300);
                setShowTimerModal(false);
              }}
              className="mt-2 w-full py-2.5 text-xs font-bold text-gray-500"
            >
              {isTimerActive ? 'Cancel Safety Timer' : 'Not Now'}
            </button>
          </div>
        </div>
      )}

      {shareFeedback && (
        <div className="fixed bottom-8 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 rounded-2xl bg-[#1E1B4B] px-4 py-3 text-center text-xs font-semibold text-white shadow-xl">
          {shareFeedback}
        </div>
      )}
    </div>
  );
};
