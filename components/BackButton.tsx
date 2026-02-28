'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface BackButtonProps {
  label?: string;
  className?: string;
  extraParams?: Record<string, string | number | undefined>;
}

export default function BackButton({
  label = '← Back',
  className = 'text-ocean-50 hover:text-white transition-colors',
  extraParams,
}: BackButtonProps) {
  const { push } = useRouter();
  const searchParams = useSearchParams();

  const handleBack = () => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const zoom = searchParams.get('zoom');
    if (lat && lng) {
      const params = new URLSearchParams({ lat, lng });
      if (zoom) params.set('zoom', zoom);
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          if (value !== undefined) params.set(key, String(value));
        }
      }
      push(`/?${params.toString()}`);
    } else {
      push('/');
    }
  };

  return (
    <button onClick={handleBack} className={className}>
      {label}
    </button>
  );
}
