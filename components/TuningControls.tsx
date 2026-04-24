'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildLocationUrl } from '@/lib/utils/params';
import {
  BOAT_SIZE_OPTIONS,
  FISH_TARGET_OPTIONS,
  FISHING_METHOD_OPTIONS,
  type TuningSelection,
  parseTuningFromSearchParams,
  resolveTuningSelection,
} from '@/lib/utils/tuning';

const STORAGE_KEY = 'nofish-tuning-v1';

interface TuningControlsProps {
  currentPage: '' | 'score' | 'details' | 'tide';
  lat: number;
  lng: number;
  zoom?: number;
  sea?: string;
  fields?: Array<'boat' | 'fish' | 'method'>;
  onChange?: (selection: TuningSelection) => void;
}

function readStoredTuning(): Partial<TuningSelection> {
  if (typeof window === 'undefined') {return {};}
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {return {};}
    return JSON.parse(raw) as Partial<TuningSelection>;
  } catch {
    return {};
  }
}

function writeStoredTuning(selection: TuningSelection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore quota/security errors.
  }
}

export default function TuningControls({ currentPage, lat, lng, zoom, sea, fields, onChange }: TuningControlsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSelection = useMemo(() => parseTuningFromSearchParams({
    boat: searchParams.get('boat') ?? undefined,
    fish: searchParams.get('fish') ?? undefined,
    method: searchParams.get('method') ?? undefined,
  }), [searchParams]);
  const [storedSelection] = useState<Partial<TuningSelection>>(() => readStoredTuning());
  const selection = resolveTuningSelection(urlSelection, storedSelection);

  useEffect(() => {
    onChange?.(selection);

    const hasAllUrlParams = Boolean(urlSelection.boat && urlSelection.fish && urlSelection.method);
    if (!hasAllUrlParams) {
      router.replace(buildLocationUrl(currentPage, {
        lat,
        lng,
        zoom,
        sea,
        boat: selection.boat,
        fish: selection.fish,
        method: selection.method,
      }), { scroll: false });
    }
  }, [currentPage, lat, lng, onChange, router, sea, selection, urlSelection.boat, urlSelection.fish, urlSelection.method, zoom]);

  const updateSelection = (patch: Partial<TuningSelection>) => {
    const next = resolveTuningSelection({ ...selection, ...patch }, {});
    onChange?.(next);
    writeStoredTuning(next);
    router.replace(buildLocationUrl(currentPage, {
      lat,
      lng,
      zoom,
      sea,
      boat: next.boat,
      fish: next.fish,
      method: next.method,
    }), { scroll: false });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: '#6b7280',
    display: 'block',
  };
  const selectStyle: React.CSSProperties = {
    marginTop: '4px',
    display: 'block',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    padding: '6px 10px',
    fontSize: '14px',
    color: '#1f2937',
    outline: 'none',
  };

  const visible = fields ?? ['boat', 'fish', 'method'];
  const showBoat = visible.includes('boat');
  const showFish = visible.includes('fish');
  const showMethod = visible.includes('method');

  return (
    <section aria-label="Fishing settings">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.625rem' }}>
        {showBoat && (
          <label style={labelStyle} htmlFor="boat-size-select">
            Boat size
            <select
              id="boat-size-select"
              style={selectStyle}
              value={selection.boat}
              onChange={(e) => updateSelection({ boat: e.target.value as TuningSelection['boat'] })}
            >
              {BOAT_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}

        {showFish && (
          <label style={labelStyle} htmlFor="fish-target-select">
            Target species
            <select
              id="fish-target-select"
              style={selectStyle}
              value={selection.fish}
              onChange={(e) => updateSelection({ fish: e.target.value as TuningSelection['fish'] })}
            >
              {FISH_TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}

        {showMethod && (
          <label style={labelStyle} htmlFor="method-select">
            Fishing method
            <select
              id="method-select"
              style={selectStyle}
              value={selection.method}
              onChange={(e) => updateSelection({ method: e.target.value as TuningSelection['method'] })}
            >
              {FISHING_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
