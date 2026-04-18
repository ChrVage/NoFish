'use client';

import { useEffect } from 'react';

const HIGHLIGHT_CLASS = 'window-highlight';

/** Clear any previous window highlights. */
function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

/**
 * Apply highlighting and scroll based on the current URL hash.
 *  - `#w-N`    → highlight every `<tr data-window="N">` and scroll to the first one.
 *  - `#t-DDHH` → scroll to the matching element (`:target` CSS handles the outline).
 */
function applyHash() {
  const hash = window.location.hash;
  if (!hash) { return; }

  clearHighlights();

  const windowMatch = hash.match(/^#w-(\d+)$/);
  if (windowMatch) {
    const rows = document.querySelectorAll<HTMLElement>(`tr[data-window="${windowMatch[1]}"]`);
    rows.forEach(r => r.classList.add(HIGHLIGHT_CLASS));
    rows[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Regular element-id scroll
  const el = document.getElementById(hash.slice(1));
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Scrolls to the element matching the URL hash fragment after hydration,
 * and highlights entire best-fishing windows when the hash is `#w-N`.
 */
export default function HashScroller() {
  useEffect(() => {
    // Initial page-load (small delay lets the DOM settle after hydration)
    const timer = setTimeout(applyHash, 100);

    // In-page hash changes (e.g. clicking best-window links)
    window.addEventListener('hashchange', applyHash);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', applyHash);
    };
  }, []);

  return null;
}
