'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Mail,
  Server,
  Scale,
  ShieldCheck,
  Heart,
  Info,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { trackPageView } from '@/lib/analytics';

export default function ImpresszumPage() {
  useEffect(() => {
    trackPageView('/impresszum', 'Impresszum | Pawnder');
  }, []);

  return (
    <div className="min-h-screen py-5 sm:py-8 px-3 sm:px-6 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-purple-200 text-purple-800 font-bold text-xs sm:text-sm hover:bg-purple-50 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Vissza a kezdőlapra</span>
        </Link>
        <div className="flex items-center gap-3 text-xs font-bold text-purple-700">
          <Link href="/aszf" className="hover:underline px-1 py-1">
            ÁSZF →
          </Link>
          <span className="text-purple-300">•</span>
          <Link href="/adatkezeles" className="hover:underline px-1 py-1">
            Adatkezelés (GDPR) →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-10 petpals-card-shadow space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="border-b border-purple-100 pb-5 sm:pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold mb-3">
            <Info className="w-3.5 h-3.5" />
            <span>Ekertv. (2001. évi CVIII. törvény 4. §) szerinti tájékoztatás</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231942]">
            Impresszum
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
            A Pawnder webalkalmazás szolgáltatói, üzemeltetői és technikai tárhelyadatai.
          </p>
        </div>

        {/* 1. Szolgáltató adatai */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>1. Az Üzemeltető (Szolgáltató) adatai</span>
          </h2>
          <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm space-y-2 text-gray-700">
            <p>
              <strong>Üzemeltető neve:</strong> Almási Patrik (magánszemély)
            </p>
            <p>
              <strong>Jogi státusz:</strong> Nem gazdasági célú, 100%-ban non-profit magánkezdeményezés.
            </p>
            <p>
              <strong>Székhely / Értesítési cím:</strong> Magyarország (Budapest).{' '}
              <span className="text-gray-500 italic">
                (Mivel a projekt magánszemélyként, non-profit céllal működik, nyilvános ügyfélszolgálati vagy személyes ügyfélfogadási helyiséggel nem rendelkezik.)
              </span>
            </p>
            <p>
              <strong>Elektronikus kapcsolattartási cím:</strong>{' '}
              <a
                href="mailto:almasi.patrik@gmail.com"
                className="text-purple-700 font-semibold underline break-all"
              >
                almasi.patrik@gmail.com
              </a>
            </p>
            <p>
              <strong>Nyilvántartási szám / Adószám:</strong> Mivel az üzemeltető magánszemélyként jár el, és a weboldalon nem folytat üzletszerű gazdasági tevékenységet, sem díjköteles értékesítést, nyilvántartási számmal vagy adószámmal nem rendelkezik.
            </p>
          </div>
        </section>

        {/* 2. Tárhely és Infrastruktúra adatai */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>2. Tárhelyszolgáltató és Domain regisztrátor adatai (Ekertv. 4. § h) pont)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
            {/* AWS Hosting */}
            <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-4 space-y-1.5 text-gray-700">
              <div className="font-bold text-[#231942] text-sm flex items-center gap-1.5 mb-1">
                <Server className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Felhő infrastruktúra & Tárhely (Frontend, Backend & DB)</span>
              </div>
              <p>
                <strong>Szolgáltató:</strong> Amazon Web Services EMEA SARL
              </p>
              <p>
                <strong>Székhely:</strong> 38 Avenue John F. Kennedy, L-1855 Luxembourg
              </p>
              <p>
                <strong>Helyszín:</strong> Európai Unió (EU régió, titkosított adatkapcsolat)
              </p>
              <p>
                <strong>Weboldal:</strong>{' '}
                <a
                  href="https://aws.amazon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 underline font-semibold"
                >
                  https://aws.amazon.com
                </a>
              </p>
            </div>

            {/* Rackhost Domain */}
            <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-4 space-y-1.5 text-gray-700">
              <div className="font-bold text-[#231942] text-sm flex items-center gap-1.5 mb-1">
                <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Domain regisztrátor & DNS szolgáltató</span>
              </div>
              <p>
                <strong>Szolgáltató:</strong> Rackhost Zrt.
              </p>
              <p>
                <strong>Székhely:</strong> 6722 Szeged, Tisza Lajos körút 41.
              </p>
              <p>
                <strong>Cégjegyzékszám:</strong> 06-10-000489 • <strong>Adószám:</strong> 25333572-2-06
              </p>
              <p>
                <strong>Kapcsolat:</strong>{' '}
                <a
                  href="mailto:info@rackhost.hu"
                  className="text-purple-700 underline font-semibold"
                >
                  info@rackhost.hu
                </a>{' '}
                •{' '}
                <a
                  href="https://www.rackhost.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-700 underline"
                >
                  https://www.rackhost.hu
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* 3. A platform célja és jellege */}
        <section className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 shrink-0" />
            <span>3. A szolgáltatás célja és non-profit jellege</span>
          </h2>
          <p>
            A <strong>Pawnder</strong> egy non-profit, társadalmi és karitatív célú állatvédelmi kezdeményezés, melynek egyetlen célja, hogy megkönnyítse a magyarországi menhelyeken és állatvédő szervezeteknél élő, gazdára váró kutyák és macskák örökbefogadását modern, átlátható felületen keresztül.
          </p>
          <p>
            A weboldal látogatása, a keresési és szűrési funkciók, valamint a kedvencek mentése <strong>minden felhasználó számára 100%-ban ingyenes és regisztrációmentes</strong>. A Pawnder nem kér személyes adatokat, nem folytat közvetítői kereskedelmet, nem szed adományt, és semmilyen díjat vagy jutalékot nem kér sem az örökbefogadóktól, sem a menhelyektől.
          </p>
        </section>

        {/* 4. Források és Szerzői jogok */}
        <section className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>4. Adatforrások és Szerzői jogok</span>
          </h2>
          <p>
            Az alkalmazásban megjelenített állatok adatai, leírásai és fotói a magyarországi menhelyek és állatvédő alapítványok nyilvánosan elérhető adatbázisaiból származnak az állatok örökbefogadásának népszerűsítése céljából.
          </p>
          <p>
            A megjelenített képeket és védenceket az eredeti menhelyek és szervezetek tartják nyilván; a szerzői és rendelkezési jogok az adott szervezeteket illetik. Az alkalmazás képeket közvetlenül nem értékesít, és azok forráslinkjére közvetlen hivatkozással hivatkozik.
          </p>
        </section>

        {/* 5. Jogorvoslati és felügyeleti hatóság */}
        <section className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed border-t border-purple-100 pt-5">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>5. Felügyeleti hatóság és vitarendezés</span>
          </h2>
          <p>
            Adatkezelési kérdésekben az illetékes felügyeleti hatóság:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 sm:p-4 text-xs space-y-1">
            <p className="font-bold text-[#231942]">
              Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)
            </p>
            <p>Székhely: 1055 Budapest, Falk Miksa utca 9-11.</p>
            <p>Postacím: 1363 Budapest, Pf. 9.</p>
            <p>E-mail: ugyfelszolgalat@naih.hu • Weboldal: https://www.naih.hu</p>
          </div>
          <p className="text-xs text-gray-500">
            A szolgáltatással kapcsolatos bármilyen kérdés, pontosítás vagy kérés esetén készséggel állunk rendelkezésre az <a href="mailto:almasi.patrik@gmail.com" className="text-purple-700 underline font-semibold">almasi.patrik@gmail.com</a> címen.
          </p>
        </section>
      </div>
    </div>
  );
}
