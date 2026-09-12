import React, { useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Phone, 
  MapPin, 
  Sparkles
} from 'lucide-react';
import { formatConfidence } from '../../utils/mlFormatting';
import confetti from 'canvas-confetti';
import { Incident, IncidentStatus } from '../../types';

interface IncidentTrackerScreenProps {
  incident: Incident;
  onBack: () => void;
}

export const IncidentTrackerScreen: React.FC<IncidentTrackerScreenProps> = ({
  incident,
  onBack,
}) => {
  const steps: { key: IncidentStatus; label: string; desc: string }[] = [
    { key: 'PENDING', label: 'Report Submitted', desc: 'AI triage & verification' },
    { key: 'ACKNOWLEDGED', label: 'Acknowledged', desc: 'Authority dispatched unit' },
    { key: 'IN_PROGRESS', label: 'In Progress', desc: 'Responders active on site' },
    { key: 'RESOLVED', label: 'Resolved', desc: 'Hazard cleared & closed' },
  ];

  const getStepIndex = (status: IncidentStatus) => {
    switch (status) {
      case 'PENDING': return 0;
      case 'ACKNOWLEDGED': return 1;
      case 'IN_PROGRESS': return 2;
      case 'RESOLVED': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(incident.status);

  useEffect(() => {
    if (incident.status === 'RESOLVED') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [incident.status]);

  return (
    <div className="flex flex-col min-h-full bg-[#F5F4FA] text-[#1E1B4B] p-4 select-none pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1E1B4B] shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="text-xs text-[#6B7280] font-medium">Incident Tracking</h1>
          <div className="text-sm font-extrabold text-[#1E1B4B]">{incident.id}</div>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Status Header Card */}
      <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                incident.priority === 'CRITICAL' ? 'bg-red-500 text-white' :
                incident.priority === 'HIGH' ? 'bg-orange-500 text-white' :
                'bg-blue-500 text-white'
              }`}>
                {incident.priority} PRIORITY
              </span>
              <span className="text-[11px] font-bold text-[#5E43F3] bg-purple-50 px-2 py-0.5 rounded-full">
                {incident.department.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-sm font-black text-[#1E1B4B] leading-snug">
              {incident.title}
            </h2>
          </div>
        </div>

        {/* Media Photo if available */}
        {incident.mediaUrl && (
          <div className="rounded-2xl overflow-hidden mb-3 border border-gray-100 shadow-inner max-h-44">
            {incident.mediaType === 'video' ? (
              <video src={incident.mediaUrl} className="w-full h-44 object-cover" controls />
            ) : (
              <img src={incident.mediaUrl} alt={incident.title} className="w-full h-44 object-cover" />
            )}
          </div>
        )}

        <div className="flex items-center space-x-2 text-[11px] text-[#6B7280] bg-[#F4F3FA] p-2.5 rounded-xl">
          <MapPin size={14} className="text-[#5E43F3] flex-shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-medium">{incident.location.address}</div>
            {incident.location.accuracyMeters !== undefined && (
              <div className="mt-0.5 text-[9px] font-bold text-emerald-600">
                Live GPS accuracy ±{incident.location.accuracyMeters} m
              </div>
            )}
          </div>
        </div>
      </div>

      {incident.duplicate && <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm">
        {incident.duplicate.status === 'POSSIBLE' ? 'Possible duplicate — awaiting authority review:' : incident.duplicate.status === 'CONFIRMED' ? 'Grouped with incident:' : 'Duplicate suggestion rejected:'} {incident.duplicate.of}
      </div>}
      {/* Real-time Status Progress Pipeline */}
      <div className="bg-white rounded-3xl p-5 shadow-sm mb-4">
        <h3 className="text-xs font-bold text-[#1E1B4B] mb-4 flex items-center justify-between">
          <span>Live Resolution Pipeline</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
            Real-time Sync
          </span>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;

            let icon = <div className="w-2 h-2 rounded-full bg-gray-300" />;
            let badgeBg = 'bg-gray-100 text-gray-400 border-gray-200';

            if (isCompleted) {
              icon = <CheckCircle2 size={14} className="text-white" />;
              badgeBg = 'bg-[#10B981] text-white border-[#10B981]';
            } else if (isCurrent) {
              icon = <Clock size={14} className="text-white animate-spin" />;
              badgeBg = 'bg-[#5E43F3] text-white border-[#5E43F3] shadow-md shadow-purple-500/30';
            }

            return (
              <div key={step.key} className="relative flex items-start space-x-3">
                {/* Node icon */}
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${badgeBg}`}>
                  {icon}
                </div>

                <div className="flex-1 -mt-0.5">
                  <div className={`text-xs font-bold ${
                    isCurrent ? 'text-[#5E43F3]' : isCompleted ? 'text-[#10B981]' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium">
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assigned Response Unit Card */}
      {incident.assignedUnit && (
        <div className="bg-gradient-to-r from-[#6247F5] to-[#7E66FC] text-white rounded-3xl p-4 shadow-md shadow-purple-500/20 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/80 font-medium">Assigned First Responder</div>
            {incident.assignedUnit.etaMinutes && incident.status !== 'RESOLVED' && (
              <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                ETA: ~{incident.assignedUnit.etaMinutes} mins
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold">{incident.assignedUnit.name}</div>
              <div className="text-[11px] text-white/80 font-mono">Badge: {incident.assignedUnit.badge}</div>
            </div>
            <a
              href={`tel:${incident.assignedUnit.phone}`}
              className="w-9 h-9 rounded-full bg-white text-[#5E43F3] flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <Phone size={16} />
            </a>
          </div>
        </div>
      )}

      {/* AI Triage Reasoning Box */}
      <div className="bg-purple-50 border border-purple-100 rounded-3xl p-4 mb-4">
        <div className="flex items-center space-x-2 text-[#5E43F3] text-xs font-extrabold mb-1">
          <Sparkles size={15} />
          <span>Triage analysis ({formatConfidence(incident.aiAnalysis)})</span>
        </div>
        <p className="text-[11px] text-[#4B5563] leading-relaxed mb-2 font-medium">
          {incident.aiAnalysis.reasoning}
        </p>
        <div className="text-[10px] text-purple-700 font-bold bg-purple-100/70 p-2 rounded-xl">
          Action: {incident.aiAnalysis.recommendedAction}
        </div>
      </div>

      {/* Activity Timeline Log */}
      <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
        <h3 className="text-xs font-bold text-[#1E1B4B] mb-3">Audit Timeline Log</h3>
        <div className="space-y-3">
          {incident.timeline.map((item) => (
            <div key={item.id} className="text-xs border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span className="font-bold text-[#1E1B4B]">{item.updatedBy}</span>
                <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[11px] text-gray-700 font-medium">{item.note}</div>
              {item.proofPhotoUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-emerald-200 shadow-sm">
                  <div className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1">
                    ✓ Resolution Photo Proof
                  </div>
                  <img src={item.proofPhotoUrl} alt="Proof" className="w-full h-36 object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
