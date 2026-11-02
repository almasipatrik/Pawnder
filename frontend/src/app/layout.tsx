import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { CookieConsentBanner } from './components/CookieConsentBanner';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  process.env.NEXT_PUBLIC_GA_ID ||
  'G-ZTPGHSG9DN';

const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.pawnder.hu'),
  title: {
    default: 'Pawnder | Találd meg a tökéletes menhelyi társadat!',
    template: '%s | Pawnder',
  },
  description:
    'Interaktív, 100% regisztrációmentes menhelyi kutya és macska örökbefogadás-segítő platform személyre szabott százalékos kompatibilitási ajánlórendszerrel és távolság alapú kereséssel.',
  applicationName: 'Pawnder',
  authors: [{ name: 'Pawnder' }],
  creator: 'Pawnder',
  publisher: 'Pawnder',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  keywords: [
    'menhelyi kutya',
    'menhelyi macska',
    'kutya örökbefogadás',
    'macska örökbefogadás',
    'örökbefogadás',
    'állatmenhely',
    'mentett állatok',
    'kutya kereső',
    'cica örökbefogadás',
    'gazdit keres',
    'örökbefogadható kutyák',
    'örökbefogadható macskák',
    'menhely budapest',
    'Pawnder',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'hu_HU',
    url: 'https://www.pawnder.hu',
    siteName: 'Pawnder',
    title: 'Pawnder | Találd meg a tökéletes menhelyi társadat!',
    description:
      'Interaktív, regisztrációmentes menhelyi kutya és macska örökbefogadás intelligens ajánlórendszerrel. Találj rá hűséges társadra!',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'Pawnder - Menhelyi állatok örökbefogadása',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Pawnder | Találd meg a tökéletes menhelyi társadat!',
    description:
      'Interaktív, regisztrációmentes menhelyi kutya és macska örökbefogadás intelligens ajánlórendszerrel.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  ...(GOOGLE_SITE_VERIFICATION
    ? { verification: { google: GOOGLE_SITE_VERIFICATION } }
    : {}),
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.pawnder.hu/#website',
      url: 'https://www.pawnder.hu',
      name: 'Pawnder',
      description:
        'Magyarországi menhelyi kutyák és macskák örökbefogadását segítő platform intelligens ajánlórendszerrel.',
      inLanguage: 'hu-HU',
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://www.pawnder.hu/#webapp',
      name: 'Pawnder',
      url: 'https://www.pawnder.hu',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'HUF',
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="hu"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Schema.org Structured Data for Google Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        {/* Google Analytics 4 (gtag.js) with Consent Mode v2 */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          id="google-tag-gtag"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              var savedConsent = 'denied';
              try {
                var stored = localStorage.getItem('pawnder_cookie_consent');
                if (stored === 'granted') savedConsent = 'granted';
              } catch(e) {}

              gtag('consent', 'default', {
                'analytics_storage': savedConsent,
                'ad_storage': savedConsent,
                'ad_user_data': savedConsent,
                'ad_personalization': savedConsent,
                'wait_for_update': 500
              });

              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col text-[#231942] antialiased selection:bg-purple-600 selection:text-white">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
