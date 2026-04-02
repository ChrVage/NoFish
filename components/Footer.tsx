'use client';

import { useState, useRef, useEffect } from 'react';

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#f3f4f6',
          color: '#1f2937',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <line x1="4" y1="6" x2="20" y2="6" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="18" x2="20" y2="18" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Menu</span>
      </button>

      {open && (
        <div
          className="absolute mt-2 rounded-lg shadow-2xl py-3"
          style={{ right: '0px', minWidth: '180px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
        >
          <a
            href="https://github.com/ChrVage/NoFish/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#000000', fontWeight: 700, textDecoration: 'none', display: 'block', padding: '12px 24px', fontSize: '14px', whiteSpace: 'nowrap' }}
            className="hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(false)}
          >
            About NoFish
          </a>
          <a
            href="https://github.com/ChrVage/NoFish/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#000000', fontWeight: 700, textDecoration: 'none', display: 'block', padding: '12px 24px', fontSize: '14px', whiteSpace: 'nowrap' }}
            className="hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(false)}
          >
            Feedback
          </a>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const linkStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    textDecoration: 'none',
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} className="mt-4">
      <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <a
          href="https://github.com/ChrVage/NoFish/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...linkStyle, borderRight: '2px solid white' }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About NoFish</span>
        </a>
        <a
          href="https://github.com/ChrVage/NoFish/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Feedback</span>
        </a>
      </div>
    </div>
  );
}
