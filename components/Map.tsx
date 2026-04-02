'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const openMarkerAtRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Restore position/zoom when returning from a detail page
    const restoreLat = parseFloat(searchParams.get('lat') ?? '');
    const restoreLng = parseFloat(searchParams.get('lng') ?? '');
    const restoreZoom = parseInt(searchParams.get('zoom') ?? '', 10);
    const hasRestore = !isNaN(restoreLat) && !isNaN(restoreLng);

    const initialCenter: [number, number] = hasRestore
      ? [restoreLat, restoreLng]
      : [65.0, 14.0];
    const initialZoom = hasRestore && !isNaN(restoreZoom) ? restoreZoom : 5;

    // Initialize map centered on Norwegian coast
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      doubleClickZoom: false,
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

    let activeOceanDot: L.CircleMarker | null = null;
    let activeOceanLine: L.Polyline | null = null;
    let activeFetchController: AbortController | null = null;

    const clearOceanLayers = () => {
      if (activeOceanLine) { map.removeLayer(activeOceanLine); activeOceanLine = null; }
      if (activeOceanDot)  { map.removeLayer(activeOceanDot);  activeOceanDot  = null; }
    };

    const openMarkerAt = (lat: number, lng: number) => {
      // Guard: bail if the map has already been removed
      if (!map.getContainer().isConnected) return;

      // Abort any in-flight fetch from a previous click so its result can never
      // add a stale dot/line after we've already moved on
      if (activeFetchController) activeFetchController.abort();
      activeFetchController = new AbortController();
      const { signal } = activeFetchController;

      // Remove any dot/line that already resolved before this click
      clearOceanLayers();

      const tempMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      // Create popup with three navigation links
      const popupContent = document.createElement('div');
      popupContent.className = 'text-sm';
      popupContent.innerHTML = `
        <div class="min-w-[220px]">
          <strong class="text-ocean-700 block mb-1" id="location-name">Loading...</strong>
          <div class="text-gray-500 text-xs mb-3">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
          <div style="display:flex;border-radius:0.5rem;overflow:hidden">
            <button type="button" id="go-score" aria-label="View score" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.25rem;background:#f3f4f6;color:#1f2937;border:none;border-right:2px solid white;padding:0.75rem 1rem;cursor:pointer;flex:1;min-height:64px">
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <span style="font-size:0.75rem">Score</span>
            </button>
            <button type="button" id="go-details" aria-label="View forecast details" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.25rem;background:#f3f4f6;color:#1f2937;border:none;border-right:2px solid white;padding:0.75rem 1rem;cursor:pointer;flex:1;min-height:64px">
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
              </svg>
              <span style="font-size:0.75rem">Details</span>
            </button>
            <button type="button" id="go-tide" aria-label="View tides" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.25rem;background:#f3f4f6;color:#1f2937;border:none;padding:0.75rem 1rem;cursor:pointer;flex:1;min-height:64px">
              <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
              <span style="font-size:0.75rem">Tides</span>
            </button>
          </div>
        </div>
      `;

      // Bind popup and open it
      tempMarker.bindPopup(popupContent, {
        closeButton: true,
        autoClose: true,
        closeOnClick: false,
      }).openPopup();

      // Fetch location name and ocean forecast grid point in parallel
      (async () => {
        try {
          const [geoResponse, oceanResponse] = await Promise.all([
            fetch(`/api/geocoding?lat=${lat}&lon=${lng}`, { signal }),
            fetch(`/api/ocean-point?lat=${lat}&lon=${lng}`, { signal }),
          ]);

          if (geoResponse.ok) {
            const result = await geoResponse.json();
            const d = result.data;
            const placeName = d?.name || d?.municipality || d?.displayName || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
            const label = d?.municipality && d.name && d.name !== d.municipality
              ? `${d.name}, ${d.municipality}`
              : placeName;
            const nameElement = popupContent.querySelector('#location-name');
            if (nameElement) nameElement.textContent = label;
          } else {
            const nameElement = popupContent.querySelector('#location-name');
            if (nameElement) nameElement.textContent = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
          }

          if (oceanResponse.ok) {
            const oceanResult = await oceanResponse.json();
            const oLat: number | undefined = oceanResult.oceanForecastLat;
            const oLng: number | undefined = oceanResult.oceanForecastLng;
            if (oLat !== undefined && oLng !== undefined && map.getContainer().isConnected) {
              activeOceanLine = L.polyline([[lat, lng], [oLat, oLng]], {
                color: '#38bdf8',
                weight: 2,
                dashArray: '5, 6',
                opacity: 0.85,
              }).addTo(map);
              activeOceanDot = L.circleMarker([oLat, oLng], {
                radius: 6,
                color: '#0284c7',
                fillColor: '#38bdf8',
                fillOpacity: 0.9,
                weight: 2,
              }).addTo(map);
              activeOceanDot.bindTooltip(
                `Wave forecast point — Barentswatch (${oLat.toFixed(4)}°N, ${oLng.toFixed(4)}°E)`,
                { direction: 'top', offset: [0, -4] }
              );
            } else {
              // No ocean data nearby — hide Score and Tide buttons
              const scoreBtn = popupContent.querySelector('#go-score') as HTMLElement | null;
              const tideBtn = popupContent.querySelector('#go-tide') as HTMLElement | null;
              scoreBtn?.remove();
              tideBtn?.remove();
              tempMarker.getPopup()?.update();
            }
          }
        } catch (error) {
          // Ignore aborted fetches (user clicked a new spot before this resolved)
          if (error instanceof DOMException && error.name === 'AbortError') return;
          console.error('Map fetch error:', error);
          const nameElement = popupContent.querySelector('#location-name');
          if (nameElement) nameElement.textContent = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
        }
      })();

      const navigate = (path: string) => {
        map.removeLayer(tempMarker);
        clearOceanLayers();
        map.closePopup();
        router.push(path);
      };

      const zoom = map.getZoom();
      popupContent.querySelector('#go-score')?.addEventListener('click', () =>
        navigate(`/score?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`)
      );
      popupContent.querySelector('#go-details')?.addEventListener('click', () =>
        navigate(`/details?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`)
      );
      popupContent.querySelector('#go-tide')?.addEventListener('click', () =>
        navigate(`/tide?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`)
      );

      // Remove the pin when popup closes; leave dot/line on map until next click
      // (clearOceanLayers runs at the top of openMarkerAt — removing it here
      // prevents a race where popupclose fires after the next fetch has already
      // placed a fresh dot, wiping it out immediately)
      tempMarker.on('popupclose', () => {
        map.removeLayer(tempMarker);
      });

      return tempMarker;
    };

    // Expose openMarkerAt so the location button (rendered in JSX) can call it
    openMarkerAtRef.current = openMarkerAt;

    // If returning from a detail page, restore the marker + popup
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    if (hasRestore) {
      // Small delay so the map tiles have a chance to start loading
      restoreTimer = setTimeout(() => {
        openMarkerAt(restoreLat, restoreLng);
      }, 150);
    }

    // Handle map clicks (debounced to avoid firing on double-click zoom)
    let singleClickTimer: ReturnType<typeof setTimeout> | null = null;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (singleClickTimer !== null) clearTimeout(singleClickTimer);
      singleClickTimer = setTimeout(() => {
        singleClickTimer = null;
        openMarkerAt(e.latlng.lat, e.latlng.lng);
      }, 250);
    });

    // Cancel pending single-click and zoom in by 2 levels on double-click
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (singleClickTimer !== null) {
        clearTimeout(singleClickTimer);
        singleClickTimer = null;
      }
      map.setView(e.latlng, map.getZoom() + 4, { animate: true });
    });

    mapRef.current = map;

    return () => {
      openMarkerAtRef.current = null;
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      if (singleClickTimer !== null) clearTimeout(singleClickTimer);
      if (activeFetchController) activeFetchController.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [router]);

  const handleMyLocation = () => {
    const MIN_LOCATION_ZOOM = 10;
    const GEOLOCATION_TIMEOUT_MS = 10000;

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        const zoom = Math.max(mapRef.current?.getZoom() ?? MIN_LOCATION_ZOOM, MIN_LOCATION_ZOOM);
        router.push(`/details?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}&zoom=${zoom}`);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied.');
        } else {
          setLocationError('Unable to retrieve your location.');
        }
      },
      { timeout: GEOLOCATION_TIMEOUT_MS }
    );
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="map-container w-full h-full" />
      
      {/* Map instructions overlay */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-[1000]">
        <h3 className="text-ocean-700 font-semibold mb-2">🎣 Select your fishing spot</h3>
        <p className="text-sm text-gray-700">
          Click to analyze a location, or double-click to zoom in.
        </p>
      </div>

      {/* My Location button — bottom right, above Leaflet attribution */}
      <div style={{ position: 'absolute', bottom: '28px', right: '12px', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        {locationError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', borderRadius: '8px', padding: '8px 12px', maxWidth: '200px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {locationError}
          </div>
        )}
        <button
          type="button"
          onClick={handleMyLocation}
          disabled={locating}
          aria-label="Use my current location"
          title="My Location"
          style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', cursor: locating ? 'wait' : 'pointer', opacity: locating ? 0.6 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
        >
          {locating ? (
            <svg style={{ width: '20px', height: '20px', color: '#0ea5e9' }} fill="none" viewBox="0 0 24 24">
              <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="8" strokeWidth="1.5"/>
              <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
