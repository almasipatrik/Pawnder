'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, HeartHandshake, ShieldAlert, FileCheck2, Info } from 'lucide-react';
import { trackPageView } from '@/lib/analytics';

export default function AszfPage() {
  useEffect(() => {
    trackPageView('/aszf', 'ÁSZF | Pawnder');
  }, []);

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
          <Link href="/adatkezeles" className="hover:underline px-1 py-1">
            Adatkezelés (GDPR) →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-10 petpals-card-shadow space-y-6 sm:space-y-8">
        <div className="border-b border-purple-100 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold mb-3">
            <Scale className="w-3.5 h-3.5" />
            <span>Hatályos: 2026. november 1-től</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#231942]">
            Általános Szerződési és Felhasználási Feltételek (ÁSZF)
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Pawnder – Non-profit, társadalmi célú menhelyi állat-örökbefogadást segítő webalkalmazás
          </p>
        </div>

        {/* 1. Üzemeltető adatai */}
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <Info className="w-5 h-5 text-purple-600" />
            <span>1. Az Üzemeltető (Szolgáltató) adatai és jogállása</span>
          </h2>
          <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 sm:p-5 text-sm space-y-2 text-gray-700">
            <p>
              <strong>Üzemeltető neve:</strong> Almási Patrik (magánszemély)
            </p>
            <p>
              <strong>Üzemeltetés jellege:</strong> 100%-ban <strong>non-profit, karitatív és társadalmi célú</strong> magánkezdeményezés. Az Üzemeltető a weboldalon üzletszerű gazdasági vagy kereskedelmi tevékenységet nem végez, díjat, jutalékot vagy előfizetési díjat nem számít fel.
            </p>
            <p>
              <strong>Kapcsolattartási e-mail:</strong>{' '}
              <a href="mailto:almasi.patrik@gmail.com" className="text-purple-700 font-semibold underline">
                almasi.patrik@gmail.com
              </a>
            </p>
          </div>
        </section>

        {/* 2. A szolgáltatás célja és működése */}
        <section className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-rose-500" />
            <span>2. A Szolgáltatás célja és működése</span>
          </h2>
          <p>
            A <strong>Pawnder</strong> platform célja, hogy interaktív, játékos (jobbra/balra húzásos) felületen és személyre szabott százalékos ajánlórendszeren keresztül segítse a magyarországi állatmenhelyeken, gyepmesteri telepeken és állatvédő szervezeteknél gazdira váró kutyák és macskák örökbefogadását.
          </p>
          <p>
            A platform a nyilvánosan elérhető magyarországi menhelyi adatbázisokban szereplő, örökbefogadható állatok adatait és a menhelyek elérhetőségeit jeleníti meg kereshető, távolság és életmód szerint szűrhető formában. A képeket az alkalmazás nem tárolja saját szerverén bináris formában, kizárólag a nyilvános képlinkekre hivatkozik.
          </p>
        </section>

        {/* 3. Örökbefogadás menete */}
        <section className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-purple-600" />
            <span>3. Az örökbefogadás folyamata (Közvetlen kapcsolatfelvétel a menhellyel)</span>
          </h2>
          <p>
            3.1. A Pawnder alkalmazásban történő „jobbra húzás” (Örökbefogadnám) <strong>nem minősül jogi értelemben vett örökbefogadási szerződésnek vagy lefoglalásnak</strong>.
          </p>
          <p>
            3.2. Sikeres egyezés esetén a rendszer megjeleníti az adott állatot gondozó állatmenhely vagy állatvédő szervezet közvetlen elérhetőségeit (telefonszám, e-mail cím, pontos cím, örökbefogadási feltételek és az állat menhelyi azonosítószáma).
          </p>
          <p>
            3.3. <strong>A Felhasználó feladata és felelőssége, hogy közvetlenül felvegye a kapcsolatot a menhellyel.</strong> Az örökbefogadás feltételeit (pl. személyes látogatás, örökbefogadási szerződés aláírása, oltási/orvosi költséghozzájárulás, ivartalanítási kötelezettség) kizárólag az adott állatvédő szervezet határozza meg.
          </p>
        </section>

        {/* 4. Regisztrációmentesség és Helyi Adattárolás */}
        <section className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#231942]">
            4. 100% Regisztrációmentesség és Helyi Adattárolás (LocalStorage)
          </h2>
          <p>
            4.1. A Pawnder webalkalmazás teljes mértékben <strong>regisztrációmentes</strong>. A platform használatához sem fiók létrehozására, sem e-mail cím vagy személyes adat megadására nincs szükség.
          </p>
          <p>
            4.2. <strong>Helyi tárolás (LocalStorage):</strong> A Felhasználó által beállított keresési szűrők és a kedvencnek jelölt állatok (Matchek) kizárólag a Felhasználó saját készülékének böngészőjében (HTML5 LocalStorage) tárolódnak. A szerverre semmilyen felhasználói profiladat nem kerül feltöltésre.
          </p>
          <p>
            4.3. <strong>Helyi adatok törlése:</strong> A Felhasználó a <em>Beállítások</em> menüpontban található <strong>„Helyi mentett adatok törlése ezen a készüléken”</strong> gombbal vagy a böngészője előzményeinek törlésével bármikor, egyetlen kattintással véglegesen törölheti a helyi mentéseit.
          </p>
        </section>

        {/* 5. Felelősségkorlátozás */}
        <section className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#231942] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>5. Felelősségkorlátozás</span>
          </h2>
          <p>
            5.1. Mivel az Üzemeltető a szolgáltatást magánszemélyként, teljesen ingyenesen és non-profit alapon biztosítja, az állatok adatlapján szereplő információk (életkor, egészségi állapot, szobatisztaság, kompatibilitás, aktuális elérhetőség) pontosságáért a feltöltő állatmenhelyek felelnek.
          </p>
          <p>
            5.2. A rendszer rendszeresen frissíti az adatbázist, és automatikusan megjelöli a már örökbe fogadott állatokat, illetve hozzáadja az újonnan bekerült védenceket, azonban előfordulhat, hogy egy állat időközben már gazdira talált.
          </p>
          <p>
            5.3. Az ajánlórendszer által számított százalékos egyezési érték (pl. 85% vagy 95%) tájékoztató jellegű algoritmusos becslés, amely nem helyettesíti a menhelyen történő személyes találkozást és próbasétát.
          </p>
        </section>

        {/* 6. Záró rendelkezések */}
        <section className="space-y-3 text-sm text-gray-700 leading-relaxed border-t border-purple-100 pt-6">
          <h2 className="text-lg font-extrabold text-[#231942]">
            6. Irányadó jog és kapcsolat
          </h2>
          <p>
            Jelen ÁSZF-re a magyar jog, különösen a Polgári Törvénykönyvről szóló 2013. évi V. törvény (Ptk.) rendelkezései az irányadók. Bármilyen észrevétel vagy kérdés esetén az Üzemeltető a fenti elérhetőségeken áll rendelkezésre.
          </p>
        </section>
      </div>
    </div>
  );
}

