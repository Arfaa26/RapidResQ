import { LocationData } from '../types';

export const locationService = {
  // Get one-time high accuracy live location with reverse geocoding
  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        resolve(getDefaultLocation());
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = Number(position.coords.latitude.toFixed(5));
          const lng = Number(position.coords.longitude.toFixed(5));
          
          try {
            // Reverse geocode to get real street address / city
            const address = await reverseGeocode(lat, lng);
            resolve({ lat, lng, address });
          } catch (err) {
            console.warn('Reverse geocoding failed, using coordinates', err);
            resolve({
              lat,
              lng,
              address: `Live GPS: ${lat}, ${lng}`,
            });
          }
        },
        (error) => {
          console.warn('Geolocation permission error or unavailable:', error.message);
          resolve(getDefaultLocation());
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  },

  // Watch position in real-time
  watchLiveLocation(onUpdate: (loc: LocationData) => void): number | null {
    if (!navigator.geolocation) return null;

    return navigator.geolocation.watchPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        try {
          const address = await reverseGeocode(lat, lng);
          onUpdate({ lat, lng, address });
        } catch {
          onUpdate({
            lat,
            lng,
            address: `Live GPS: ${lat}, ${lng}`,
          });
        }
      },
      (err) => console.warn('Live watch position error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  },

  clearWatch(watchId: number | null) {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RapidResQ-EmergencyApp/1.0',
        },
      }
    );
    if (!res.ok) throw new Error('Geocoding response not ok');
    const data = await res.json();
    
    if (data && data.display_name) {
      // Create concise readable address
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.suburb || '';
      const city = addr.city || addr.town || addr.village || addr.county || '';
      const state = addr.state || '';
      
      const parts = [road, city, state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
    }
    return `Live Location at ${lat}, ${lng}`;
  } catch (e) {
    return `Live GPS: ${lat}, ${lng}`;
  }
}

function getDefaultLocation(): LocationData {
  return {
    lat: 40.7128,
    lng: -74.0060,
    address: 'Downtown Metropolitan Area',
  };
}
