'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Trash2, Cookie, Database, Building2 } from 'lucide-react';
import { trackPageView } from '@/lib/analytics';

const DATA_CATEGORIES = [
  {
    category: 'Keresési szűrők és Kedvenc állatok (Matchek)',
    purpose:
      'Személyre szabott ajánlás és az örökbefogadásra jelölt állatok elmentése. Kizárólag a Felhasználó saját készülékén (böngésző localStorage) tárolódik, szerverre személyes adat nem kerül feltöltésre.',
    legalBasis: 'GDPR 6. cikk (1) a) – Hozzájárulás (helyi böngésző tárolás)',
    retention: 'Az adatok törléséig a böngészőből vagy a „Helyi adatok törlése” gomb megnyomásáig',
  },
  {
    category: 'Település / Irányítószám / Távolság beállítás',
    purpose:
      'A menhelyek távolságának kiszámítása (km) és a közeli védencek megjelenítése. Kizárólag a helyi böngészőben tárolódik.',
    legalBasis: 'GDPR 6. cikk (1) a) – Hozzájárulás (helyi böngésző tárolás)',
    retention: 'Az adatok módosításáig vagy a helyi tárhely ürítéséig',
  },
  {
    category: 'Google Analytics 4 statisztikai adatok (opcionális)',
    purpose:
      'Névtelen látogatottsági és oldalletöltési statisztika (Consent Mode v2).',
    legalBasis: 'GDPR 6. cikk (1) a) – Kifejezett süti-hozzájárulás',
    retention: 'Max. 14 hónap (vagy a hozzájárulás visszavonásáig)',
  },
];

