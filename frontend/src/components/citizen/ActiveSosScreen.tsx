import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Bell, 
  Phone, 
  ShieldCheck, 
  Navigation
} from 'lucide-react';
import { LocationData } from '../../types';
import { InteractiveMap } from '../common/InteractiveMap';
import { soundAlerts } from '../../utils/audioAlert';

interface ActiveSosScreenProps {
  onBack: () => void;
  onCancelSos: () => void;
  userLocation: LocationData;
}

export const ActiveSosScreen: React.FC<ActiveSosScreenProps> = ({
  onBack,
  onCancelSos,
  userLocation,
}) => {
  const [callingName, setCallingName] = useState<string | null>(null);

  const emergencyContacts = [
    {
      name: 'James Smith',
      role: 'Emergency Contact • Brother',
      phone: '+1 (555) 123-4567',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    },
    {
      name: 'Sophia Williams',
      role: 'Emergency Contact • Partner',
      phone: '+1 (555) 987-6543',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    },
    {
      name: 'Michael Brown',
      role: 'Emergency Contact • Father',
      phone: '+1 (555) 456-7890',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
    },
  ];

  const handleCall = (name: string) => {
    soundAlerts.playChime();
    setCallingName(name);
    setTimeout(() => setCallingName(null), 3500);
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F5F4FA] text-[#1E1B4B] p-4 select-none pb-8">
      {/* 1. Navigation Top Bar matching design */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1E1B4B] shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-extrabold text-[#1E1B4B] tracking-wide">SOS</h1>
        <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1E1B4B] shadow-sm hover:shadow-md active:scale-95 transition-all">
          <Settings size={18} />
        </button>
      </div>

      {/* 2. Central Pulsating SOS Radar Beacon matching design */}
      <div className="flex flex-col items-center justify-center my-4 relative">
        {/* Radiating Ripple Glow Rings */}
        <div className="relative flex items-center justify-center w-36 h-36">
          <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse-ring pointer-events-none" />
          <div className="absolute -inset-4 rounded-full bg-red-500/5 animate-pulse-ring-slow pointer-events-none" />
          
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FF3B30] to-[#FF5252] flex items-center justify-center text-white shadow-xl shadow-red-500/30">
            <div className="w-16 h-16 rounded-full bg-[#FA3E3E] flex items-center justify-center border-2 border-white/40 shadow-inner">
              <Bell size={28} className="animate-bounce text-white" />
            </div>
          </div>
        </div>

        {/* SOS Activated Titles */}
        <h2 className="text-lg font-black text-[#FA3E3E] mt-3 mb-1 tracking-tight">
          SOS Activated
        </h2>
        <p className="text-xs text-[#6B7280] text-center max-w-xs font-medium leading-snug">
          Your alert has been sent to emergency responders and trusted contacts.
        </p>
      </div>

      {/* 3. Live Location Sharing Card matching design */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#1E1B4B]">Live Location Sharing</span>
            <span className="text-[10px] font-bold bg-[#ECFDF5] text-[#10B981] px-2 py-0.5 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
              <span>Active</span>
            </span>
          </div>
          <Navigation size={14} className="text-[#5E43F3]" />
        </div>
        <p className="text-[11px] text-[#6B7280] mb-2 font-medium">
          {userLocation.address}
        </p>
        <div className="h-28 rounded-xl overflow-hidden shadow-inner border border-gray-100">
          <InteractiveMap
            selectedLocation={userLocation}
            height="112px"
            zoom={15}
          />
        </div>
      </div>

      {/* 4. Alert Sent To (3) Contacts List matching design */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-bold text-[#1E1B4B]">Alert Sent To ({emergencyContacts.length})</h3>
        <span className="text-[11px] text-[#6B7280] font-semibold">Tap to call</span>
      </div>

      <div className="space-y-2 mb-5">
        {emergencyContacts.map((contact, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
              />
              <div>
                <div className="text-xs font-bold text-[#1E1B4B]">{contact.name}</div>
                <div className="text-[10px] text-[#6B7280] font-medium">{contact.phone}</div>
              </div>
            </div>

            <button
              onClick={() => handleCall(contact.name)}
              className="w-9 h-9 rounded-full bg-[#F4F3FA] hover:bg-emerald-50 text-[#1E1B4B] hover:text-[#10B981] flex items-center justify-center transition-colors active:scale-95 shadow-sm"
            >
              <Phone size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Dispatch Response Notice */}
      <div className="bg-purple-50/80 border border-purple-100 rounded-2xl p-3 flex items-center space-x-2.5 mb-5 text-[#5E43F3]">
        <ShieldCheck size={18} className="flex-shrink-0" />
        <span className="text-[11px] font-semibold leading-tight">
          Central Dispatch & First Responders have received high-priority GPS telemetry.
        </span>
      </div>

      {/* 5. Cancel SOS Button matching design */}
      <button
        onClick={onCancelSos}
        className="w-full bg-[#FA3E3E] hover:bg-[#E52D2D] active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-full shadow-lg shadow-red-500/25 transition-all text-sm tracking-wide cursor-pointer"
      >
        Cancel SOS
      </button>

      {/* Simulated Call Overlay */}
      {callingName && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] text-white w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 mx-auto flex items-center justify-center mb-3">
              <Phone size={28} className="animate-pulse" />
            </div>
            <div className="text-xs text-gray-400">Calling Emergency Contact...</div>
            <div className="text-base font-bold my-1">{callingName}</div>
            <div className="text-xs text-green-400 font-medium">Connecting audio channel...</div>
          </div>
        </div>
      )}
    </div>
  );
};
