'use client';

import { useState, useEffect, useCallback } from 'react';

export interface FeedbackItem {
  id: string;
  page: string;
  time: string;
  lat: number;
  lng: number;
  locationName?: string;
  summary: string;
}

const STORAGE_KEY = 'nofish-feedback-items';

export function getFeedbackItems(): FeedbackItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function setFeedbackItems(items: FeedbackItem[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('feedback-updated'));
}

export function clearFeedbackItems() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('feedback-updated'));
}

export default function FeedbackButton({ item }: { item: FeedbackItem }) {
  const [selected, setSelected] = useState(() => getFeedbackItems().some(i => i.id === item.id));

  const sync = useCallback(() => {
    setSelected(getFeedbackItems().some(i => i.id === item.id));
  }, [item.id]);

  useEffect(() => {
    window.addEventListener('feedback-updated', sync);
    return () => window.removeEventListener('feedback-updated', sync);
  }, [sync]);

  return (
    <button
      type="button"
      onClick={() => {
        const items = getFeedbackItems();
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) {
          items.splice(idx, 1);
        } else {
          items.push(item);
        }
        setFeedbackItems(items);
      }}
      title={selected ? 'Remove from feedback' : 'Flag for feedback'}
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: selected ? '#d32f2f' : 'transparent',
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
      <svg width="14" height="14" fill={selected ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
      </svg>
    </button>
  );
}
