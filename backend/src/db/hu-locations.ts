import settlementsData from './hungarian-settlements.json' with { type: 'json' };

export const HUNGARY_CITIES_COORDS: Record<string, [number, number]> =
  settlementsData.cityCoords as unknown as Record<string, [number, number]>;

export const HUNGARIAN_POSTAL_CODE_TO_CITY: Record<string, string> =
  settlementsData.zipToCity as Record<string, string>;

export const HUNGARIAN_ZIP_COORDS: Record<string, [number, number]> =
  settlementsData.zipCoords as unknown as Record<string, [number, number]>;

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

export const COUNTY_COORDS: Record<string, [number, number]> = {
  'budapest': [47.4979, 19.0402],
  'pest': [47.4500, 19.2500],
  'bács-kiskun': [46.5667, 19.4167],
  'baranya': [46.0727, 18.2323],
  'békés': [46.6736, 21.0877],
  'borsod-abaúj-zemplén': [48.1035, 20.7784],
  'csongrád': [46.4181, 20.2500],
  'csongrád-csanád': [46.4181, 20.2500],
  'fejér': [47.1860, 18.4221],
  'győr-moson-sopron': [47.6875, 17.3500],
  'hajdú-bihar': [47.5316, 21.5000],
  'heves': [47.8000, 20.2500],
  'jász-nagykun-szolnok': [47.2500, 20.5000],
  'komárom-esztergom': [47.6000, 18.4000],
  'nógrád': [48.0000, 19.5500],
  'somogy': [46.3594, 17.6000],
  'szabolcs-szatmár-bereg': [47.9558, 22.0000],
  'tolna': [46.4500, 18.5500],
  'vas': [47.1500, 16.6500],
  'veszprém': [47.0933, 17.7500],
  'zala': [46.7500, 16.9000],
};

export function resolveHungarianCoords(
  city?: string | null,
  county?: string | null,
  shelterName?: string | null,
  postalCode?: string | null,
  address?: string | null,
): [number, number] {
  // 1. Check if Budapest district is identifiable (from zip, city, or address)
  const bpDist = parseBudapestDistrict(postalCode, city, address);
  if (bpDist && BUDAPEST_DISTRICTS_COORDS[bpDist - 1]) {
    return [
      BUDAPEST_DISTRICTS_COORDS[bpDist - 1].lat,
      BUDAPEST_DISTRICTS_COORDS[bpDist - 1].lng,
    ];
  }

  // 2. Check 4-digit postal code
  const zip = (postalCode || '').trim();
  if (zip && HUNGARIAN_ZIP_COORDS[zip]) {
    return HUNGARIAN_ZIP_COORDS[zip];
  }

  // 3. Exact city match
  const c = (city || '').toLowerCase().trim();
  if (c && HUNGARY_CITIES_COORDS[c]) {
    return HUNGARY_CITIES_COORDS[c];
  }

  // 4. Split city (e.g. "Kecskemét - Lakitelek" or "Budapest, Üllő")
  if (c) {
    const parts = c.split(/[,-\/]/).map((p) => p.trim());
    for (const part of parts) {
      if (part && HUNGARY_CITIES_COORDS[part]) {
        return HUNGARY_CITIES_COORDS[part];
      }
    }
  }

  // 5. Substring match for city
  if (c) {
    for (const [k, coords] of Object.entries(HUNGARY_CITIES_COORDS)) {
      if (k.length >= 4 && c.includes(k)) return coords;
    }
  }

  // 6. Substring match for shelterName
  const s = (shelterName || '').toLowerCase();
  if (s) {
    for (const [k, coords] of Object.entries(HUNGARY_CITIES_COORDS)) {
      if (k.length >= 4 && s.includes(k)) return coords;
    }
  }

  // 7. Postal code first digit regional fallback
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

  // 8. County match
  const co = (county || '').toLowerCase().trim();
  for (const [k, coords] of Object.entries(COUNTY_COORDS)) {
    if (co && co.includes(k)) return coords;
  }

  return [47.4979, 19.0402];
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
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

