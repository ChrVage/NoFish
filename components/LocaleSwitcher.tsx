'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { routing } from '@/i18n/routing';

const LOCALE_META: Record<string, { flag: string; label: string }> = {
  no: { flag: '🇳🇴', label: 'Norsk' },
  en: { flag: '🇬🇧', label: 'English' },
};

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function switchLocale(next: string) {
    setOpen(false);
    const qs = searchParams.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    router.replace(target, { locale: next });
  }

  const current = LOCALE_META[locale];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current?.label}
        style={{
          background: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '3px 7px',
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: '#374151',
        }}
      >
        <span>{current?.flag}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{ opacity: 0.4, flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: '4px',
            margin: 0,
            listStyle: 'none',
            zIndex: 100,
            minWidth: '140px',
          }}
        >
          {routing.locales.map((l) => {
            const meta = LOCALE_META[l];
            const isActive = l === locale;
            return (
              <li key={l} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => switchLocale(l)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '6px 10px',
                    background: isActive ? '#f0faf9' : 'none',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#00695c' : '#374151',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{meta?.flag}</span>
                  <span>{meta?.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
