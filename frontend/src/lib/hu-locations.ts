import settlementsData from './hungarian-settlements.json';

export interface HungarianSettlement {
  name: string;
  zip: string;
  lat: number;
  lng: number;
  county: string;
}

export const ALL_HUNGARIAN_SETTLEMENTS: HungarianSettlement[] =
  settlementsData.settlements as HungarianSettlement[];

export const HUNGARY_CITIES_COORDS: Record<string, [number, number]> =
  settlementsData.cityCoords as unknown as Record<string, [number, number]>;

export const HUNGARIAN_POSTAL_CODE_TO_CITY: Record<string, string> =
  settlementsData.zipToCity as Record<string, string>;

export const HUNGARIAN_ZIP_COORDS: Record<string, [number, number]> =
  settlementsData.zipCoords as unknown as Record<string, [number, number]>;

export const POPULAR_CITIES: string[] = [
  'Budapest',
  'Dunaharaszti',
  'Debrecen',
  'Szeged',
  'Miskolc',
  'Pécs',
  'Győr',
  'Nyíregyháza',
  'Kecskemét',
  'Székesfehérvár',
  'Szombathely',
  'Szolnok',
  'Tatabánya',
  'Kaposvár',
  'Érd',
  'Veszprém',
  'Békéscsaba',
  'Zalaegerszeg',
  'Sopron',
  'Eger',
  'Nagykanizsa',
  'Dunaújváros',
  'Hódmezővásárhely',
  'Salgótarján',
  'Cegléd',
  'Baja',
  'Ózd',
  'Szekszárd',
  'Vác',
  'Pápa',
  'Gyöngyös',
  'Gyula',
  'Hajdúböszörmény',
  'Ajka',
  'Oroszlány',
  'Kiskunfélegyháza',
  'Gödöllő',
  'Szentes',
  'Mosonmagyaróvár',
  'Esztergom',
  'Komló',
  'Jászberény',
  'Siófok',
  'Keszthely',
  'Balatonfüred',
  'Szentendre',
  'Budaörs',
  'Ócsa',
  'Üllő',
  'Gyömrő',
  'Dunakeszi',
];

