'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** A single selected hour entry stored in sessionStorage */
export interface BookingEntry {
  time: string;
  score: number;
  safetyScore: number;
  fishingScore: number;
  windSpeed?: number;
  windGust?: number;
  waveHeight?: number;
  wavePeriod?: number;
  currentSpeed?: number;
  temperature?: number;
  seaTemperature?: number;
  pressure?: number;
  tidePhase?: string;
  moonPhase?: string;
  locationName: string;
  lat: number;
  lng: number;
}

const STORAGE_KEY = 'nofish-booking-entries';

export function getBookingEntries(): BookingEntry[] {
  if (typeof window === 'undefined') {return [];}
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function setBookingEntries(entries: BookingEntry[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event('booking-updated'));
}

export function clearBookingEntries() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('booking-updated'));
}

/** Group sorted entries into contiguous slots (adjacent hours = 1 h apart) */
export function groupEntries(entries: BookingEntry[]): BookingEntry[][] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const groups: BookingEntry[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].time).getTime();
    const curr = new Date(sorted[i].time).getTime();
    if (curr - prev <= 3600000) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups;
}

export default function BookingButton({ entry }: { entry: BookingEntry }) {
  const [selected, setSelected] = useState(() => getBookingEntries().some(e => e.time === entry.time));
  const btnRef = useRef<HTMLButtonElement>(null);

  const sync = useCallback(() => {
    setSelected(getBookingEntries().some(e => e.time === entry.time));
  }, [entry.time]);

  useEffect(() => {
    window.addEventListener('booking-updated', sync);
    return () => window.removeEventListener('booking-updated', sync);
  }, [sync]);

  // Apply highlight to parent <tr> when selected
  useEffect(() => {
    const tr = btnRef.current?.closest('tr');
    if (!tr) return;
    if (selected) {
      tr.style.backgroundColor = '#ecfdf5';
      tr.style.boxShadow = 'inset 0 0 0 2px #059669';
    } else {
      tr.style.backgroundColor = '';
      tr.style.boxShadow = '';
    }
  }, [selected]);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => {
        const entries = getBookingEntries();
        const idx = entries.findIndex(e => e.time === entry.time);
        if (idx >= 0) {
          entries.splice(idx, 1);
        } else {
          entries.push(entry);
        }
        setBookingEntries(entries);
      }}
      title={selected ? 'Remove from calendar' : 'Add to calendar'}
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: selected ? '#059669' : 'transparent',
        color: selected ? '#fff' : '#9ca3af',
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" strokeLinecap="round" />
        <path d="M8 2v4M16 2v4" strokeLinecap="round" />
        {selected && (
          <path d="M9 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}
