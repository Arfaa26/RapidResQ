import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, LocationData } from '../../types';

interface InteractiveMapProps {
  incidents?: Incident[];
  selectedLocation?: LocationData | null;
  onLocationSelect?: (loc: LocationData) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  isPicker?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  incidents = [],
  selectedLocation,
  onLocationSelect,
  center = [40.730610, -73.935242],
  zoom = 13,
  height = '350px',
  isPicker = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: !isPicker,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      if (isPicker && onLocationSelect) {
        map.on('click', (e) => {
          onLocationSelect({
            lat: Number(e.latlng.lat.toFixed(5)),
            lng: Number(e.latlng.lng.toFixed(5)),
            address: `Pin at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`,
          });
        });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    // 1. If in picker mode with selected location
    if (selectedLocation) {
      const customPin = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="
            background: linear-gradient(135deg, #5E43F3, #8F77FB);
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 14px rgba(94,67,243,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: customPin });
      marker.bindPopup(`<b>Selected Incident Location</b><br/>${selectedLocation.address}`);
      markersRef.current.addLayer(marker);
      mapInstanceRef.current.setView([selectedLocation.lat, selectedLocation.lng], 14);
      return;
    }

    // 2. Incident pins for dispatch overview
    incidents.forEach((inc) => {
      let bg = '#5E43F3';
      let iconEmoji = '📍';
      let pulseRing = '';

      if (inc.priority === 'CRITICAL') {
        bg = '#FA3E3E';
        pulseRing = 'box-shadow: 0 0 0 8px rgba(250, 62, 62, 0.35); animation: pulse-ring 2s infinite;';
      } else if (inc.category === 'FIRE') {
        bg = '#FF5722';
        iconEmoji = '🔥';
      } else if (inc.category === 'ACCIDENT') {
        bg = '#FF9800';
        iconEmoji = '🚗';
      } else if (inc.category === 'CIVIC') {
        bg = '#3B82F6';
        iconEmoji = '🏛️';
      }

      const icon = L.divIcon({
        className: 'incident-marker',
        html: `
          <div style="
            background: ${bg};
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid white;
            ${pulseRing}
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            cursor: pointer;
          ">
            ${iconEmoji}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([inc.location.lat, inc.location.lng], { icon });
      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 180px;">
          <div style="font-weight: 700; font-size: 14px; color: #1E1B4B; margin-bottom: 4px;">${inc.title}</div>
          <div style="font-size: 12px; color: #64748B; margin-bottom: 6px;">📍 ${inc.location.address}</div>
          <div style="display: flex; gap: 4px; font-size: 11px; font-weight: 600;">
            <span style="background: ${inc.priority === 'CRITICAL' ? '#FEE2E2' : '#EFF6FF'}; color: ${inc.priority === 'CRITICAL' ? '#DC2626' : '#2563EB'}; padding: 2px 6px; border-radius: 6px;">
              ${inc.priority}
            </span>
            <span style="background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 6px;">
              ${inc.status}
            </span>
          </div>
        </div>
      `);
      markersRef.current?.addLayer(marker);
    });

    if (incidents.length > 0 && !selectedLocation) {
      const group = new L.FeatureGroup(markersRef.current.getLayers() as L.Layer[]);
      if (group.getBounds().isValid()) {
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
      }
    }
  }, [incidents, selectedLocation]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height, width: '100%', borderRadius: '1.25rem', overflow: 'hidden', zIndex: 1 }}
      className="shadow-inner"
    />
  );
};
