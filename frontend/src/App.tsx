import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Smartphone, 
  Monitor, 
  RefreshCw, 
  Flame, 
  Car, 
  Building
} from 'lucide-react';
import { Incident, DashboardStats, LocationData } from './types';
import { api } from './services/api';
import { soundAlerts } from './utils/audioAlert';
import { MobileFrame, type MobileTab } from './components/common/MobileFrame';
import { OnboardingScreen } from './components/citizen/OnboardingScreen';
import { HomeScreen } from './components/citizen/HomeScreen';
import { ActiveSosScreen } from './components/citizen/ActiveSosScreen';
import { ReportIncidentScreen } from './components/citizen/ReportIncidentScreen';
import { IncidentTrackerScreen } from './components/citizen/IncidentTrackerScreen';
import { CommunityAlertsScreen } from './components/citizen/CommunityAlertsScreen';
import { AuthorityDashboard } from './components/authority/AuthorityDashboard';

import { isFreshLiveLocation, locationService } from './services/locationService';

type CitizenScreen = 'ONBOARDING' | 'HOME' | 'ACTIVE_SOS' | 'REPORT' | 'TRACKING' | 'ALERTS';
type ViewRole = 'CITIZEN' | 'AUTHORITY' | 'SPLIT_VIEW';

export function App() {
  const [role, setRole] = useState<ViewRole>('CITIZEN');
  const [citizenScreen, setCitizenScreen] = useState<CitizenScreen>('ONBOARDING');
  const [bottomTab, setBottomTab] = useState<MobileTab>('home');
  
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const sendingSosRef = useRef(false);
  const loadingRef = useRef(false);
  const dataVersionRef = useRef(0);

  // Live GPS Location of the user
  const [userLocation, setUserLocation] = useState<LocationData>({
    lat: 40.7128,
    lng: -74.0060,
    address: 'Waiting for precise GPS location',
    capturedAt: new Date().toISOString(),
    source: 'FALLBACK',
  });

  // Fetch real live GPS location on startup & watch
  const refreshLiveLocation = useCallback(async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      setUserLocation(loc);
    } catch (e) {
      console.warn('Error fetching live location:', e);
    }
  }, []);

  useEffect(() => {
    const watchId = locationService.watchLiveLocation((loc) => {
      setUserLocation(loc);
    });

    return () => {
      locationService.clearWatch(watchId);
    };
  }, [refreshLiveLocation]);

  // Load incidents & stats
  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const version = dataVersionRef.current;
    try {
      const [list, s] = await Promise.all([api.getIncidents(), api.getStats()]);
      if (version !== dataVersionRef.current) return;
      setIncidents(list);
      setStats(s);
      setSyncError(null);

      // Keep selected incident updated in real-time
      setSelectedIncident((current) => {
        if (!current) return current;
        return list.find((incident) => incident.id === current.id) ?? current;
      });
    } catch (err) {
      console.error('Failed loading incidents', err);
      setSyncError('Unable to sync the authority dashboard. ' + (err instanceof Error ? err.message : 'Please retry.'));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // The effect intentionally starts synchronization with the API.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadData();
    const interval = window.setInterval(() => void loadData(), 3000);
    window.addEventListener('online', loadData);
    window.addEventListener('focus', loadData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', loadData);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  // SOS Quick Trigger
  const handleTriggerSos = async () => {
    if (sendingSosRef.current) return;
    sendingSosRef.current = true;
    setIsSendingSos(true);
    try {
      const liveLocation = isFreshLiveLocation(userLocation)
        ? userLocation
        : await locationService.getAccurateCurrentLocation();
      setUserLocation(liveLocation);

      const formData = new FormData();
      formData.append('title', 'CRITICAL EMERGENCY SOS TRIGGERED');
      formData.append('description', 'Citizen pressed instant SOS emergency button. Urgent dispatch needed.');
      formData.append('categoryHint', 'FIRE');
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
      formData.append('isEmergencySOS', 'true');

      const created = await api.createIncident(formData);
      dataVersionRef.current++;
      setIncidents((current) => [created, ...current.filter((incident) => incident.id !== created.id)]);
      setSelectedIncident(created);
      setCitizenScreen('ACTIVE_SOS');
      void loadData();
    } catch (err) {
      console.error('SOS Trigger Error', err);
      alert(err instanceof Error ? err.message : 'Unable to acquire your live GPS location.');
    } finally {
      sendingSosRef.current = false;
      setIsSendingSos(false);
    }
  };

  const handleIncidentSubmitted = (created: Incident) => {
    dataVersionRef.current++;
    setIncidents((current) => [created, ...current.filter((incident) => incident.id !== created.id)]);
    setSelectedIncident(created);
    setCitizenScreen('TRACKING');
    void loadData();
  };

  const handleBottomTabChange = (tab: MobileTab) => {
    setBottomTab(tab);
    if (tab === 'home') setCitizenScreen('HOME');
    else if (tab === 'report') setCitizenScreen('REPORT');
    else if (tab === 'alerts') setCitizenScreen('ALERTS');
    else if (tab === 'sos') void handleTriggerSos();
  };

  const handleExitSos = () => {
    setCitizenScreen('HOME');
    setBottomTab('home');
  };

  // Quick Demo Simulator
  const handleSimulateIncident = async (type: 'FIRE' | 'ACCIDENT' | 'CIVIC') => {
    const formData = new FormData();
    if (type === 'FIRE') {
      formData.append('title', 'Roof Fire & Toxic Smoke Flare');
      formData.append('description', 'Large flames breaking through roof tiles on 3rd avenue warehouse. Neighbors evacuating.');
      formData.append('categoryHint', 'FIRE');
      formData.append('lat', '40.7350');
      formData.append('lng', '-73.9910');
      formData.append('address', '3rd Ave & 14th St, Union Square');
    } else if (type === 'ACCIDENT') {
      formData.append('title', 'Delivery Van Rollover on Highway');
      formData.append('description', 'Van flipped over on shoulder, driver injured, fuel leaking onto asphalt.');
      formData.append('categoryHint', 'ACCIDENT');
      formData.append('lat', '40.7520');
      formData.append('lng', '-73.9780');
      formData.append('address', 'FDR Drive & E 42nd St');
    } else {
      formData.append('title', 'Major Water Main Geyser Rupture');
      formData.append('description', 'Water bursting 10 feet into the air from sidewalk main valve, flooding road.');
      formData.append('categoryHint', 'CIVIC');
      formData.append('lat', '40.7610');
      formData.append('lng', '-73.9820');
      formData.append('address', 'W 50th St & 8th Ave, Theater District');
    }

    formData.append('reporterName', 'Citizen Alert');
    const created = await api.createIncident(formData);
    soundAlerts.playEmergencySiren();
    setSelectedIncident(created);
    void loadData();
  };

  return (
    <div className="min-h-screen bg-[#ECEBF5] text-[#1E1B4B] flex flex-col font-sans">
      {/* Universal Top Ecosystem Control Bar */}
      <nav className="bg-[#1E1B4B] text-white px-4 py-2.5 flex flex-wrap items-center justify-between shadow-lg z-50">
        <div className="flex items-center space-x-2.5">
          <img
            src="/rapidresq-logo-transparent.png"
            alt="RapidResQ Disaster Management App"
            className="h-11 w-11 object-contain drop-shadow-md"
          />
          <span className="text-sm font-extrabold tracking-wide text-white">RapidResQ</span>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center space-x-2 my-1">
          <button
            onClick={() => setRole('CITIZEN')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              role === 'CITIZEN'
                ? 'bg-[#5E43F3] text-white shadow-md shadow-purple-500/30'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Smartphone size={14} />
            <span>Citizen Mobile App</span>
          </button>

          <button
            onClick={() => setRole('AUTHORITY')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              role === 'AUTHORITY'
                ? 'bg-[#5E43F3] text-white shadow-md shadow-purple-500/30'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Monitor size={14} />
            <span>Authority Command Center</span>
          </button>

          <button
            onClick={() => setRole('SPLIT_VIEW')}
            className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              role === 'SPLIT_VIEW'
                ? 'bg-[#5E43F3] text-white shadow-md shadow-purple-500/30'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span>📱 ↔ 🖥️ Live Split Demo</span>
          </button>
        </div>

        {/* Instant Simulation Buttons & Reset */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-[11px] text-white/60 mr-1 hidden sm:inline">Simulate:</span>
          <button
            onClick={() => handleSimulateIncident('FIRE')}
            className="bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40 px-2 py-1 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
            title="Inject Critical Fire Alert"
          >
            <Flame size={12} />
            <span>Fire</span>
          </button>
          <button
            onClick={() => handleSimulateIncident('ACCIDENT')}
            className="bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 border border-orange-500/40 px-2 py-1 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
            title="Inject Road Accident"
          >
            <Car size={12} />
            <span>Accident</span>
          </button>
          <button
            onClick={() => handleSimulateIncident('CIVIC')}
            className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-500/40 px-2 py-1 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
            title="Inject Civic Rupture"
          >
            <Building size={12} />
            <span>Civic</span>
          </button>

          <button
            onClick={async () => {
              await api.resetSeed();
              void loadData();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 ml-2"
            title="Reset to initial seed"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </nav>

      {syncError && (
        <div role="alert" className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          {syncError} <button onClick={() => void loadData()} className="font-bold underline">Retry</button>
        </div>
      )}
      {isSendingSos && (
        <div role="status" className="bg-red-50 px-4 py-2 text-center text-sm font-bold text-red-700">
          Sending SOS and device location to the authority dashboard...
        </div>
      )}
      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {role === 'CITIZEN' && (
          <div className="py-4 flex justify-center w-full">
            <MobileFrame
              activeTab={bottomTab}
              onTabChange={handleBottomTabChange}
              hideBottomNav={citizenScreen === 'ONBOARDING' || citizenScreen === 'ACTIVE_SOS'}
            >
              {citizenScreen === 'ONBOARDING' && (
                <OnboardingScreen onGetStarted={() => setCitizenScreen('HOME')} />
              )}
              {citizenScreen === 'HOME' && (
                <HomeScreen
                  onTriggerSos={handleTriggerSos}
                  onNavigateReport={() => setCitizenScreen('REPORT')}
                  onNavigateAlerts={() => setCitizenScreen('ALERTS')}
                  onSelectIncident={(inc) => {
                    setSelectedIncident(inc);
                    setCitizenScreen('TRACKING');
                  }}
                  recentIncidents={incidents}
                  userLocation={userLocation}
                  onRefreshLocation={refreshLiveLocation}
                />
              )}
              {citizenScreen === 'ACTIVE_SOS' && (
                <ActiveSosScreen
                  userLocation={selectedIncident?.location ?? userLocation}
                  onBack={handleExitSos}
                  onCancelSos={handleExitSos}
                />
              )}
              {citizenScreen === 'REPORT' && (
                <ReportIncidentScreen
                  currentLocation={userLocation}
                  onBack={() => setCitizenScreen('HOME')}
                  onIncidentSubmitted={handleIncidentSubmitted}
                />
              )}
              {citizenScreen === 'TRACKING' && selectedIncident && (
                <IncidentTrackerScreen
                  incident={selectedIncident}
                  onBack={() => setCitizenScreen('HOME')}
                />
              )}
              {citizenScreen === 'ALERTS' && (
                <CommunityAlertsScreen
                  incidents={incidents}
                  onBack={() => setCitizenScreen('HOME')}
                  onSelectIncident={(inc) => {
                    setSelectedIncident(inc);
                    setCitizenScreen('TRACKING');
                  }}
                />
              )}
            </MobileFrame>
          </div>
        )}

        {role === 'AUTHORITY' && (
          <div className="w-full h-full">
            <AuthorityDashboard
              incidents={incidents}
              stats={stats}
              onRefresh={loadData}
              onUpdateIncident={(updated) => {
                setSelectedIncident(updated);
                void loadData();
              }}
            />
          </div>
        )}

        {role === 'SPLIT_VIEW' && (
          <div className="w-full h-[88vh] grid grid-cols-12 gap-6 items-center">
            {/* Left: Citizen App Container */}
            <div className="col-span-12 lg:col-span-5 flex justify-center">
              <MobileFrame
                activeTab={bottomTab}
                onTabChange={handleBottomTabChange}
                hideBottomNav={citizenScreen === 'ONBOARDING' || citizenScreen === 'ACTIVE_SOS'}
              >
                {citizenScreen === 'ONBOARDING' && (
                  <OnboardingScreen onGetStarted={() => setCitizenScreen('HOME')} />
                )}
                {citizenScreen === 'HOME' && (
                  <HomeScreen
                    onTriggerSos={handleTriggerSos}
                    onNavigateReport={() => setCitizenScreen('REPORT')}
                    onNavigateAlerts={() => setCitizenScreen('ALERTS')}
                    onSelectIncident={(inc) => {
                      setSelectedIncident(inc);
                      setCitizenScreen('TRACKING');
                    }}
                    recentIncidents={incidents}
                    userLocation={userLocation}
                    onRefreshLocation={refreshLiveLocation}
                  />
                )}
                {citizenScreen === 'ACTIVE_SOS' && (
                  <ActiveSosScreen
                    userLocation={selectedIncident?.location ?? userLocation}
                    onBack={handleExitSos}
                    onCancelSos={handleExitSos}
                  />
                )}
                {citizenScreen === 'REPORT' && (
                  <ReportIncidentScreen
                    currentLocation={userLocation}
                    onBack={() => setCitizenScreen('HOME')}
                    onIncidentSubmitted={handleIncidentSubmitted}
                  />
                )}
                {citizenScreen === 'TRACKING' && selectedIncident && (
                  <IncidentTrackerScreen
                    incident={selectedIncident}
                    onBack={() => setCitizenScreen('HOME')}
                  />
                )}
                {citizenScreen === 'ALERTS' && (
                  <CommunityAlertsScreen
                    incidents={incidents}
                    onBack={() => setCitizenScreen('HOME')}
                    onSelectIncident={(inc) => {
                      setSelectedIncident(inc);
                      setCitizenScreen('TRACKING');
                    }}
                  />
                )}
              </MobileFrame>
            </div>

            {/* Right: Authority Command Center */}
            <div className="col-span-12 lg:col-span-7 h-full rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
              <AuthorityDashboard
                incidents={incidents}
                stats={stats}
                onRefresh={loadData}
                onUpdateIncident={(updated) => {
                  setSelectedIncident(updated);
                  void loadData();
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
