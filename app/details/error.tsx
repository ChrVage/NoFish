'use client';

import ErrorFallback from '@/components/ErrorFallback';

export default function DetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} pageName="forecast details" />;
}
