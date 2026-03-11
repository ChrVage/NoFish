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
        className="text-2xl leading-none text-white hover:text-ocean-50 transition-colors select-none px-1"
      >
        &#9776;
      </button>

      {open && (
        <div
          className="absolute mt-2 rounded-lg shadow-2xl py-3"
          style={{ right: '-8px', minWidth: '180px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
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
