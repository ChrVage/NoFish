'use client';

import { useState, useEffect } from 'react';
import { getFeedbackItems, clearFeedbackItems } from './FeedbackButton';

export default function FeedbackBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(getFeedbackItems().length);
    sync();
    window.addEventListener('feedback-updated', sync);
    return () => window.removeEventListener('feedback-updated', sync);
  }, []);

  if (count === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 20px',
        borderRadius: '12px',
        backgroundColor: '#1e3a5f',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 50,
        fontSize: '14px',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
      </svg>
      <span>{count} item{count !== 1 ? 's' : ''} flagged</span>
      <a
        href="/feedback"
        style={{
          padding: '6px 16px',
          borderRadius: '8px',
          backgroundColor: '#2563eb',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '13px',
        }}
      >
        Submit Feedback →
      </a>
      <button
        type="button"
        onClick={() => clearFeedbackItems()}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
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
  );
}
