'use client';

import { useTranslations } from 'next-intl';
import ErrorFallback from '@/components/ErrorFallback';

export default function ScoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');
  return <ErrorFallback error={error} reset={reset} pageName={t('scorePage')} />;
}
