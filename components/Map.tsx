'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildLocationUrl } from '@/lib/utils/params';
import {
  parseTuningFromSearchParams,
  resolveTuningSelection,
  sanitizeTuningSelection,
} from '@/lib/utils/tuning';

const TUNING_STORAGE_KEY = 'nofish-tuning-v1';

function getStoredTuning() {
  if (typeof window === 'undefined') {return {};}
  try {
    const raw = localStorage.getItem(TUNING_STORAGE_KEY);
    if (!raw) {return {};}
    return sanitizeTuningSelection(JSON.parse(raw));
  } catch {
    return {};
  }
}

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
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const handleClick = (key: string) => {
    if (navigatingTo) {return;}
    setNavigatingTo(key);
    onNavigate(key);
  };

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
        {buttons.map((btn, i) => {
          const isThis = navigatingTo === btn.key;
          const disabled = navigatingTo !== null;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={() => handleClick(btn.key)}
              disabled={disabled}
              aria-label={btn.ariaLabel}
              style={{
                ...popupButtonStyle,
                borderRight: i < buttons.length - 1 ? '2px solid white' : 'none',
                opacity: disabled && !isThis ? 0.45 : 1,
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {isThis ? (
                <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: 22, height: 22,
                    border: '3px solid rgba(56,189,248,0.25)',
                    borderTopColor: '#0ea5e9',
                    borderRadius: '50%',
                    animation: 'popup-spin 0.7s linear infinite',
                  }} />
                </div>
              ) : btn.icon}
              <span style={{ fontSize: '0.75rem' }}>{btn.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SearchResult {
  name: string;
  type: string;
  municipality: string;
  lat: number;
  lng: number;
}

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const seaChartLayerRef = useRef<L.TileLayer | null>(null);
  const openMarkerFnRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showSeaChart, setShowSeaChart] = useState(() => {
    const z = parseInt(searchParams.get('zoom') ?? '', 10);
    return !isNaN(z) && z >= 13;
  });
  const [centerIsLand, setCenterIsLand] = useState<boolean | null>(null);
  const seaChartManualRef = useRef(false);
  const centerIsLandRef = useRef<boolean | null>(null);
  const landCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landCheckAbortRef = useRef<AbortController | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Extract search params before the effect so they appear in the dependency array
  const restoreLat = parseFloat(searchParams.get('lat') ?? '');
  const restoreLng = parseFloat(searchParams.get('lng') ?? '');
  const restoreZoom = parseInt(searchParams.get('zoom') ?? '', 10);
  const tuningFromUrl = useMemo(() => parseTuningFromSearchParams({
    boat: searchParams.get('boat') ?? undefined,
    fish: searchParams.get('fish') ?? undefined,
    method: searchParams.get('method') ?? undefined,
  }), [searchParams]);
  const hasRestore = !isNaN(restoreLat) && !isNaN(restoreLng);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {return;}

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

    const setLandState = (isLand: boolean | null) => {
      centerIsLandRef.current = isLand;
      setCenterIsLand(isLand);
      if (isLand === true) {
        seaChartManualRef.current = false;
        setShowSeaChart(false);
      }
    };

    const checkLandAt = async (lat: number, lng: number) => {
      if (landCheckAbortRef.current) {landCheckAbortRef.current.abort();}
      const controller = new AbortController();
      landCheckAbortRef.current = controller;
      try {
        const res = await fetch(`/api/geocoding?lat=${lat}&lon=${lng}`, { signal: controller.signal });
        if (!res.ok) {return;}
        const result = await res.json();
        const isLand = result.isSea === false;
        setLandState(isLand);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {return;}
      }
    };

    const clearOceanLayers = () => {
      if (activeOceanLine) { map.removeLayer(activeOceanLine); activeOceanLine = null; }
      if (activeOceanDot)  { map.removeLayer(activeOceanDot);  activeOceanDot  = null; }
    };

    const openMarkerAt = (lat: number, lng: number) => {
      // Guard: bail if navigating away or the map has already been removed
      if (navigating) {return;}
      if (!map.getContainer().isConnected) {return;}

      // Abort any in-flight fetch from a previous click so its result can never
      // add a stale dot/line after we've already moved on
      if (activeFetchController) {activeFetchController.abort();}
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
        const sea = isLand ? '0' : '1';
        const tuning = resolveTuningSelection(tuningFromUrl, getStoredTuning());
        // Update current history entry so browser-back restores map position
        window.history.replaceState(window.history.state, '', buildLocationUrl('', { lat, lng, zoom, boat: tuning.boat, fish: tuning.fish, method: tuning.method }));
        router.push(buildLocationUrl(page as 'score' | 'details' | 'tide', {
          lat,
          lng,
          zoom,
          sea,
          boat: tuning.boat,
          fish: tuning.fish,
          method: tuning.method,
        }));
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
      void (async () => {
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
            const placeName = d?.name ?? d?.municipality ?? d?.displayName ?? `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
            popupName = d?.municipality && d.municipality !== 'Unknown municipality' && d.name && d.name !== d.municipality
              ? `${d.name}, ${d.municipality}`
              : placeName;
            elevation = result.elevation as number | undefined;
            isSea = result.isSea as boolean | undefined;
            if (isSea === false) {
              isLand = true;
              hasOcean = false;
            }
            setLandState(isSea === false);
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
          if (error instanceof DOMException && error.name === 'AbortError') {return;}
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
        if (activePopupRoot === popupRoot) {activePopupRoot = null;}
        map.removeLayer(tempMarker);
      });

      return tempMarker;
    };

    openMarkerFnRef.current = openMarkerAt;

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
      if (singleClickTimer !== null) {clearTimeout(singleClickTimer);}
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
        setShowSeaChart(centerIsLandRef.current === true ? false : zoom >= SEA_CHART_AUTO_ZOOM);
      }
      prevZoom = zoom;
    };
    map.on('zoomend', updateSeaChartForZoom);

    const scheduleCenterLandCheck = () => {
      if (landCheckTimerRef.current !== null) {clearTimeout(landCheckTimerRef.current);}
      landCheckTimerRef.current = setTimeout(() => {
        const c = map.getCenter();
        void checkLandAt(c.lat, c.lng);
      }, 250);
    };
    map.on('moveend', scheduleCenterLandCheck);
    scheduleCenterLandCheck();

    mapRef.current = map;

    return () => {
      if (activePopupRoot) {
        const root = activePopupRoot;
        // Defer unmount to avoid "unmount while rendering" React error
        setTimeout(() => root.unmount(), 0);
      }
      if (restoreTimer !== null) {clearTimeout(restoreTimer);}
      if (singleClickTimer !== null) {clearTimeout(singleClickTimer);}
      if (activeFetchController) {activeFetchController.abort();}
      if (landCheckTimerRef.current !== null) {clearTimeout(landCheckTimerRef.current);}
      if (landCheckAbortRef.current) {landCheckAbortRef.current.abort();}
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [router, restoreLat, restoreLng, restoreZoom, hasRestore, tuningFromUrl]);

  // Toggle Kartverket sea chart overlay
  useEffect(() => {
    const map = mapRef.current;
    const layer = seaChartLayerRef.current;
    if (!map || !layer) {return;}
    if (showSeaChart) {
      layer.addTo(map);
    } else {
      map.removeLayer(layer);
    }
  }, [showSeaChart]);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setSearchHighlight(-1);
    if (searchTimerRef.current) {clearTimeout(searchTimerRef.current);}
    if (searchAbortRef.current) {searchAbortRef.current.abort();}
    if (value.length < 2) { setSearchResults([]); setSearchOpen(false); return; }

    // Check for coordinate input first
    const coordMatch = value.match(COORD_RE);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setSearchResults([{ name: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`, type: 'Coordinate', municipality: '', lat, lng }]);
        setSearchOpen(true);
        return;
      }
    }

    searchTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const items: SearchResult[] = data.results ?? [];
          setSearchResults(items);
          setSearchOpen(items.length > 0);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {return;}
      }
    }, 300);
  };

  const selectSearchResult = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    mapRef.current?.flyTo([result.lat, result.lng], 13, { duration: 1.2 });
    // Open marker after fly completes
    setTimeout(() => { openMarkerFnRef.current?.(result.lat, result.lng); }, 600);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || searchResults.length === 0) {
      if (e.key === 'Enter') {
        const coordMatch = searchQuery.match(COORD_RE);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            selectSearchResult({ name: '', type: 'Coordinate', municipality: '', lat, lng });
          }
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchHighlight(i => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchHighlight(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = searchHighlight >= 0 ? searchHighlight : 0;
      selectSearchResult(searchResults[idx]);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

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
      async (position) => {
        const { latitude, longitude } = position.coords;
        const lat4 = latitude.toFixed(4);
        const lng4 = longitude.toFixed(4);
        const zoom = Math.max(mapRef.current?.getZoom() ?? MIN_LOCATION_ZOOM, MIN_LOCATION_ZOOM);
        const tuning = resolveTuningSelection(tuningFromUrl, getStoredTuning());
        let sea: string | undefined;
        try {
          const res = await fetch(`/api/geocoding?lat=${lat4}&lon=${lng4}`);
          if (res.ok) {
            const result = await res.json();
            sea = result.isSea === false ? '0' : '1';
          }
        } catch { /* navigate without sea hint */ }
        setLocating(false);
        // Update current history entry so browser-back restores map position
        window.history.replaceState(window.history.state, '', buildLocationUrl('', {
          lat: lat4,
          lng: lng4,
          zoom,
          boat: tuning.boat,
          fish: tuning.fish,
          method: tuning.method,
        }));
        router.push(buildLocationUrl('details', {
          lat: lat4,
          lng: lng4,
          zoom,
          sea,
          boat: tuning.boat,
          fish: tuning.fish,
          method: tuning.method,
        }));
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
      
      {/* Top bar — search + sea chart toggle in one row */}
      <div style={{ position: 'absolute', top: '12px', left: '52px', right: '12px', zIndex: 1100, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          ref={searchBoxRef}
          style={{ position: 'relative', flex: '1 1 0', minWidth: 0, maxWidth: '300px' }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af', pointerEvents: 'none' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (searchResults.length > 0) {setSearchOpen(true);} }}
              placeholder="Search place or coordinates…"
              aria-label="Search for a place or enter coordinates"
              aria-expanded={searchOpen}
              aria-controls="search-suggestions"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              role="combobox"
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '14px',
                color: '#1f2937',
                background: '#fff',
                border: 'none',
                borderRadius: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                outline: 'none',
              }}
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <ul
              role="listbox"
              id="search-suggestions"
              style={{
                position: 'absolute', left: 0, right: 0, marginTop: '4px',
                background: '#fff', borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                overflow: 'hidden', listStyle: 'none', padding: 0,
                zIndex: 1200,
              }}
            >
              {searchResults.map((r, i) => (
                <li
                  key={`${r.lat}-${r.lng}-${r.name}`}
                  role="option"
                  aria-selected={i === searchHighlight}
                  onMouseDown={() => selectSearchResult(r)}
                  onMouseEnter={() => setSearchHighlight(i)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    background: i === searchHighlight ? '#f0f9ff' : '#fff',
                    borderBottom: i < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex', alignItems: 'baseline', gap: '6px',
                  }}
                >
                  <svg style={{ width: '14px', height: '14px', color: '#6b7280', flexShrink: 0, alignSelf: 'center' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, color: '#1f2937' }}>{r.name}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {[r.type, r.municipality].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sea chart toggle */}
        <button
          type="button"
          onClick={() => {
            if (centerIsLand === true) {return;}
            seaChartManualRef.current = true;
            setShowSeaChart(v => !v);
          }}
          disabled={centerIsLand === true}
          aria-label={showSeaChart ? 'Hide sea chart' : 'Show sea chart (Kartverket)'}
          title={centerIsLand === true ? 'Sea chart unavailable on land' : (showSeaChart ? 'Hide sea chart' : 'Sea chart – depth & bottom topography (Kartverket)')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: showSeaChart ? '#0284c7' : '#fff',
            color: showSeaChart ? '#fff' : '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: centerIsLand === true ? 'not-allowed' : 'pointer',
            opacity: centerIsLand === true ? 0.55 : 1,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            flexShrink: 0,
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
