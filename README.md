# 🐾 Pawnder – Menhelyi Állatkereső és Személyre Szabott Ajánlórendszer

Interaktív, társkereső alkalmazásokhoz (Tinder-stílusú jobbra/balra húzáshoz) hasonló menhelyi kutya- és macskakereső, valamint százalékos ajánlórendszer (`60%`–`99%` egyezés).

---

## Főbb funkciók

1. **Interaktív Swipe Felület (`Kezdőlap`)**:
   - Jobbra húzás (*Örökbefogadnám*) és balra húzás (*Tovább*), billentyűzettel (`←` / `→`) vagy érintőképernyőn/egérrel.
   - **Egyoldalú Match folyamat**: Amikor a felhasználó jobbra húz egy állatot, azonnal megjelenik a **Match kártya** (`"95% egyezés! Lili tökéletes lehet számodra!"`), a *"Miért illik hozzád?"* indoklással és a **menhely közvetlen elérhetőségeivel** (telefonszám, e-mail cím, cím, örökbefogadási tudnivalók, állat azonosító), hogy a leendő gazdi közvetlenül felvehesse a kapcsolatot a menhellyel.
2. **Személyre szabott Ajánlórendszer (`Ajánlások` fül)**:
   - Az összes (13 db) keresési szűrő és legördülő érték + minimum egyezési küszöbérték (`55%–95%`):
     - **Faj**: Kutya (`kutya`) / Macska (`macska`)
     - **Fajta**: 170 kutyafajta és 26 macskafajta
     - **Életkor**: `0` – `99` év
     - **Nem**: Mindegy / Kan (Kandúr) / Szuka (Nőstény)
     - **Méret**: Mindegy / Kicsi / Közepes / Nagy
     - **Embereket szereti**, **Gyerekeket szereti**, **Szobatiszta**, **Fiúkutyákkal barátságos**, **Lánykutyákkal barátságos**, **Ivartalanítva**: Mindegy / Igen / Nem
     - **Javasolt tartás**: Mindegy / Csak lakásban / Kertben / Lakásban és kertben is
     - **Szervezet**: 175 magyarországi menhely és állatvédő alapítvány
3. **Távolság alapú szűrés és ajánlás**:
   - Település / irányítószám választás vagy böngésző GPS pozíció alapján Haversine-távolság számítás a menhely székhelyéhez képest (`10–500 km` vagy országos).
4. **Várakozási idő mutató (Mennyi ideje vár gazdira)**:
   - Minden állat kártyáján és adatlapján vizuális mérősáv és számláló mutatja, hány napja/hónapja/éve vár örökbefogadásra a menhelyen.
5. **Képek kezelése**:
   - Az adatbázisban **kizárólag a képek URL hivatkozásai** (`thumbnail_url`, `image_links`) kerülnek eltárolásra, bináris képfájlok soha nem kerülnek az adatbázisba.
6. **Háttér-szinkronizáció (Docker Scraper Worker -> PostgreSQL / AWS RDS)**:
   - Időközönként lekérdezi a menhelyi kutya és macska adatlapokat (`ISO-8859-2` karakterkódolás-dekódolással).
   - Ha egy állat még nincs az adatbázisban -> **létrehozza**.
   - Ha már szerepel -> **frissíti** az adatait.
   - Ha a forrásoldalon már nem létezik (örökbefogadták / lekerült a listáról) -> **nem törli fizikailag (nincs hard-delete)**, hanem **`is_adopted = true` („Gazdira talált! 🏡”)** státuszra állítja, így a Tinderes keresőben és az ajánlások között már nem jelenik meg, viszont azoknál a felhasználóknál, akik korábban már kedvelték (matcheltek vele), továbbra is látható marad a **Kedvenceim & Matcheim** fülön a *„Gazdira talált!”* jelzéssel.
7. **100% Regisztrációmentes működés, Helyi adattárolás (LocalStorage), ÁSZF, GDPR és GA4**:
   - Teljesen regisztráció- és fiókmentes: semmilyen személyes adatot (e-mail cím, név, jelszó) nem kér és nem tárol szerveren.
   - A mentett kedvenc állatok (Matchek) és a keresési szűrők kizárólag a Felhasználó saját böngészőjében (`localStorage`) tárolódnak, és egy kattintással törölhetők.
   - Magánszemélyként, non-profit jelleggel üzemeltetett **Impresszum (`/impresszum`)**, **ÁSZF (`/aszf`)** és **Adatkezelési Tájékoztató (`/adatkezeles`)** (Üzemeltető: *Almási Patrik, almasi.patrik@gmail.com*).
   - **Google Analytics 4 + Consent Mode v2** süti hozzájárulási sávval (`CookieConsentBanner`).

---

## Fejlesztői indítás helyben (Local Development)

### 1. Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
A webalkalmazás a `http://localhost:3001` címen érhető el.


