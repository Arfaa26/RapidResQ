import React, { useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Incident } from '../../types';
import { InteractiveMap } from '../common/InteractiveMap';

interface CommunityAlertsScreenProps {
  incidents: Incident[];
  onBack: () => void;
  onSelectIncident: (inc: Incident) => void;
}

export const CommunityAlertsScreen: React.FC<CommunityAlertsScreenProps> = ({
  incidents,
  onBack,
  onSelectIncident,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filtered = filterCategory === 'ALL'
    ? incidents
    : incidents.filter((i) => i.category === filterCategory);

  return (
    <div className="flex flex-col min-h-full bg-[#F5F4FA] text-[#1E1B4B] p-4 select-none pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1E1B4B] shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-extrabold text-[#1E1B4B] tracking-wide">Community Safety Map</h1>
        <div className="w-10" />
      </div>

      {/* Map View */}
      <div className="h-48 rounded-3xl overflow-hidden shadow-sm mb-4 border border-purple-100">
        <InteractiveMap incidents={filtered} height="192px" zoom={12} />
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {['ALL', 'FIRE', 'ACCIDENT', 'CIVIC'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              filterCategory === cat
                ? 'bg-[#5E43F3] text-white shadow-md shadow-purple-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {cat === 'ALL' ? 'All Alerts' : cat === 'FIRE' ? '🔥 Fire' : cat === 'ACCIDENT' ? '🚗 Accidents' : '🏛️ Civic'}
          </button>
        ))}
      </div>

      {/* List of Alerts */}
      <div className="space-y-2.5">
        {filtered.map((inc) => (
          <div
            key={inc.id}
            onClick={() => onSelectIncident(inc)}
            className="bg-white rounded-2xl p-3.5 shadow-sm hover:shadow-md cursor-pointer transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between mb-1.5">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                inc.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                inc.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {inc.priority}
              </span>
              <span className="text-[10px] font-bold text-[#5E43F3] bg-purple-50 px-2 py-0.5 rounded-full">
                {inc.status}
              </span>
            </div>

            <div className="text-xs font-extrabold text-[#1E1B4B] mb-1">{inc.title}</div>
            <p className="text-[11px] text-gray-500 line-clamp-2 mb-2 font-medium">{inc.description}</p>

            <div className="flex items-center text-[10px] text-gray-400">
              <MapPin size={12} className="text-[#5E43F3] mr-1" />
              <span className="truncate">{inc.location.address}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