export const SETTLEMENT_AUTOCOMPLETE_OPTIONS: {
  value: string;
  label: string;
  zip?: string;
}[] = ALL_HUNGARIAN_SETTLEMENTS
  .filter((s) => !s.name.toLowerCase().includes('gps'))
  .map((s) => ({
    value: s.name,
    label: s.name,
    zip: s.zip,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'hu'));

export const BUDAPEST_DISTRICTS_NAMES: Record<string, string> = {
  '1011': 'I. Várkerület',
  '1021': 'II. Rózsadomb / Pasarét',
  '1031': 'III. Óbuda / Békásmegyer',
  '1041': 'IV. Újpest',
  '1051': 'V. Belváros / Lipótváros',
  '1061': 'VI. Terézváros',
  '1071': 'VII. Erzsébetváros',
  '1081': 'VIII. Józsefváros',
  '1091': 'IX. Ferencváros',
  '1101': 'X. Kőbánya',
  '1111': 'XI. Újbuda',
  '1121': 'XII. Hegyvidék',
  '1131': 'XIII. Angyalföld',
  '1141': 'XIV. Zugló',
  '1151': 'XV. Rákospalota / Újpalota',
  '1161': 'XVI. Mátyásföld',
  '1171': 'XVII. Rákosmente',
  '1181': 'XVIII. Pestszentlőrinc',
  '1191': 'XIX. Kispest',
  '1201': 'XX. Pesterzsébet',
  '1211': 'XXI. Csepel',
  '1221': 'XXII. Budafok / Tétény',
  '1231': 'XXIII. Soroksár',
};

export const POSTAL_CODE_AUTOCOMPLETE_OPTIONS: {
  value: string;
  label: string;
  city?: string;
}[] = (() => {
  const map = new Map<string, string>();
  Object.entries(BUDAPEST_DISTRICTS_NAMES).forEach(([code, name]) => {
    map.set(code, `Budapest ${name}`);
  });
  ALL_HUNGARIAN_SETTLEMENTS.forEach((s) => {
    if (s.zip && !map.has(s.zip)) {
      map.set(s.zip, s.name);
    }
  });
  Object.entries(HUNGARIAN_POSTAL_CODE_TO_CITY).forEach(([zip, city]) => {
    if (!map.has(zip)) {
      map.set(zip, city);
    }
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([zip, city]) => ({
      value: zip,
      label: zip,
      city,
    }));
})();

export function getPostalCodeOptionsForCity(
  city?: string | null
): { value: string; label: string; city?: string }[] {
  if (!city) return POSTAL_CODE_AUTOCOMPLETE_OPTIONS;
  const c = city.trim().toLowerCase();
  const cityMatches: { value: string; label: string; city?: string }[] = [];
  const otherMatches: { value: string; label: string; city?: string }[] = [];

  for (const opt of POSTAL_CODE_AUTOCOMPLETE_OPTIONS) {
    if (opt.city && opt.city.toLowerCase().includes(c)) {
      cityMatches.push(opt);
    } else {
      otherMatches.push(opt);
    }
  }

  return [...cityMatches, ...otherMatches];
}

/**
 * Resolves a city name from a 4-digit Hungarian postal code.
 * All 1xxx codes are Budapest.
 */
export function resolveCityFromPostalCode(postalCode?: string | null): string | null {
  if (!postalCode) return null;
  const zip = postalCode.trim();
  if (!/^\d{4}$/.test(zip)) return null;

  if (zip.startsWith('1')) {
    return 'Budapest';
  }

  if (HUNGARIAN_POSTAL_CODE_TO_CITY[zip]) {
    return HUNGARIAN_POSTAL_CODE_TO_CITY[zip];
  }

  const rounded1 = zip.slice(0, 3) + '0';
  if (HUNGARIAN_POSTAL_CODE_TO_CITY[rounded1]) {
    return HUNGARIAN_POSTAL_CODE_TO_CITY[rounded1];
  }

  const rounded2 = zip.slice(0, 2) + '00';
  if (HUNGARIAN_POSTAL_CODE_TO_CITY[rounded2]) {
    return HUNGARIAN_POSTAL_CODE_TO_CITY[rounded2];
  }

  return null;
}

/**
 * Resolves a default 4-digit postal code for a given city name.
 */
export function resolveDefaultPostalCodeFromCity(cityName?: string | null): string | null {
  if (!cityName) return null;
  const c = cityName.trim().toLowerCase();
  if (c === 'budapest') return '1011';

  const match = ALL_HUNGARIAN_SETTLEMENTS.find((s) => s.name.toLowerCase() === c);
  if (match && match.zip) return match.zip;

  for (const [zip, city] of Object.entries(HUNGARIAN_POSTAL_CODE_TO_CITY)) {
    if (city.toLowerCase() === c) {
      return zip;
    }
  }

  return null;
}

const ROMAN_DISTRICTS: Record<string, number> = {
  xxiii: 23, xxii: 22, xxi: 21, xx: 20, xix: 19, xviii: 18, xvii: 17,
  xvi: 16, xv: 15, xiv: 14, xiii: 13, xii: 12, xi: 11, x: 10,
  ix: 9, viii: 8, vii: 7, vi: 6, v: 5, iv: 4, iii: 3, ii: 2, i: 1,
};

export function parseBudapestDistrict(
  postalCode?: string | null,
  city?: string | null,
  address?: string | null,
): number | null {
  const zip = (postalCode || '').trim();
  if (/^1[0-2]\d\d$/.test(zip)) {
    const d = parseInt(zip.slice(1, 3), 10);
    if (d >= 1 && d <= 23) return d;
  }
  const full = ((city || '') + ' ' + (address || '')).toLowerCase();
  const arabicMatch = full.match(/(\d{1,2})\s*\.?\s*ker/);
  if (arabicMatch) {
    const d = parseInt(arabicMatch[1], 10);
    if (d >= 1 && d <= 23) return d;
  }
  for (const [rom, num] of Object.entries(ROMAN_DISTRICTS)) {
    const regex = new RegExp('(?:^|[^a-z])' + rom + '\\s*\\.?\\s*ker');
    if (regex.test(full)) return num;
  }
  return null;
}

export function resolveHungarianCoords(
  city?: string | null,
  postalCode?: string | null,
  address?: string | null,
): [number, number] {
  // 1. Check if Budapest district is identifiable
  const bpDist = parseBudapestDistrict(postalCode, city, address);
  if (bpDist && BUDAPEST_DISTRICTS_COORDS[bpDist - 1]) {
    return [
      BUDAPEST_DISTRICTS_COORDS[bpDist - 1].lat,
      BUDAPEST_DISTRICTS_COORDS[bpDist - 1].lng,
    ];
  }

  // 2. 4-digit postal code match
  const zip = (postalCode || '').trim();
  if (zip && HUNGARIAN_ZIP_COORDS[zip]) {
    return HUNGARIAN_ZIP_COORDS[zip];
  }

  // 3. Exact city match
  const c = (city || '').toLowerCase().trim();
  if (c && HUNGARY_CITIES_COORDS[c]) {
    return HUNGARY_CITIES_COORDS[c];
  }

  // 4. Split city match (e.g. "Kecskemét - Lakitelek")
  if (c) {
    const parts = c.split(/[,-\/]/).map((p) => p.trim());
    for (const part of parts) {
      if (part && HUNGARY_CITIES_COORDS[part]) {
        return HUNGARY_CITIES_COORDS[part];
      }
    }
  }

  // 5. Substring city match
  if (c) {
    for (const [k, coords] of Object.entries(HUNGARY_CITIES_COORDS)) {
      if (k.length >= 4 && c.includes(k)) return coords;
    }
  }

  if (/^\d{4}$/.test(zip)) {
    const p1 = zip[0];
    if (p1 === '1') return [47.4979, 19.0402];
    if (p1 === '2') return [47.4500, 19.1500];
    if (p1 === '3') return [47.9500, 20.4500];
    if (p1 === '4') return [47.6500, 21.6500];
    if (p1 === '5') return [47.0500, 20.6500];
    if (p1 === '6') return [46.5000, 19.8500];
    if (p1 === '7') return [46.2500, 18.2500];
    if (p1 === '8') return [47.1000, 18.0500];
    if (p1 === '9') return [47.4500, 17.0500];
  }

  return [47.4979, 19.0402];
}

/**
 * Estimates driving / road distance from straight-line (Haversine) distance in Hungary.
 */
export function estimateRoadDistanceKm(haversineKm: number): number {
  if (haversineKm <= 3) return Math.round(haversineKm * 1.15);
  if (haversineKm <= 15) return Math.round(haversineKm * 1.25);
  if (haversineKm <= 35) return Math.round(haversineKm * 1.4);
  return Math.round(haversineKm * 1.3);
}

export const BUDAPEST_DISTRICTS_COORDS: { code: string; lat: number; lng: number }[] = [
  { code: '1011', lat: 47.5000, lng: 19.0350 }, // I. Várkerület
  { code: '1021', lat: 47.5250, lng: 18.9950 }, // II. Rózsadomb
  { code: '1031', lat: 47.5600, lng: 19.0400 }, // III. Óbuda
  { code: '1041', lat: 47.5750, lng: 19.0950 }, // IV. Újpest
  { code: '1051', lat: 47.4980, lng: 19.0520 }, // V. Belváros
  { code: '1061', lat: 47.5080, lng: 19.0650 }, // VI. Terézváros
  { code: '1071', lat: 47.5020, lng: 19.0750 }, // VII. Erzsébetváros
  { code: '1081', lat: 47.4900, lng: 19.0800 }, // VIII. Józsefváros
  { code: '1091', lat: 47.4700, lng: 19.0850 }, // IX. Ferencváros
  { code: '1101', lat: 47.4850, lng: 19.1450 }, // X. Kőbánya
  { code: '1111', lat: 47.4650, lng: 19.0300 }, // XI. Újbuda
  { code: '1121', lat: 47.4950, lng: 18.9850 }, // XII. Hegyvidék
  { code: '1131', lat: 47.5350, lng: 19.0750 }, // XIII. Angyalföld
  { code: '1141', lat: 47.5200, lng: 19.1150 }, // XIV. Zugló
  { code: '1151', lat: 47.5550, lng: 19.1350 }, // XV. Rákospalota
  { code: '1161', lat: 47.5200, lng: 19.1950 }, // XVI. Mátyásföld
  { code: '1171', lat: 47.4800, lng: 19.2550 }, // XVII. Rákosmente
  { code: '1181', lat: 47.4350, lng: 19.1850 }, // XVIII. Pestszentlőrinc
  { code: '1191', lat: 47.4550, lng: 19.1350 }, // XIX. Kispest
  { code: '1201', lat: 47.4350, lng: 19.1100 }, // XX. Pesterzsébet
  { code: '1211', lat: 47.4200, lng: 19.0700 }, // XXI. Csepel
  { code: '1221', lat: 47.4200, lng: 19.0250 }, // XXII. Budafok
  { code: '1231', lat: 47.3950, lng: 19.1300 }, // XXIII. Soroksár
];

/**
 * Resolves the closest Hungarian city and its postal code based on GPS latitude and longitude,
 * checking all 3,155 settlements and 23 Budapest districts.
 */
export function resolveNearestHungarianLocation(
  lat: number,
  lng: number,
): { city: string; postalCode: string } {
  let closestSettlement = ALL_HUNGARIAN_SETTLEMENTS[0] || { name: 'Budapest', zip: '1011' };
  let minDistance = Infinity;

  // 1. Check all settlements (except generic Budapest center)
  for (let i = 0; i < ALL_HUNGARIAN_SETTLEMENTS.length; i++) {
    const s = ALL_HUNGARIAN_SETTLEMENTS[i];
    if (s.name.toLowerCase() === 'budapest') continue;
    const dist = haversineDistanceKm(lat, lng, s.lat, s.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestSettlement = s;
    }
  }

  // 2. Check all 23 Budapest districts directly
  let closestBpDistrict: { code: string; lat: number; lng: number } | null = null;
  let minBpDist = Infinity;
  for (const d of BUDAPEST_DISTRICTS_COORDS) {
    const dDist = haversineDistanceKm(lat, lng, d.lat, d.lng);
    if (dDist < minBpDist) {
      minBpDist = dDist;
      closestBpDistrict = d;
    }
  }

  // If closest Budapest district is closer than outside settlements, select Budapest and that district
  if (closestBpDistrict && minBpDist < minDistance) {
    return { city: 'Budapest', postalCode: closestBpDistrict.code };
  }

  return { city: closestSettlement.name, postalCode: closestSettlement.zip };
}

/**
 * Asynchronously resolves the exact city and postal code from GPS coordinates,
 * using OpenStreetMap Nominatim with local dictionary fallback.
 */
export async function reverseGeocodeHungarianLocation(
  lat: number,
  lng: number,
): Promise<{ city: string; postalCode: string }> {
  const fallback = resolveNearestHungarianLocation(lat, lng);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=hu`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const osmCity =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.suburb;
      const osmPostcode = addr.postcode;

      let finalCity = fallback.city;
      let finalPostalCode = fallback.postalCode;

      if (osmCity && typeof osmCity === 'string') {
        const normalized = osmCity.trim();
        if (
          normalized.toLowerCase() === 'budapest' ||
          ALL_HUNGARIAN_SETTLEMENTS.some(
            (s) => s.name.toLowerCase() === normalized.toLowerCase(),
          )
        ) {
          finalCity = normalized;
        }
      }
      if (osmPostcode && /^[1-9]\d{3}$/.test(osmPostcode)) {
        finalPostalCode = osmPostcode;
      } else if (finalCity) {
        const derivedZip = resolveDefaultPostalCodeFromCity(finalCity);
        if (derivedZip) finalPostalCode = derivedZip;
      }

      return { city: finalCity, postalCode: finalPostalCode };
    }
  } catch {
    // Return fallback on network error or timeout
  }

  return fallback;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
