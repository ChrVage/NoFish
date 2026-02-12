'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function Map({ onLocationSelect }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMarker, setSelectedMarker] = useState<L.Marker | null>(null);

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
      }

      // Add new marker
      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      setSelectedMarker(marker);

      // Notify parent component
      if (onLocationSelect) {
        onLocationSelect(lat, lng);
      }

      // Show popup with coordinates
      marker.bindPopup(`
        <div class="text-sm">
          <strong class="text-ocean-700">Fishing spot selected</strong><br/>
          <span class="text-gray-600">Lat: ${lat.toFixed(4)}</span><br/>
          <span class="text-gray-600">Lng: ${lng.toFixed(4)}</span>
        </div>
      `).openPopup();
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update marker when selectedMarker changes
  useEffect(() => {
    if (!mapRef.current || !selectedMarker || !onLocationSelect) return;
  }, [selectedMarker, onLocationSelect]);

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
