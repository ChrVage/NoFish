'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const buttonStyle: React.CSSProperties = {
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
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 700,
};

export default function BackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = () => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const zoom = searchParams.get('zoom');
    if (lat && lng) {
      const params = new URLSearchParams({ lat, lng });
      if (zoom) params.set('zoom', zoom);
      router.push(`/?${params.toString()}`);
    } else {
      router.push('/');
    }
  };

  return (
    <button onClick={handleBack} style={buttonStyle}>
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
      <span>Back</span>
    </button>
  );
}
