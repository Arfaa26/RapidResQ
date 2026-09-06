import React from 'react';
import { ArrowRight, Bell, Shield, MapPin, User } from 'lucide-react';

interface OnboardingScreenProps {
  onGetStarted: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onGetStarted }) => {
  return (
    <div className="relative min-h-full flex flex-col justify-between p-6 bg-[#F5F4FA] text-[#1E1B4B] select-none">
      {/* Subtle background radar circles and floating badge dots matching design */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-left notification badge */}
        <div className="absolute top-16 left-12 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shadow-lg shadow-red-500/20 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-[#FA3E3E] flex items-center justify-center text-white shadow-md">
            <Bell size={16} />
          </div>
        </div>

        {/* Floating locator pin dot */}
        <div className="absolute top-28 right-16 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
          <MapPin size={12} className="text-[#5E43F3]" />
        </div>

        <div className="absolute top-64 left-10 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#5E43F3]" />
        </div>

        {/* User avatar dot */}
        <div className="absolute bottom-60 right-14 w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-white shadow-sm">
            <User size={16} />
          </div>
        </div>
      </div>

      {/* Center 3D Shield Hero */}
      <div className="flex-1 flex flex-col items-center justify-center relative my-auto py-12">
        {/* Concentric Radar Rings */}
        <div className="absolute w-72 h-72 rounded-full border border-purple-200/60 pointer-events-none" />
        <div className="absolute w-96 h-96 rounded-full border border-purple-100/40 pointer-events-none" />

        {/* 3D Neumorphic Purple Shield matching design */}
        <div className="relative z-10 w-44 h-48 rounded-[2.5rem] bg-gradient-to-b from-[#7C63FA] via-[#654AF7] to-[#4F33EC] p-3 flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(94,67,243,0.35)] animate-float">
          {/* Inner Gloss / Bevel */}
          <div className="w-full h-full rounded-[2rem] bg-gradient-to-b from-white/20 to-transparent p-[2px] flex items-center justify-center">
            <div className="w-full h-full rounded-[1.9rem] bg-gradient-to-b from-[#6D53F9] to-[#4E34E9] flex flex-col items-center justify-center relative shadow-inner">
              <Shield size={52} className="text-white fill-white/10 drop-shadow-md mb-2" />
              <span className="text-white font-extrabold text-2xl tracking-wider drop-shadow-sm">SOS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Content Area */}
      <div className="relative z-10 pt-4 pb-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#191641] leading-tight mb-3">
          Help is <br />
          <span className="text-[#5E43F3]">Just a Tap Away</span>
        </h1>
        <p className="text-[#6B7280] text-sm leading-relaxed mb-8 max-w-xs font-medium">
          Stay protected. Get help instantly. Because your safety matters.
        </p>

        {/* Pill Action Button matching reference */}
        <button
          onClick={onGetStarted}
          className="w-full bg-[#5E43F3] hover:bg-[#4E33EC] active:scale-[0.98] transition-all duration-200 text-white font-semibold py-4 px-6 rounded-full flex items-center justify-between shadow-lg shadow-purple-500/25 cursor-pointer group"
        >
          <span className="text-base tracking-wide font-medium pl-2">Get Started</span>
          <div className="w-10 h-10 rounded-full bg-white text-[#5E43F3] flex items-center justify-center shadow-md group-hover:translate-x-1 transition-transform">
            <ArrowRight size={20} className="stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
};
