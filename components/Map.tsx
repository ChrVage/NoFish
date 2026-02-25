'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on Norwegian coast
    const map = L.map(mapContainerRef.current, {
      center: [62.0, 6.5], // Central Norway
      zoom: 6,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom marker icon using ocean theme
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="w-8 h-8 bg-ocean-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-ocean-700 transition-colors">
        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6z"/>
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Handle map clicks
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Add temporary marker at clicked position
      const tempMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      // Create popup with three navigation links
      const popupContent = document.createElement('div');
      popupContent.className = 'text-sm';
      popupContent.innerHTML = `
        <div class="min-w-[180px]">
          <strong class="text-ocean-700 block mb-1" id="location-name">Loading...</strong>
          <div class="text-gray-500 text-xs mb-3">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
          <div class="flex flex-col gap-1.5">
            <button id="go-score" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm">
              <svg width="10" height="10" style="flex-shrink:0;color:#16a34a" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              Score
            </button>
            <button id="go-details" class="w-full bg-ocean-500 hover:bg-ocean-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm">
              <svg width="10" height="10" style="flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
              </svg>
              Details
            </button>
            <button id="go-tide" class="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm">
              <svg width="10" height="10" style="flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
              </svg>
              Tides
            </button>
          </div>
        </div>
      `;

      // Bind popup and open it
      tempMarker.bindPopup(popupContent, {
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
      }).openPopup();

      // Fetch location name from geocoding API and update popup
      (async () => {
        try {
          const response = await fetch(
            `/api/geocoding?lat=${lat}&lon=${lng}`
          );

          if (response.ok) {
            const result = await response.json();
            const name = result.data?.name ||
              result.data?.municipality ||
              result.data?.displayName ||
              'Unknown location';
            
            // Update popup name
            const nameElement = document.getElementById('location-name');
            if (nameElement) {
              nameElement.textContent = name;
            }
          } else {
            console.error('Geocoding failed with status:', response.status);
            const nameElement = document.getElementById('location-name');
            if (nameElement) {
              nameElement.textContent = 'Unknown location';
            }
          }
        } catch (error) {
          console.error('Geocoding error:', error);
          const nameElement = document.getElementById('location-name');
          if (nameElement) {
            nameElement.textContent = 'Unknown location';
          }
        }
      })();

      const navigate = (path: string) => {
        map.removeLayer(tempMarker);
        map.closePopup();
        router.push(path);
      };

      popupContent.querySelector('#go-score')?.addEventListener('click', () =>
        navigate(`/score?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
      );
      popupContent.querySelector('#go-details')?.addEventListener('click', () =>
        navigate(`/details?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
      );
      popupContent.querySelector('#go-tide')?.addEventListener('click', () =>
        navigate(`/tide?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
      );

      // Clean up when popup closes
      tempMarker.on('popupclose', () => {
        map.removeLayer(tempMarker);
      });
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [router]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="map-container w-full h-full" />
      
      {/* Map instructions overlay */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-[1000]">
        <h3 className="text-ocean-700 font-semibold mb-2">🎣 Select your fishing spot</h3>
        <p className="text-sm text-gray-700">
          Click anywhere on the Norwegian coast to analyze fishing conditions.
        </p>
      </div>
    </div>
  );
}
