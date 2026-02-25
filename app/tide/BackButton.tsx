'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const { push } = useRouter();
  return (
    <button onClick={() => push('/')} className="text-ocean-50 hover:text-white transition-colors">
      ← Back
    </button>
  );
}
