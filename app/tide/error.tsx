'use client';

import ErrorFallback from '@/components/ErrorFallback';

export default function TideError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} pageName="tide forecast" />;
}
