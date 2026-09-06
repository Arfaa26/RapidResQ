import React from 'react';
import { Wifi, Battery, Signal, Home, Camera, Bell, User } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTab?: 'home' | 'report' | 'alerts' | 'profile';
  onTabChange?: (tab: 'home' | 'report' | 'alerts' | 'profile') => void;
  hideBottomNav?: boolean;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  activeTab = 'home',
  onTabChange,
  hideBottomNav = false,
}) => {
  const tabs: { id: 'home' | 'report' | 'alerts' | 'profile'; icon: React.ReactNode }[] = [
    { id: 'home', icon: <Home size={22} className="stroke-[2.5]" /> },
    { id: 'report', icon: <Camera size={22} className="stroke-[2.5]" /> },
    { id: 'alerts', icon: <Bell size={22} className="stroke-[2.5]" /> },
    { id: 'profile', icon: <User size={22} className="stroke-[2.5]" /> },
  ];

  const activeIndex = Math.max(0, tabs.findIndex(t => t.id === activeTab));

  return (
    <div className="relative w-full max-w-[400px] h-[844px] max-h-[92vh] bg-[#F5F4FA] rounded-[2.8rem] shadow-[0_25px_60px_-15px_rgba(94,67,243,0.3)] border-[9px] border-[#1C1A2E] overflow-hidden flex flex-col select-none">
      {/* 1. iOS Status Bar (9:41 + Icons matching reference design) */}
      <div className="pt-3 px-7 pb-1 flex items-center justify-between text-[#1E1B4B] text-xs font-semibold z-30 bg-[#F5F4FA]/90 backdrop-blur-sm">
        <span className="font-bold tracking-tight">9:41</span>
        
        {/* Notch / Speaker pill */}
        <div className="w-24 h-4 bg-[#1C1A2E] rounded-full mx-auto -mt-1 flex items-center justify-center">
          <div className="w-10 h-1 bg-[#2E2B47] rounded-full" />
        </div>

        <div className="flex items-center space-x-1.5 text-[#1E1B4B]">
          <Signal size={12} className="stroke-[2.5]" />
          <Wifi size={12} className="stroke-[2.5]" />
          <Battery size={14} className="stroke-[2.5]" />
        </div>
      </div>

      {/* 2. Scrollable App Screen Viewport */}
      <div className="flex-1 overflow-y-auto relative scrollbar-none">
        {children}
      </div>

      {/* 3. Flashlight Spotlight Moving Bottom Navigation Bar matching design */}
      {!hideBottomNav && onTabChange && (
        <div className="absolute bottom-4 inset-x-5 z-30 flex justify-center">
          <div className="relative w-full max-w-[320px] bg-[#424242] rounded-full py-1.5 px-2 shadow-[0_12px_28px_rgba(0,0,0,0.35)] flex items-center overflow-hidden border border-[#525252]/50">
            {/* Animated Moving Flashlight Spotlight Beam */}
            <div
              className="absolute top-0 bottom-0 w-1/4 flex flex-col items-center pointer-events-none transition-all duration-300 ease-out"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            >
              {/* Flashlight Bulb Capsule at Top Edge */}
              <div className="w-11 h-1.5 rounded-full flashlight-bulb -mt-0.5 z-20" />

              {/* Downward Conical Light Beam */}
              <div className="w-full flex-1 spotlight-beam z-10 -mt-0.5" />
            </div>

            {/* Navigation Tabs */}
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="relative z-20 flex-1 py-2 flex items-center justify-center transition-all cursor-pointer group"
                >
                  <div
                    className={`transition-all duration-300 transform flex items-center justify-center ${
                      isActive
                        ? 'text-white fill-white scale-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.7)]'
                        : 'text-[#1C1C1C] hover:text-[#111111] fill-[#1C1C1C]'
                    }`}
                  >
                    {tab.icon}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. iOS Home Indicator Bar */}
      <div className="w-32 h-1 bg-gray-400/50 rounded-full mx-auto mb-1.5 pointer-events-none z-30" />
    </div>
  );
};
