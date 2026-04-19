'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getBookingEntries, clearBookingEntries, groupEntries, type BookingEntry } from './BookingButton';
import { getTimezone, timeAnchor } from '@/lib/utils/timezone';

/** UTC Date → "20260615T100000Z" */
function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function gcalDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
}

function buildDetailsUrl(group: BookingEntry[]): string {
  const loc = group[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nofish.app';
  const tz = getTimezone(loc.lat, loc.lng);
  const anchor = timeAnchor(group[0].time, tz);
  return `${origin}/details?lat=${loc.lat.toFixed(4)}&lng=${loc.lng.toFixed(4)}&zoom=12#${anchor}`;
}

function buildDescription(group: BookingEntry[]): string {
  const avgScore = Math.round(group.reduce((s, e) => s + e.score, 0) / group.length);
  const safetyAvg = Math.round(group.reduce((s, e) => s + e.safetyScore, 0) / group.length);
  const fishingAvg = Math.round(group.reduce((s, e) => s + e.fishingScore, 0) / group.length);
  const loc = group[0];

  const lines: string[] = [
    `NoFish Score: ${avgScore}%`,
    `  Safety: ${safetyAvg}%  |  Fishing: ${fishingAvg}%`,
    '',
    `Details: ${buildDetailsUrl(group)}`,
    '',
    `Map: https://www.google.com/maps?q=${loc.lat},${loc.lng}`,
  ];
  return lines.join('\n');
}

function slotTimes(group: BookingEntry[]): { start: Date; end: Date } {
  const start = new Date(group[0].time);
  const end = new Date(new Date(group[group.length - 1].time).getTime() + 3600000);
  return { start, end };
}

function buildIcsForGroups(groups: BookingEntry[][]): string {
  const events = groups.map(group => {
    const { start, end } = slotTimes(group);
    const avg = Math.round(group.reduce((s, e) => s + e.score, 0) / group.length);
    const loc = group[0];
    const desc = buildDescription(group).replace(/\n/g, '\\n');
    const detailsUrl = buildDetailsUrl(group);
    return [
      'BEGIN:VEVENT',
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:🎣 Fishing ${avg}% – ${loc.locationName}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${loc.locationName}`,
      `GEO:${loc.lat};${loc.lng}`,
      `URL:${detailsUrl}`,
      `UID:nofish-${start.getTime()}@nofish`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NoFish//Score//EN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildGoogleUrl(group: BookingEntry[]): string {
  const { start, end } = slotTimes(group);
  const avg = Math.round(group.reduce((s, e) => s + e.score, 0) / group.length);
  const loc = group[0];
  const desc = buildDescription(group);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🎣 Fishing ${avg}% – ${loc.locationName}`,
    dates: `${gcalDate(start)}/${gcalDate(end)}`,
    details: desc,
    location: `${loc.lat},${loc.lng}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(group: BookingEntry[]): string {
  const { start, end } = slotTimes(group);
  const avg = Math.round(group.reduce((s, e) => s + e.score, 0) / group.length);
  const loc = group[0];
  const desc = buildDescription(group);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `🎣 Fishing ${avg}% – ${loc.locationName}`,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: desc,
    location: loc.locationName,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export default function BookingBanner() {
  const [entries, setEntries] = useState<BookingEntry[]>(() => getBookingEntries());
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    setEntries(getBookingEntries());
  }, []);

  useEffect(() => {
    window.addEventListener('booking-updated', sync);
    return () => window.removeEventListener('booking-updated', sync);
  }, [sync]);

  // Close panel on outside click
  useEffect(() => {
    if (!expanded) {return;}
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  if (entries.length === 0) {return null;}

  const groups = groupEntries(entries);
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsForGroups(groups))}`;
  const timeFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: '12px',
        backgroundColor: '#064e3b',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 50,
        fontSize: '14px',
        overflow: 'hidden',
        maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      {/* Expanded panel — per-group calendar links */}
      {expanded && (
        <div style={{ padding: '16px 28px 10px 48px', width: '100%', borderBottom: '1px solid #065f46' }}>
          {groups.map((group, idx) => {
            const { start, end } = slotTimes(group);
            const avg = Math.round(group.reduce((s, e) => s + e.score, 0) / group.length);
            return (
              <div key={group[0].time} style={{ marginBottom: idx < groups.length - 1 ? '10px' : '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  {avg}% — {timeFmt.format(start)}–{timeFmt.format(end)} ({group.length}h)
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <a
                    href={buildGoogleUrl(group)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#065f46', color: '#d1fae5', textDecoration: 'none', fontSize: '12px', border: '1px solid #047857' }}
                  >
                    Google
                  </a>
                  <a
                    href={buildOutlookUrl(group)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#065f46', color: '#d1fae5', textDecoration: 'none', fontSize: '12px', border: '1px solid #047857' }}
                  >
                    Outlook
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 28px', whiteSpace: 'nowrap' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" strokeLinecap="round" />
          <path d="M8 2v4M16 2v4" strokeLinecap="round" />
        </svg>
        <span>{entries.length} hour{entries.length !== 1 ? 's' : ''} · {groups.length} slot{groups.length !== 1 ? 's' : ''}</span>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          style={{
            padding: '6px 16px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Close' : 'Add to Calendar ↑'}
        </button>
        <a
          href={icsHref}
          download="fishing-slots.ics"
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: '#065f46',
            color: '#d1fae5',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '13px',
            border: '1px solid #047857',
          }}
          title="Download .ics file for all slots"
        >
          .ics
        </a>
        <button
          type="button"
          onClick={() => { clearBookingEntries(); setExpanded(false); }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6ee7b7',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
          }}
          title="Clear selection"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
