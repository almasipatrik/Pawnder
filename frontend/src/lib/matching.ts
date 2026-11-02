import dropdownsData from './dropdowns.json';
import { haversineDistanceKm, resolveHungarianCoords } from './hu-locations';

export interface TraitScores {
  playfulness: number;
  activity: number;
  trainability: number;
  temperament: number;
}

export interface TraitBadge {
  icon: string;
  label: string;
  color: 'blue' | 'emerald' | 'purple' | 'rose' | 'amber' | 'indigo';
}

export interface AnimalRecord {
  external_id: string;
  species: 'kutya' | 'macska';
  shelter_animal_id: string;
  name: string;
  breed: string;
  gender: 'Male' | 'Female' | 'Any';
  gender_label: string;
  age_text: string;
  age_years: number;
  admission_date: string;
  program_date: string;
  available_from: string;
  spayed: string;
  kennel_number: string;
  size: 'Small' | 'Medium' | 'Large';
  size_label: string;
  coat_type: string;
  coat_color: string;
  people_ok: string;
  kids_ok: string;
  housebroken: string;
  males_ok: string;
  females_ok: string;
  other_species_ok: string;
  keep_in: string;
  keep_in_label: string;
  distinguishing_marks: string;
  admission_circumstances: string;
  description: string;
  original_owner_only: string;
  foreign_adoption: string;
  contact_hu: string;
  contact_de: string;
  contact_en: string;
  thumbnail_url: string;
  image_links: string[];
  source_url: string;
  shelter_id: string;
  shelter_name: string;
  shelter_type: string;
  shelter_county: string;
  shelter_city: string;
  shelter_address: string;
  shelter_postal_code: string;
  shelter_no_kill: string;
  shelter_tax_number: string;
  shelter_bank_account: string;
  shelter_website: string;
  shelter_adoption_conditions: string;
  lat: number;
  lng: number;
  trait_badges: TraitBadge[];
  distance_km: number;
  match_percent: number;
  match_reasons: string[];
  waiting_days: number;
  waiting_since: string;
  waiting_label: string;
  waiting_urgency: 'new' | 'medium' | 'long' | 'critical';
  waiting_gauge_percent: number;
  is_adopted?: boolean;
  is_matched?: boolean;
  adopted_at?: string | null;
}

export interface FilterState {
  species: 'kutya' | 'macska' | 'mindegy';
  breed: string;
  fromyear: number;
  toyear: number;
  gender: 'Any' | 'Male' | 'Female';
  peopleok: 'Any' | 'Yes' | 'No';
  size: 'Any' | 'Small' | 'Medium' | 'Large';
  kidsok: 'Any' | 'Yes' | 'No';
  housebroken: 'Any' | 'Yes' | 'No';
  malesok: 'Any' | 'Yes' | 'No';
  keepin: 'Any' | 'Flat' | 'Garden' | 'FlatAndGarden';
  femalesok: 'Any' | 'Yes' | 'No';
  spayed: 'Any' | 'Yes' | 'No';
  shelter_id: string;
  city: string;
  postal_code: string;
  lat?: number;
  lng?: number;
  max_distance_km: number;
  min_match_percent: number;
}

export const DEFAULT_FILTERS: FilterState = {
  species: 'mindegy',
  breed: 'Any',
  fromyear: 0,
  toyear: 40,
  gender: 'Any',
  peopleok: 'Any',
  size: 'Any',
  kidsok: 'Any',
  housebroken: 'Any',
  malesok: 'Any',
  keepin: 'Any',
  femalesok: 'Any',
  spayed: 'Any',
  shelter_id: 'Any',
  city: 'Dunaharaszti',
  postal_code: '2330',
  max_distance_km: 150,
  min_match_percent: 70,
};

export const DROPDOWNS = dropdownsData;

