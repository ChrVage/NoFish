'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Popup content (rendered via createRoot into a Leaflet popup) ────────────

const popupButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  background: '#f3f4f6',
  color: '#1f2937',
  border: 'none',
  padding: '0.75rem 1rem',
  cursor: 'pointer',
  flex: 1,
  minHeight: '64px',
};

interface PopupContentProps {
  lat: number;
  lng: number;
  loading: boolean;
  name?: string;
  elevation?: number;
  isSea?: boolean;
  showScore: boolean;
  showTide: boolean;
  onNavigate: (page: string) => void;
}

function PopupContent({ lat, lng, loading, name, elevation, isSea, showScore, showTide, onNavigate }: PopupContentProps) {
  const buttons: { key: string; label: string; ariaLabel: string; icon: React.ReactNode }[] = [];

  if (showScore) {
    buttons.push({
      key: 'score', label: 'Score', ariaLabel: 'View score',
      icon: (
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    });
  }

  buttons.push({
    key: 'details', label: 'Details', ariaLabel: 'View forecast details',
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
      </svg>
    ),
  });

  if (showTide) {
    buttons.push({
      key: 'tide', label: 'Tides', ariaLabel: 'View tides',
      icon: (
        <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    });
  }

  return (
    <div style={{ minWidth: '220px', fontSize: '0.875rem' }}>
      <strong className="text-ocean-700" style={{ display: 'block', marginBottom: '0.25rem' }}>
        {loading ? 'Loading...' : (name ?? `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`)}
      </strong>
      {!loading && elevation !== undefined && (
        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
          {isSea ? `Depth: ${Math.abs(Math.round(elevation))} m` : `Elevation: ${Math.round(elevation)} m`}
        </div>
      )}
      <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
      </div>
      <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
        {buttons.map((btn, i) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => onNavigate(btn.key)}
            aria-label={btn.ariaLabel}
            style={{
              ...popupButtonStyle,
              borderRight: i < buttons.length - 1 ? '2px solid white' : 'none',
            }}
          >
            {btn.icon}
            <span style={{ fontSize: '0.75rem' }}>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const seaChartLayerRef = useRef<L.TileLayer | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showSeaChart, setShowSeaChart] = useState(false);
  const seaChartManualRef = useRef(false);

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

    // Kartverket sea chart overlay (depth contours / bottom topography)
    seaChartLayerRef.current = L.tileLayer(
      'https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png',
      {
        attribution: '© <a href="https://www.kartverket.no" target="_blank" rel="noopener">Kartverket</a>',
        maxZoom: 19,
        opacity: 0.7,
      }
    );

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
    let activePopupRoot: Root | null = null;
    let navigating = false;

    const clearOceanLayers = () => {
      if (activeOceanLine) { map.removeLayer(activeOceanLine); activeOceanLine = null; }
      if (activeOceanDot)  { map.removeLayer(activeOceanDot);  activeOceanDot  = null; }
    };

    const openMarkerAt = (lat: number, lng: number) => {
      // Guard: bail if navigating away or the map has already been removed
      if (navigating) return;
      if (!map.getContainer().isConnected) return;

      // Abort any in-flight fetch from a previous click so its result can never
      // add a stale dot/line after we've already moved on
      if (activeFetchController) activeFetchController.abort();
      activeFetchController = new AbortController();
      const { signal } = activeFetchController;

      // Remove any dot/line that already resolved before this click
      clearOceanLayers();

      const tempMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      // Clean up previous popup React root
      if (activePopupRoot) { activePopupRoot.unmount(); activePopupRoot = null; }

      const popupContainer = document.createElement('div');
      L.DomEvent.disableClickPropagation(popupContainer);
      const popupRoot = createRoot(popupContainer);
      activePopupRoot = popupRoot;

      let isLand = false;
      let hasOcean = true;

      const navigate = (page: string) => {
        navigating = true;
        const zoom = map.getZoom();
        const seaParam = isLand ? '&sea=0' : '&sea=1';
        router.push(`/${page}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}${seaParam}`);
      };

      // Initial render — show loading state with all buttons visible
      flushSync(() => {
        popupRoot.render(
          <PopupContent lat={lat} lng={lng} loading={true} showScore={true} showTide={true} onNavigate={navigate} />
        );
      });

      tempMarker.bindPopup(popupContainer, {
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

          let popupName: string | undefined;
          let elevation: number | undefined;
          let isSea: boolean | undefined;

          if (geoResponse.ok) {
            const result = await geoResponse.json();
            const d = result.data;
            const placeName = d?.name || d?.municipality || d?.displayName || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
            popupName = d?.municipality && d.name && d.name !== d.municipality
              ? `${d.name}, ${d.municipality}`
              : placeName;
            elevation = result.elevation as number | undefined;
            isSea = result.isSea as boolean | undefined;
            if (isSea === false) {
              isLand = true;
              hasOcean = false;
            }
          }

          if (!isLand && oceanResponse.ok) {
            const oceanResult = await oceanResponse.json();
            const oLat: number | undefined = oceanResult.oceanForecastLat;
            const oLng: number | undefined = oceanResult.oceanForecastLng;
            if (oLat !== undefined && oLng !== undefined && map.getContainer().isConnected) {
              // Dashed line from click to wave forecast grid point
              activeOceanLine = L.polyline([[lat, lng], [oLat, oLng]], {
                color: '#38bdf8',
                weight: 2,
                dashArray: '5, 6',
                opacity: 0.85,
              }).addTo(map);
              // Blue dot at wave forecast grid point
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
              hasOcean = false;
            }
          }

          // Re-render popup with fetched data
          flushSync(() => {
            popupRoot.render(
              <PopupContent
                lat={lat} lng={lng} loading={false}
                name={popupName} elevation={elevation} isSea={isSea}
                showScore={hasOcean} showTide={hasOcean}
                onNavigate={navigate}
              />
            );
          });
          tempMarker.getPopup()?.update();
        } catch (error) {
          // Ignore aborted fetches (user clicked a new spot before this resolved)
          if (error instanceof DOMException && error.name === 'AbortError') return;
          console.error('Map fetch error:', error);
          flushSync(() => {
            popupRoot.render(
              <PopupContent lat={lat} lng={lng} loading={false} showScore={true} showTide={true} onNavigate={navigate} />
            );
          });
          tempMarker.getPopup()?.update();
        }
      })();

      // Remove the pin when popup closes; leave dot/line on map until next click.
      // Defer unmount to avoid "unmount while rendering" when Leaflet auto-closes
      // the previous popup during a flushSync render of the new one.
      tempMarker.on('popupclose', () => {
        setTimeout(() => popupRoot.unmount(), 0);
        if (activePopupRoot === popupRoot) activePopupRoot = null;
        map.removeLayer(tempMarker);
      });

      return tempMarker;
    };

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

    // Auto-toggle sea chart based on zoom level
    const SEA_CHART_AUTO_ZOOM = 13;
    let prevZoom = initialZoom;
    const updateSeaChartForZoom = () => {
      const zoom = map.getZoom();
      const crossedThreshold = (prevZoom >= SEA_CHART_AUTO_ZOOM) !== (zoom >= SEA_CHART_AUTO_ZOOM);
      if (crossedThreshold) {
        seaChartManualRef.current = false;
      }
      if (!seaChartManualRef.current) {
        setShowSeaChart(zoom >= SEA_CHART_AUTO_ZOOM);
      }
      prevZoom = zoom;
    };
    map.on('zoomend', updateSeaChartForZoom);
    // Set initial state based on starting zoom
    if (initialZoom >= SEA_CHART_AUTO_ZOOM) {
      setShowSeaChart(true);
    }

    mapRef.current = map;

    return () => {
      if (activePopupRoot) {
        const root = activePopupRoot;
        // Defer unmount to avoid "unmount while rendering" React error
        setTimeout(() => root.unmount(), 0);
      }
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      if (singleClickTimer !== null) clearTimeout(singleClickTimer);
      if (activeFetchController) activeFetchController.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [router]);

  // Toggle Kartverket sea chart overlay
  useEffect(() => {
    const map = mapRef.current;
    const layer = seaChartLayerRef.current;
    if (!map || !layer) return;
    if (showSeaChart) {
      layer.addTo(map);
    } else {
      map.removeLayer(layer);
    }
  }, [showSeaChart]);

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

      {/* Sea chart toggle — top right */}
      <div style={{ position: 'absolute', top: '16px', right: '12px', zIndex: 1100 }}>
        <button
          type="button"
          onClick={() => { seaChartManualRef.current = true; setShowSeaChart(v => !v); }}
          aria-label={showSeaChart ? 'Hide sea chart' : 'Show sea chart (Kartverket)'}
          title={showSeaChart ? 'Hide sea chart' : 'Sea chart – depth & bottom topography (Kartverket)'}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: showSeaChart ? '#0284c7' : '#fff',
            color: showSeaChart ? '#fff' : '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 17c2-2 4-3 6-1s4 3 6 1 4-2 6 0M3 12c2-2 4-3 6-1s4 3 6 1 4-2 6 0M3 7c2-2 4-3 6-1s4 3 6 1 4-2 6 0" />
          </svg>
          Sea chart
        </button>
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
