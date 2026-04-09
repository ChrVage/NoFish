'use client';

import ErrorFallback from '@/components/ErrorFallback';

export default function ScoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} pageName="fishing score" />;
}
