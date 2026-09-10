import React, { useEffect, useId, useRef, useState } from 'react';
import { 
  ShieldAlert, 
  Flame, 
  Building, 
  Radio, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  Truck, 
  RefreshCw, 
  Sparkles, 
  MapPin,
  Phone,
  User,
  X,
  ArrowRight
} from 'lucide-react';
import { Incident, IncidentStatus, DashboardStats } from '../../types';
import { InteractiveMap } from '../common/InteractiveMap';
import { api } from '../../services/api';
import { soundAlerts } from '../../utils/audioAlert';
import confetti from 'canvas-confetti';

interface AuthorityDashboardProps {
  incidents: Incident[];
  stats: DashboardStats | null;
  onRefresh: () => void;
  onUpdateIncident: (updated: Incident) => void;
}

export const AuthorityDashboard: React.FC<AuthorityDashboardProps> = ({
  incidents,
  stats,
  onRefresh,
  onUpdateIncident,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsDialogRef = useRef<HTMLDialogElement>(null);
  const detailsTitleId = useId();
  const [isMuted, setIsMuted] = useState(true);
  const seenIncidentIds = useRef<Set<string> | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Status update form states
  const [dispatcherNote, setDispatcherNote] = useState('');
  const [assignedUnitName, setAssignedUnitName] = useState('');
  const [assignedUnitBadge, setAssignedUnitBadge] = useState('');
  const [etaInput, setEtaInput] = useState('5');
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (incidents.length === 0) return;
    const incoming = seenIncidentIds.current
      ? incidents.filter((incident) => !seenIncidentIds.current!.has(incident.id)) : [];
    seenIncidentIds.current = new Set(incidents.map((incident) => incident.id));
    if (isMuted || incoming.length === 0) return;
    if (incoming.some((incident) => incident.priority === 'CRITICAL' || incident.priority === 'HIGH')) {
      soundAlerts.playEmergencySiren();
    } else {
      soundAlerts.playChime();
    }
  }, [incidents, isMuted]);

  const departments: { id: string; name: string; icon: React.ReactNode; color: string }[] = [
    { id: 'ALL', name: 'All Departments', icon: <Radio size={16} />, color: 'bg-gray-800' },
    { id: 'FIRE_DEPARTMENT', name: 'Fire & Rescue', icon: <Flame size={16} />, color: 'bg-red-600' },
    { id: 'EMS_AMBULANCE', name: 'Ambulance / EMS', icon: <Truck size={16} />, color: 'bg-orange-600' },
    { id: 'POLICE_DEPARTMENT', name: 'Police Dispatch', icon: <ShieldAlert size={16} />, color: 'bg-blue-600' },
    { id: 'MUNICIPALITY', name: 'Civic / Municipality', icon: <Building size={16} />, color: 'bg-purple-600' },
  ];

  // Filtered list
  const filteredIncidents = incidents.filter((inc) => {
    if (selectedDept !== 'ALL' && inc.department !== selectedDept) return false;
    if (selectedStatus !== 'ALL' && inc.status !== selectedStatus) return false;
    return true;
  });

  // Keep the opened report selected even when an update removes it from a filter.
  const selectedIncident = incidents.find((inc) => inc.id === selectedIncidentId) ?? null;

  const openIncident = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
    setDispatcherNote('');
    setAssignedUnitName(incident.assignedUnit?.name || '');
    setAssignedUnitBadge(incident.assignedUnit?.badge || '');
    setEtaInput(String(incident.assignedUnit?.etaMinutes || 5));
    setProofFile(null);
    setIsDetailsOpen(true);
  };

  useEffect(() => {
    if (!isDetailsOpen) return;
    const dialog = detailsDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [isDetailsOpen]);

  const criticalCount = stats?.criticalActive
    ?? incidents.filter(i => i.priority === 'CRITICAL' && i.status !== 'RESOLVED').length;

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!selectedIncident) return;
    try {
      setIsUpdating(true);
      const updated = await api.updateStatus(selectedIncident.id, {
        status: newStatus,
        note: dispatcherNote || `Status updated to ${newStatus} by Dispatch Control`,
        updatedBy: `${selectedIncident.department.replace('_', ' ')} Commander`,
        unitName: assignedUnitName || selectedIncident.assignedUnit?.name,
        unitBadge: assignedUnitBadge || selectedIncident.assignedUnit?.badge,
        etaMinutes: Number.parseInt(etaInput, 10) || undefined,
        proofPhoto: proofFile || undefined,
      });

      setSelectedIncidentId(updated.id);
      onUpdateIncident(updated);
      setDispatcherNote('');
      setProofFile(null);

      if (newStatus === 'RESOLVED') {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else {
        soundAlerts.playChime();
      }
    } catch (error: unknown) {
      alert('Failed to update status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans">
      {/* 1. Top Command Bar */}
      <header className="bg-[#1E293B] border-b border-slate-700/80 px-6 py-3.5 flex flex-wrap gap-3 items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5E43F3] to-[#8F77FB] flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold tracking-wide text-white">RapidResQ Command Center</h1>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE DISPATCH</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Multi-Agency Emergency & Civic Incident Triage System
            </p>
          </div>
        </div>

        {/* Real-time stats pills */}
        <div className="flex items-center space-x-3">
          {criticalCount > 0 && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-3.5 py-1.5 rounded-xl flex items-center space-x-2 animate-pulse shadow-lg shadow-red-500/10">
              <Flame size={16} />
              <span className="text-xs font-bold">{criticalCount} Critical Emergency Active</span>
            </div>
          )}

          <button
            onClick={() => {
              setIsMuted(!isMuted);
              if (isMuted) soundAlerts.playEmergencySiren();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title={isMuted ? 'Enable sound alerts for new reports' : 'Mute sound alerts'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-purple-400" />}
            <span className="text-xs ml-2">{isMuted ? 'Enable sound' : 'Sound on'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* 2. Department Filter Navigation Bar */}
      <div className="bg-[#1E293B]/70 border-b border-slate-800 px-4 py-2.5 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {departments.map((dept) => {
            const count = dept.id === 'ALL'
              ? incidents.length
              : incidents.filter(i => i.department === dept.id).length;

            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDept === dept.id
                    ? 'bg-[#5E43F3] text-white shadow-md shadow-purple-500/25'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                }`}
              >
                {dept.icon}
                <span>{dept.name}</span>
                <span className="bg-black/30 text-white/90 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          {['ALL', 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                selectedStatus === st
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Dashboard Workspace (3-Column Layout) */}
      <div className="flex-1 grid grid-cols-12 items-start gap-4 p-4">
        {/* Left Column: Live Incidents Feed (4 Columns) */}
        <div className="col-span-12 lg:col-span-4 min-w-0 flex flex-col space-y-3 lg:overflow-y-auto lg:max-h-[calc(100vh-240px)] pr-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Incoming Incidents ({filteredIncidents.length})
            </h2>
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="bg-slate-800/50 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No incidents matching the selected filter.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              const isCritical = inc.priority === 'CRITICAL' && inc.status !== 'RESOLVED';

              return (
                <button
                  key={inc.id}
                  type="button"
                  aria-label={`Open alert ${inc.id}: ${inc.title}`}
                  aria-haspopup="dialog"
                  onClick={() => openIncident(inc)}
                  className={`w-full text-left shrink-0 focus-visible:outline-2 focus-visible:outline-purple-400 bg-slate-800/90 rounded-2xl p-4 border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-[#5E43F3] shadow-lg shadow-purple-500/10 ring-1 ring-[#5E43F3]'
                      : 'border-slate-700/60 hover:border-slate-600'
                  } ${isCritical ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        inc.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        inc.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {inc.priority}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{inc.id}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      inc.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' :
                      inc.status === 'IN_PROGRESS' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {inc.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white mb-1 leading-snug line-clamp-1">
                    {inc.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 font-medium">
                    {inc.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center space-x-1 truncate max-w-[70%]">
                      <MapPin size={12} className="text-[#5E43F3] flex-shrink-0" />
                      <span className="truncate">{inc.location.address.split(',')[0]}</span>
                    </div>
                    <span>{new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className="mt-3 flex items-center gap-1 text-xs font-bold text-purple-300">
                    Open report <ArrowRight size={14} />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Center / Right: Interactive Map & Triage Inspector (8 Columns) */}
        <div className="col-span-12 lg:col-span-8 min-w-0 flex flex-col space-y-4">
          {/* Top Interactive Tactical Map */}
          <div className="bg-slate-800/90 rounded-2xl p-3 border border-slate-700 shadow-md">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-bold text-slate-300 flex items-center space-x-2">
                <span>Tactical Geographic Map</span>
                <span className="text-[10px] text-slate-400">• Click markers for triage info</span>
              </div>

            </div>
            <div className="h-56 rounded-xl overflow-hidden">
              <InteractiveMap
                incidents={filteredIncidents}
                onIncidentSelect={openIncident}
                height="224px"
                zoom={13}
              />
            </div>
          </div>

        </div>
      </div>

      <dialog
        ref={detailsDialogRef}
        aria-labelledby={detailsTitleId}
        onClose={() => setIsDetailsOpen(false)}
        onCancel={(event) => { if (isUpdating) event.preventDefault(); }}
        className="m-auto w-[calc(100%-1rem)] max-w-4xl max-h-[92dvh] rounded-2xl border border-slate-600 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/70"
      >
        {isDetailsOpen && (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
              <h2 id={detailsTitleId} className="text-base font-bold">Reported Alert Details</h2>
              <button
                type="button"
                aria-label="Close alert details"
                disabled={isUpdating}
                onClick={() => setIsDetailsOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
              >
                <X size={18} /> Close
              </button>
            </div>
            <div className="p-3 sm:p-4">
          {/* Selected Incident Triage Details Console */}
          {selectedIncident ? (
            <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700 shadow-lg space-y-4">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-700/70 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-black text-white">{selectedIncident.title}</span>
                    <span className="text-xs font-mono text-slate-400">({selectedIncident.id})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center space-x-1">
                      <User size={14} className="text-purple-400" />
                      <span>Reporter: {selectedIncident.reportedBy.name}</span>
                    </span>
                    {selectedIncident.reportedBy.phone && (
                      <span className="flex items-center space-x-1 font-mono text-slate-400">
                        <Phone size={14} />
                        <span>{selectedIncident.reportedBy.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    {selectedIncident.department.replace('_', ' ')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Logged {new Date(selectedIncident.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <section aria-label="Report description" className="rounded-xl bg-slate-900 p-3">
                <h3 className="mb-2 text-xs font-bold text-slate-300">Reported Message</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-white">{selectedIncident.description}</p>
              </section>

              {/* Dispatch Action Panel */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Dispatch & Status Triage Workflow</span>
                  <span className="text-[11px] text-slate-400">
                    Current: <b className="text-purple-400">{selectedIncident.status}</b>
                  </span>
                </div>

                {/* Dispatch Unit Assignment inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Unit Name (e.g. Engine 14)"
                    value={assignedUnitName}
                    onChange={(e) => setAssignedUnitName(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Badge ID (e.g. FDNY-E14)"
                    value={assignedUnitBadge}
                    onChange={(e) => setAssignedUnitBadge(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <input
                    type="number"
                    placeholder="ETA (Minutes)"
                    value={etaInput}
                    min="1"
                    onChange={(e) => setEtaInput(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Dispatcher Operational Note (logged to citizen timeline)..."
                  value={dispatcherNote}
                  onChange={(e) => setDispatcherNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />

                {/* Status action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={isUpdating || selectedIncident.status === 'ACKNOWLEDGED'}
                    onClick={() => handleStatusChange('ACKNOWLEDGED')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Acknowledge & Dispatch</span>
                  </button>

                  <button
                    disabled={isUpdating || selectedIncident.status === 'IN_PROGRESS'}
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Truck size={14} />
                    <span>Mark On Scene / In Progress</span>
                  </button>

                  <button
                    disabled={isUpdating || selectedIncident.status === 'RESOLVED'}
                    onClick={() => handleStatusChange('RESOLVED')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Resolve Incident</span>
                  </button>
                </div>
              </div>

              <InteractiveMap selectedLocation={selectedIncident.location} height="224px" />

              {/* Reporter GPS telemetry */}
              <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start space-x-2">
                  <MapPin size={16} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-white">
                      {selectedIncident.location.address}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {selectedIncident.location.lat.toFixed(6)}, {selectedIncident.location.lng.toFixed(6)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  {selectedIncident.location.source === 'GPS' && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-300">
                      DEVICE LOCATION
                    </span>
                  )}
                  {selectedIncident.location.accuracyMeters !== undefined && (
                    <span className="rounded-full bg-slate-700 px-2 py-1 text-slate-200">
                      ±{selectedIncident.location.accuracyMeters} m accuracy
                    </span>
                  )}
                  {selectedIncident.location.capturedAt && (
                    <span className="text-slate-400">
                      Captured {new Date(selectedIncident.location.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Two columns: Photo Evidence & AI Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Media Evidence */}
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">Citizen Uploaded Evidence</div>
                  {selectedIncident.mediaUrl ? (
                    <div className="rounded-xl overflow-hidden border border-slate-700 max-h-52 bg-black">
                      {selectedIncident.mediaType === 'video' ? (
                        <video
                          src={selectedIncident.mediaUrl}
                          className="w-full h-52 object-cover"
                          controls
                        />
                      ) : (
                        <img
                          src={selectedIncident.mediaUrl}
                          alt="Evidence"
                          className="w-full h-52 object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-52 rounded-xl bg-slate-900 border border-slate-700/60 flex flex-col items-center justify-center text-slate-500 text-xs">
                      No media attached
                    </div>
                  )}
                </div>

                {/* AI Triage Report */}
                <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-800/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-purple-400 font-extrabold text-xs">
                        <Sparkles size={16} />
                        <span>AI Triage Inspection</span>
                      </div>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                        {Math.round(selectedIncident.aiAnalysis.confidence * 100)}% Confidence
                      </span>
                    </div>

                    <div className="text-xs text-white font-bold mb-1">
                      Hazard: {selectedIncident.aiAnalysis.hazardType}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                      {selectedIncident.aiAnalysis.reasoning}
                    </p>

                    <div className="text-[11px] bg-slate-900/80 border border-purple-500/30 text-purple-200 p-2.5 rounded-lg mb-2">
                      <span className="font-bold">Recommended Protocol:</span> {selectedIncident.aiAnalysis.recommendedAction}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedIncident.aiAnalysis.extractedKeywords.map((kw, i) => (
                      <span key={i} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>


            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl p-12 text-center text-slate-400">
              Select an incident from the feed to inspect and dispatch.
            </div>
          )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
};
