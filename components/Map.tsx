'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  onPositionConfirm?: (lat: number, lng: number) => void;
}

export default function Map({ onPositionConfirm }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMarker, setSelectedMarker] = useState<L.Marker | null>(null);
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

      // Remove previous marker if exists
      if (selectedMarker) {
        map.removeLayer(selectedMarker);
        setSelectedMarker(null);
      }

      // Add temporary marker at clicked position
      const tempMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      // Create popup with confirm button
      const popupContent = document.createElement('div');
      popupContent.className = 'text-sm';
      popupContent.innerHTML = `
        <div class="min-w-[200px]">
          <strong class="text-ocean-700 block mb-2" id="location-name">Loading...</strong>
          <div class="text-gray-600 text-xs mb-3">
            <span>Lat: ${lat.toFixed(4)}</span><br/>
            <span>Lng: ${lng.toFixed(4)}</span>
          </div>
          <button id="confirm-location" class="w-full bg-ocean-500 hover:bg-ocean-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            Analyze conditions
          </button>
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

      // Add event listener to confirm button
      const confirmButton = popupContent.querySelector('#confirm-location');
      if (confirmButton) {
        confirmButton.addEventListener('click', () => {
          // Add confirmed marker first
          const confirmedMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
          setSelectedMarker(confirmedMarker);

          // Then remove temporary marker
          map.removeLayer(tempMarker);

          // Close popup
          map.closePopup();

          // Navigate to results page with coordinates
          router.push(`/results?lat=${lat}&lng=${lng}`);
        });
      }

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