export default function AdatkezelesPage() {
  useEffect(() => {
    trackPageView('/adatkezeles', 'GDPR Adatkezelési Tájékoztató | Pawnder');
  }, []);

  const openCookieSettings = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pawnder_open_cookie_modal'));
    }
  };

  return (
    <div className="min-h-screen py-5 sm:py-8 px-3 sm:px-6 max-w-4xl mx-auto">
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-purple-200 text-purple-800 font-bold text-xs sm:text-sm hover:bg-purple-50 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Vissza a kezdőlapra</span>
        </Link>
        <div className="flex items-center gap-3 text-xs font-bold text-purple-700">
          <Link href="/impresszum" className="hover:underline px-1 py-1">
            Impresszum →
          </Link>
          <span className="text-purple-300">•</span>
          <Link href="/aszf" className="hover:underline px-1 py-1">
            ÁSZF →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-10 petpals-card-shadow space-y-6 sm:space-y-8">
        <div className="border-b border-purple-100 pb-4 sm:pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs font-bold mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>EU 2016/679 (GDPR) & Infotv. megfelelő</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[#231942] leading-snug">
            Adatkezelési és Sütikezelési Tájékoztató (GDPR)
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
            Átlátható tájékoztatás a 100%-ban regisztrációmentes működésről, a helyi adattárolásról (LocalStorage) és a Google Analytics 4 mérésről.
          </p>
        </div>

        {/* 1. Adatkezelő adatai */}
        <section className="space-y-2.5">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>1. Az Adatkezelő megnevezése és elérhetőségei</span>
          </h2>
          <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-3.5 sm:p-5 text-xs sm:text-sm space-y-1.5 text-gray-700 break-words">
            <p>
              <strong>Adatkezelő neve:</strong> Almási Patrik (magánszemély, non-profit üzemeltető)
            </p>
            <p>
              <strong>E-mail cím adatvédelmi ügyekben:</strong>{' '}
              <a
                href="mailto:almasi.patrik@gmail.com"
                className="text-purple-700 font-semibold underline break-all"
              >
                almasi.patrik@gmail.com
              </a>
            </p>
          </div>
        </section>

        {/* 2. Kezelt adatok köre */}
        <section className="space-y-3 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>2. A kezelt személyes adatok köre, célja, jogalapja és megőrzési ideje</span>
          </h2>

          {/* Mobile Stacked Cards (No horizontal scrolling or squished columns!) */}
          <div className="grid grid-cols-1 gap-2.5 sm:hidden">
            {DATA_CATEGORIES.map((row, idx) => (
              <div
                key={idx}
                className="bg-purple-50/50 border border-purple-100 rounded-2xl p-3.5 space-y-1.5 text-xs"
              >
                <div className="font-extrabold text-[#231942] text-sm border-b border-purple-100 pb-1">
                  {row.category}
                </div>
                <p>
                  <strong className="text-purple-900">Cél:</strong> {row.purpose}
                </p>
                <p>
                  <strong className="text-purple-900">Jogalap:</strong> {row.legalBasis}
                </p>
                <p>
                  <strong className="text-purple-900">Megőrzési idő:</strong> {row.retention}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto border border-purple-100 rounded-2xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-purple-50 text-[#231942] font-bold">
                <tr>
                  <th className="p-3 border-b border-purple-100">Adatkategória</th>
                  <th className="p-3 border-b border-purple-100">Cél</th>
                  <th className="p-3 border-b border-purple-100">Jogalap (GDPR)</th>
                  <th className="p-3 border-b border-purple-100">Megőrzési idő</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100">
                {DATA_CATEGORIES.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-semibold">{row.category}</td>
                    <td className="p-3">{row.purpose}</td>
                    <td className="p-3">{row.legalBasis}</td>
                    <td className="p-3">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Regisztrációmentesség és Helyi Adattörlés */}
        <section className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
            <span>3. 100% Regisztrációmentesség és Helyi Adattörlés (GDPR 17. cikk)</span>
          </h2>
          <p>
            A Pawnder használatához <strong>nincs szükség regisztrációra vagy bejelentkezésre, és a rendszer nem hoz létre felhasználói fiókokat</strong>. Nem kérünk és szerverünkön nem tárolunk semmilyen személyes adatot (e-mail címet, nevet vagy jelszót).
          </p>
          <p>
            A mentett kedvenc állatok listája és a keresési beállítások kizárólag az Ön eszközén, a böngésző helyi tárhelyén (HTML5 LocalStorage) tárolódnak.
          </p>
          <p>
            A <strong>Beállítások</strong> menüpontban található <strong>„Helyi mentett adatok törlése ezen a készüléken”</strong> gombra kattintva, vagy a böngésző előzményeinek törlésével bármikor azonnal és véglegesen törölheti az összes mentett adatot a készülékéről.
          </p>
        </section>

        {/* 4. Sütik és Google Analytics */}
        <section className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Cookie className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
            <span>4. Sütikezelés (Cookies) és Google Analytics 4</span>
          </h2>
          <p>
            Weboldalunk a <strong>Google Consent Mode v2</strong> szabványt alkalmazza. Alapértelmezés szerint minden statisztikai süti blokkolt állapotban van, amíg Ön a süti-sávban az <strong>„Elfogadom”</strong> gombra nem kattint.
          </p>
          <div>
            <button
              type="button"
              onClick={openCookieSettings}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition cursor-pointer"
            >
              🍪 Süti-hozzájárulás módosítása most
            </button>
          </div>
        </section>

        {/* 5. Adatfeldolgozók és Jogorvoslat */}
        <section className="space-y-2.5 text-xs sm:text-sm text-gray-700 leading-relaxed border-t border-purple-100 pt-5">
          <h2 className="text-base sm:text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
            <span>5. Adatfeldolgozók és Jogorvoslati lehetőségek (NAIH)</span>
          </h2>
          <p>
            <strong>Tárhely és felhő-infrastruktúra:</strong> Amazon Web Services EMEA SARL (38 Avenue John F. Kennedy, L-1855 Luxembourg – EU régió, titkosított szerver- és adatbáziskapcsolat).
          </p>
          <p>
            <strong>Domain regisztráció és DNS kiszolgálás:</strong> Rackhost Zrt. (6722 Szeged, Tisza Lajos körút 41. – info@rackhost.hu).
          </p>
          <p>
            Amennyiben Ön szerint személyes adatainak kezelése sérti a GDPR előírásait, panasszal fordulhat a felügyeleti hatósághoz:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 sm:p-4 text-xs space-y-1 break-words">
            <p>
              <strong>Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)</strong>
            </p>
            <p>Cím: 1055 Budapest, Falk Miksa utca 9-11. • Postacím: 1363 Budapest, Pf. 9.</p>
            <p>E-mail: ugyfelszolgalat@naih.hu • Weboldal: https://www.naih.hu</p>
          </div>
        </section>
      </div>
    </div>
  );
}
