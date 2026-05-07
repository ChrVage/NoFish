import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/Header';
import Logo from '@/components/Logo';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  const canonical = locale === 'no' ? 'https://nofish.no/about' : `https://nofish.no/${locale}/about`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical },
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  const scoreAboutHref = locale !== 'no' ? `/${locale}/score/about` : '/score/about';
  const dataHref = locale !== 'no' ? `/${locale}/data` : '/data';
  return (
    <div className="min-h-screen bg-gray-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo href="/" showText={true} />
        </div>
      </Header>

      <main className="max-w-3xl mx-auto w-full min-w-0 px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ padding: '2rem 1.5rem' }}>

          <h1 className="text-2xl font-bold text-maritime-teal-800 mb-2">{t('title')}</h1>
          <p className="text-sm text-gray-500 mb-6 italic">
            {t('tagline')}
          </p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6 break-words [overflow-wrap:anywhere] [&_table]:w-full [&_th]:whitespace-normal [&_td]:whitespace-normal [&_th]:align-top [&_td]:align-top">

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('whatItDoes.heading')}</h2>
              <p>{t.rich('whatItDoes.intro', { strong: (c) => <strong>{c}</strong> })}</p>
              <p>{t('whatItDoes.clickInstruction')}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t.rich('whatItDoes.scoreFeature', { strong: (c) => <strong>{c}</strong>, scoreLink: (c) => <Link href={scoreAboutHref} className="text-maritime-teal-600 underline">{c}</Link> })}</li>
                <li>{t.rich('whatItDoes.detailsFeature', { strong: (c) => <strong>{c}</strong> })}</li>
                <li>{t.rich('whatItDoes.tideFeature', { strong: (c) => <strong>{c}</strong> })}</li>
              </ul>
              <p>{t('whatItDoes.oceanNote')}</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('howToUse.heading')}</h2>
              <p>{t('howToUse.waveGridDot')}</p>
              <p>{t.rich('howToUse.locateButton', { strong: (c) => <strong>{c}</strong> })}</p>
              <p>{t.rich('howToUse.logoBack', { strong: (c) => <strong>{c}</strong> })}</p>
              <p>{t.rich('howToUse.footerBar', { strong: (c) => <strong>{c}</strong> })}</p>
              <p>{t('howToUse.backRestores')}</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('forecastTable.heading')}</h2>
              <p>{t.rich('forecastTable.intro', { dataLink: (c) => <Link href={dataHref} className="text-maritime-teal-600 underline">{c}</Link> })}</p>
              <div className="overflow-x-auto">
                <table className="text-xs mt-2 w-full table-auto">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="pb-1 pr-4">{t('forecastTable.groupHeader')}</th>
                      <th className="pb-1 pr-4">{t('forecastTable.columnsHeader')}</th>
                      <th className="pb-1">{t('forecastTable.notesHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.met')}</td><td className="py-1 pr-4">{t('forecastTable.rows.metColumns')}</td><td className="py-1">{t('forecastTable.rows.metNotes')}</td></tr>
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.waves')}</td><td className="py-1 pr-4">{t('forecastTable.rows.wavesColumns')}</td><td className="py-1">{t('forecastTable.rows.wavesNotes')}</td></tr>
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.current')}</td><td className="py-1 pr-4">{t('forecastTable.rows.currentColumns')}</td><td className="py-1">{t('forecastTable.rows.currentNotes')}</td></tr>
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.seaTemp')}</td><td className="py-1 pr-4">{t('forecastTable.rows.seaTempColumns')}</td><td className="py-1">{t('forecastTable.rows.seaTempNotes')}</td></tr>
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.kartverket')}</td><td className="py-1 pr-4">{t('forecastTable.rows.kartverketColumns')}</td><td className="py-1">{t('forecastTable.rows.kartverketNotes')}</td></tr>
                    <tr><td className="py-1 pr-4">{t('forecastTable.rows.calculated')}</td><td className="py-1 pr-4">{t('forecastTable.rows.calculatedColumns')}</td><td className="py-1">{t('forecastTable.rows.calculatedNotes')}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('notSubstitute.heading')}</h2>
              <p>{t.rich('notSubstitute.text', { strong: (c) => <strong>{c}</strong> })}</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('security.heading')}</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t.rich('security.serverSide', { strong: (c) => <strong>{c}</strong> })}</li>
                <li>{t('security.noCookies')}</li>
                <li>{t('security.headers')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('moreInfo.heading')}</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><Link href={dataHref} className="text-maritime-teal-600 underline">{t('moreInfo.dataRef')}</Link> — {t('moreInfo.dataRefDesc')}</li>
                <li><Link href={scoreAboutHref} className="text-maritime-teal-600 underline">{t('moreInfo.scoreAlgo')}</Link> — {t('moreInfo.scoreAlgoDesc')}</li>
                <li><a href="https://github.com/ChrVage/NoFish" target="_blank" rel="noopener noreferrer" className="text-maritime-teal-600 underline">{t('moreInfo.github')}</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-maritime-teal-800 mt-6 mb-2">{t('feedback.heading')}</h2>
              <p>
                {t('feedback.text')}{' '}
                <a href="https://github.com/ChrVage/NoFish/issues/new/choose" target="_blank" rel="noopener noreferrer" className="text-maritime-teal-600 underline">
                  {t('feedback.githubLink')}
                </a>.
              </p>
              <p className="mt-2">
                {t('feedback.contact')}{' '}
                <a href="mailto:hi@nofish.no" className="text-maritime-teal-600 underline">{t('feedback.email')}</a>
              </p>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
