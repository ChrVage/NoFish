import type { MetadataRoute } from 'next';

const BASE_URL = 'https://nofish.no';
const LOCALES = ['no', 'en'] as const;
const DEFAULT_LOCALE = 'no';

function localeUrl(locale: string, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${path}`;
}

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}[] = [
  { path: '/',           changeFrequency: 'daily',   priority: 1.0 },
  { path: '/about',      changeFrequency: 'monthly', priority: 0.8 },
  { path: '/data',       changeFrequency: 'monthly', priority: 0.8 },
  { path: '/score/about',changeFrequency: 'monthly', priority: 0.7 },
  { path: '/statistics', changeFrequency: 'daily',   priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map((locale) => {
      const languages: Record<string, string> = { 'x-default': localeUrl(DEFAULT_LOCALE, path) };
      for (const l of LOCALES) {
        languages[l] = localeUrl(l, path);
      }
      return {
        url: localeUrl(locale, path),
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: { languages },
      };
    })
  );
}
