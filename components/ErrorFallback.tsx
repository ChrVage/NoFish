'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Page name shown in the error message (e.g. "forecast details", "fishing score"). */
  pageName?: string;
}

export default function ErrorFallback({ error, reset, pageName }: ErrorFallbackProps) {
  const t = useTranslations('error');
  const locale = useLocale();
  const label = pageName ?? t('page');
  const homeHref = locale !== 'no' ? `/${locale}` : '/';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
        <h2 className="text-xl font-bold text-coastal-red-700 mb-2">
          {t('failedToLoad', { label })}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {t('dataSourceMessage')}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">Error ID: {error.digest}</p>
        )}
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-maritime-teal-600 text-white rounded-lg font-semibold hover:bg-maritime-teal-700 transition-colors"
          >
            {t('tryAgain')}
          </button>
          <Link
            href={homeHref}
            className="text-sm text-maritime-teal-600 hover:text-maritime-teal-700 underline"
          >
            {t('backToMap')}
          </Link>
        </div>
      </div>
    </div>
  );
}
