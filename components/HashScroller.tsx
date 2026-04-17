'use client';

import { useEffect } from 'react';

/** Scrolls to the element matching the URL hash fragment after hydration. */
export default function HashScroller() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    // Small delay to let the DOM settle after hydration
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