export function enrichAnimalClientSide(
  raw: any,
  filters: FilterState,
): AnimalRecord {
  let userLat = filters.lat;
  let userLng = filters.lng;
  if (userLat === undefined || userLng === undefined) {
    const [cLat, cLng] = resolveHungarianCoords(filters.city, filters.postal_code);
    userLat = cLat;
    userLng = cLng;
  }

  const imageLinks: string[] = raw.image_links || raw.images || [];
  let shelterLat = Number(raw.lat ?? 47.4979);
  let shelterLng = Number(raw.lng ?? 19.0402);
  if (
    shelterLat === 47.4979 &&
    shelterLng === 19.0402 &&
    (raw.shelter_postal_code || raw.shelter_address || raw.shelter_city)
  ) {
    const [sLat, sLng] = resolveHungarianCoords(
      raw.shelter_city,
      raw.shelter_postal_code,
      raw.shelter_address,
    );
    shelterLat = sLat;
    shelterLng = sLng;
  }

  const distanceKm = haversineDistanceKm(
    userLat,
    userLng,
    shelterLat,
    shelterLng,
  );

  // Waiting time calculation
  const rawDate = raw.admission_date || raw.program_date || '';
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const now = new Date();
  let days = 30;
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    days = Math.max(1, Math.floor((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  let waitingLabel = `${days} napja`;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remMonths = Math.floor((days % 365) / 30);
    waitingLabel =
      remMonths > 0
        ? `${years} éve és ${remMonths} hónapja`
        : `${years} éve`;
  } else if (days >= 60) {
    const months = Math.floor(days / 30);
    waitingLabel = `${months} hónapja`;
  }

  let urgency: 'new' | 'medium' | 'long' | 'critical' = 'new';
  if (days >= 365) urgency = 'critical';
  else if (days >= 180) urgency = 'long';
  else if (days >= 45) urgency = 'medium';

  const gaugePercent = Math.min(100, Math.max(8, Math.round((days / 365) * 100)));

  // 1. HARD CRITERIA FILTERING (Categorical exclusions)
  let isMatched = true;

  // Species (hard filter: if user wants dogs, only dogs; if cats, only cats)
  if (filters.species && filters.species !== 'mindegy') {
    if (raw.species !== filters.species) isMatched = false;
  }

  // Shelter (hard filter: when a specific shelter is chosen)
  if (isMatched && filters.shelter_id && filters.shelter_id !== 'Any') {
    if (String(raw.shelter_id) !== String(filters.shelter_id)) isMatched = false;
  }

  // 2. MATCH PERCENTAGE CALCULATION (30% - 100%)
  let score = 100;

  // Gender (soft filter: if user specified a preferred gender)
  if (filters.gender && filters.gender !== 'Any') {
    if (raw.gender !== filters.gender) {
      score -= 15;
    }
  }

  // Size (soft filter: if user specified a preferred size)
  if (filters.size && filters.size !== 'Any') {
    if (raw.size !== filters.size) {
      const order: Record<string, number> = { Small: 1, Medium: 2, Large: 3 };
      const diff = Math.abs((order[raw.size] || 2) - (order[filters.size] || 2));
      score -= diff === 1 ? 12 : 22;
    }
  }

  // Age range (soft filter: deviations outside preferred range lower the match)
  const fromYear = filters.fromyear !== undefined ? Number(filters.fromyear) : 0;
  const toYear = filters.toyear !== undefined ? Number(filters.toyear) : 40;
  const ageYears = Number(raw.age_years ?? 2);
  if (fromYear > 0 || toYear < 40) {
    if (ageYears < fromYear) {
      const diff = fromYear - ageYears;
      score -= Math.min(25, Math.round(diff * 5) + 6);
    } else if (ageYears > toYear) {
      const diff = ageYears - toYear;
      score -= Math.min(25, Math.round(diff * 4) + 6);
    }
  }

  // Breed (soft filter: preferred breed gets 100%, different breeds lower the score)
  if (filters.breed && filters.breed !== 'Any' && filters.breed !== 'mindegy') {
    const b = (raw.breed || '').toLowerCase();
    const q = filters.breed.toLowerCase();
    if (!b.includes(q)) {
      score -= 18;
    }
  }

  // Lifestyle preferences (people, kids, housebroken, males, females, spayed)
  const traitWeights = [
    { key: 'peopleok', rawKey: 'people_ok', weight: 16, unknownPenalty: 4 },
    { key: 'kidsok', rawKey: 'kids_ok', weight: 16, unknownPenalty: 5 },
    { key: 'housebroken', rawKey: 'housebroken', weight: 14, unknownPenalty: 4 },
    { key: 'malesok', rawKey: 'males_ok', weight: 10, unknownPenalty: 3 },
    { key: 'femalesok', rawKey: 'females_ok', weight: 10, unknownPenalty: 3 },
    { key: 'spayed', rawKey: 'spayed', weight: 10, unknownPenalty: 3 },
  ] as const;

  for (const t of traitWeights) {
    const wanted = (filters as any)[t.key];
    const actual = raw[t.rawKey];
    if (wanted && wanted !== 'Any') {
      if (actual === wanted) {
        // Full match
      } else if (actual === 'Any' || !actual) {
        score -= t.unknownPenalty;
      } else {
        score -= t.weight;
      }
    } else {
      // When user didn't specify preference, negative traits still slightly lower the general match
      if (actual === 'No') {
        score -= Math.round(t.weight * 0.45);
      } else if (actual === 'Any' || !actual) {
        score -= 2.5;
      }
    }
  }

  // Keep In
  if (filters.keepin && filters.keepin !== 'Any') {
    if (raw.keep_in === filters.keepin || raw.keep_in === 'FlatAndGarden') {
      // match
    } else if (raw.keep_in === 'Any' || !raw.keep_in) {
      score -= 4;
    } else {
      score -= 15;
    }
  }

  // Max distance
  const maxDistance =
    filters.max_distance_km !== undefined && Number(filters.max_distance_km) > 0
      ? Number(filters.max_distance_km)
      : 500;
  if (maxDistance < 500) {
    if (distanceKm > maxDistance) {
      const excess = distanceKm - maxDistance;
      if (excess > maxDistance * 0.5) {
        isMatched = false; // Hard cutoff beyond 1.5x max distance
      } else {
        score -= Math.min(25, Math.round((excess / maxDistance) * 25) + 10);
      }
    } else if (distanceKm > maxDistance * 0.5) {
      score -= Math.round(((distanceKm - maxDistance * 0.5) / (maxDistance * 0.5)) * 8);
    }
  }

  const matchPercent = Math.max(30, Math.min(100, Math.round(score)));

  // Minimum match percent cutoff:
  const minPercent = filters.min_match_percent ? Number(filters.min_match_percent) : 0;
  if (minPercent > 0 && matchPercent < minPercent) {
    isMatched = false;
  }

  const traitBadges: TraitBadge[] = [];
  if (raw.people_ok === 'Yes') {
    traitBadges.push({ icon: '🤝', label: 'Emberbarát', color: 'rose' });
  }
  if (raw.kids_ok === 'Yes') {
    traitBadges.push({ icon: '👶', label: 'Gyerekbarát', color: 'blue' });
  }
  if (raw.housebroken === 'Yes') {
    traitBadges.push({ icon: '🏠', label: 'Szobatiszta', color: 'amber' });
  }
  if (raw.spayed === 'Yes') {
    traitBadges.push({ icon: '✂️', label: 'Ivartalanított', color: 'purple' });
  }
  if (raw.keep_in === 'Flat') {
    traitBadges.push({ icon: '🏢', label: 'Lakásba', color: 'indigo' });
  } else if (raw.keep_in === 'Garden') {
    traitBadges.push({ icon: '🌳', label: 'Kertbe', color: 'emerald' });
  } else if (raw.keep_in === 'FlatAndGarden') {
    traitBadges.push({ icon: '🏡', label: 'Lakásba és kertbe', color: 'emerald' });
  }
  if (raw.other_species_ok === 'Yes') {
    traitBadges.push({
      icon: '🐾',
      label: raw.species === 'macska' ? 'Kutyabarát' : 'Cicabarát',
      color: 'blue',
    });
  }

  const matchReasons: string[] = [];
  const sizeLabelHu =
    raw.size === 'Small'
      ? 'Kisméretű'
      : raw.size === 'Large'
        ? 'Nagyméretű'
        : 'Közepes méretű';
  if (raw.keep_in === 'Flat') {
    matchReasons.push(`${sizeLabelHu}, lakásban tartásra javasolt`);
  } else if (raw.keep_in === 'FlatAndGarden') {
    matchReasons.push(`${sizeLabelHu}, lakásban és kertben is tartható`);
  } else {
    matchReasons.push(`${sizeLabelHu}, kertes házba javasolt`);
  }
  if (raw.housebroken === 'Yes') {
    matchReasons.push('Szobatiszta');
  }
  if (raw.people_ok === 'Yes' && raw.kids_ok === 'Yes') {
    matchReasons.push('Embereket és gyerekeket is szereti');
  } else if (raw.people_ok === 'Yes') {
    matchReasons.push('Embereket szereti');
  }
  if (raw.spayed === 'Yes') {
    matchReasons.push('Már ivartalanított');
  }

  matchReasons.push(
    `Menhely távolsága: ~${distanceKm} km (${raw.shelter_city || raw.shelter_county || 'Magyarország'})`,
  );

  const isAdopted = Boolean(raw.is_adopted);

  return {
    ...raw,
    is_adopted: isAdopted,
    is_matched: isMatched,
    adopted_at: raw.adopted_at || null,
    image_links: imageLinks,
    trait_badges: traitBadges.slice(0, 4),
    distance_km: distanceKm,
    match_percent: matchPercent,
    match_reasons: matchReasons.slice(0, 4),
    waiting_days: days,
    waiting_since: rawDate,
    waiting_label: isAdopted ? 'Gazdira talált! 🏡' : waitingLabel,
    waiting_urgency: urgency,
    waiting_gauge_percent: gaugePercent,
  };
}

