import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['no', 'en', 'de', 'nl', 'pl'],
  defaultLocale: 'no',
  localePrefix: 'as-needed',
});
