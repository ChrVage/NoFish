'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  label?: string;
  className?: string;
}

export default function BackButton({
  label = '← Back',
  className = 'text-ocean-50 hover:text-white transition-colors',
}: BackButtonProps) {
  const { push } = useRouter();
  return (
    <button onClick={() => push('/')} className={className}>
      {label}
    </button>
  );
}
