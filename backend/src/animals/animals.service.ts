import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { DB, TraitScores } from '../db/types.js';
import {
  DbModule,
  KYSELY_DB,
  loadDropdownsFromFile,
} from '../db/db.module.js';
import {
  HUNGARY_CITIES_COORDS,
  haversineDistanceKm,
  resolveHungarianCoords,
} from '../db/hu-locations.js';

export interface AnimalFilterQuery {
  species?: string;
  breed?: string;
  fromyear?: number;
  toyear?: number;
  gender?: string;
  peopleok?: string;
  size?: string;
  kidsok?: string;
  housebroken?: string;
  malesok?: string;
  keepin?: string;
  femalesok?: string;
  spayed?: string;
  shelter_id?: string;
  city?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  max_distance_km?: number;
  playfulness?: number;
  activity?: number;
  trainability?: number;
  temperament?: number;
  min_match_percent?: number;
  strict?: string;
}

@Injectable()
export class AnimalsService {
  private memoryAnimals: any[] = [];
  private memorySwipes = new Map<
    string,
    Map<string, { direction: string; match_percent: number; created_at: Date }>
  >();
  private dropdownsCache: any = null;

  constructor(@Inject(KYSELY_DB) private readonly db: Kysely<DB>) {
    this.dropdownsCache = loadDropdownsFromFile();
  }

  getDropdownOptions() {
    if (!this.dropdownsCache || Object.keys(this.dropdownsCache).length === 0) {
      this.dropdownsCache = loadDropdownsFromFile();
    }
    const cities = Object.keys(HUNGARY_CITIES_COORDS)
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .sort((a, b) => a.localeCompare(b, 'hu'));

    return {
      ...this.dropdownsCache,
      cities,
    };
  }

  public static readonly MAX_PLAUSIBLE_DOG_AGE_YEARS = 29.5; // Bluey (29 év 5 hónap)
  public static readonly MAX_PLAUSIBLE_CAT_AGE_YEARS = 38.0; // Creme Puff (38 év 3 nap)

  /**
   * Stale listing exclusion based on verified lifespans:
   * - Dogs (kutyák): up to 29.5 years (Bluey: 29y 5m)
   * - Cats (macskák): up to 38 years (Creme Puff: 38y 3d)
   */
  private isLikelyStaleListing(a: { species?: string; age_years?: number; waiting_days?: number }) {
    const isCat = a.species === 'macska';
    const maxAge = isCat
      ? AnimalsService.MAX_PLAUSIBLE_CAT_AGE_YEARS
      : AnimalsService.MAX_PLAUSIBLE_DOG_AGE_YEARS;
    const maxWaitingDays = (isCat ? 38 : 29.5) * 365;

    if (Number(a.age_years ?? 0) > maxAge) return true;
    if (Number(a.waiting_days ?? 0) > maxWaitingDays) return true;
    return false;
  }

  private getAnimalAdmissionTimestamp(item: any): number {
    if (!item) return 0;
    const raw =
      item.admission_date ||
      item.program_date ||
      (item.waiting_since && item.waiting_since !== 'Ismeretlen' ? item.waiting_since : '') ||
      '';

    if (raw) {
      const clean = String(raw).trim();
      const direct = new Date(clean).getTime();
      if (!isNaN(direct) && direct > 0) return direct;
      const normalized = clean.replace(/\.\s*/g, '-').replace(/-$/, '');
      const parsedNorm = new Date(normalized).getTime();
      if (!isNaN(parsedNorm) && parsedNorm > 0) return parsedNorm;
    }

    if (typeof item.waiting_days === 'number' && item.waiting_days > 0) {
      return Date.now() - item.waiting_days * 86400000;
    }

    return 0;
  }

  private computeWaitingInfo(admissionDate?: string, programDate?: string) {
    const rawDate = admissionDate || programDate || '';
    const parsed = rawDate ? new Date(rawDate) : null;
    const now = new Date();
    let days = 30;
    if (parsed && !isNaN(parsed.getTime())) {
      const diffMs = now.getTime() - parsed.getTime();
      days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    let label = `${days} napja`;
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remMonths = Math.floor((days % 365) / 30);
      label =
        remMonths > 0
          ? `${years} éve és ${remMonths} hónapja`
          : `${years} éve`;
    } else if (days >= 60) {
      const months = Math.floor(days / 30);
      label = `${months} hónapja`;
    }

    let urgency: 'new' | 'medium' | 'long' | 'critical' = 'new';
    if (days >= 365) urgency = 'critical';
    else if (days >= 180) urgency = 'long';
    else if (days >= 45) urgency = 'medium';

    // Gauge percentage (0 to 100%, where 365+ days is 95-100%)
    const gaugePercent = Math.min(100, Math.max(8, Math.round((days / 365) * 100)));

    return {
      waiting_days: days,
      waiting_since: rawDate || 'Ismeretlen',
      waiting_label: label,
      waiting_urgency: urgency,
      waiting_gauge_percent: gaugePercent,
    };
  }

  private enrichAndScoreAnimal(
    raw: any,
    query: AnimalFilterQuery,
    userLat: number,
    userLng: number,
  ) {
    const imageLinks: string[] =
      typeof raw.image_links === 'string'
        ? JSON.parse(raw.image_links)
        : raw.image_links || raw.images || [];

    let shelterLat = Number(raw.lat || 47.4979);
    let shelterLng = Number(raw.lng || 19.0402);
    if (
      shelterLat === 47.4979 &&
      shelterLng === 19.0402 &&
      (raw.shelter_postal_code || raw.shelter_address || raw.shelter_city)
    ) {
      const [sLat, sLng] = resolveHungarianCoords(
        raw.shelter_city,
        raw.shelter_county,
        raw.shelter_name,
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

    const waiting = this.computeWaitingInfo(raw.admission_date, raw.program_date);

    // 1. HARD CRITERIA FILTERING (Categorical exclusions)
    let isMatched = true;

    // Species (hard filter: if user wants dogs, only dogs; if cats, only cats)
    if (query.species && query.species !== 'mindegy' && query.species !== 'Any') {
      if (raw.species !== query.species) isMatched = false;
    }

    // Shelter (hard filter: when a specific shelter is chosen)
    if (isMatched && query.shelter_id && query.shelter_id !== 'Any') {
      if (String(raw.shelter_id) !== String(query.shelter_id)) isMatched = false;
    }

    // 2. MATCH PERCENTAGE CALCULATION (30% - 100%)
    let score = 100;

    // Gender (soft filter: if user specified a preferred gender)
    if (query.gender && query.gender !== 'Any') {
      if (raw.gender !== query.gender) {
        score -= 15;
      }
    }

    // Size (soft filter: if user specified a preferred size)
    if (query.size && query.size !== 'Any') {
      if (raw.size !== query.size) {
        const order: Record<string, number> = { Small: 1, Medium: 2, Large: 3 };
        const diff = Math.abs((order[raw.size] || 2) - (order[query.size] || 2));
        score -= diff === 1 ? 12 : 22;
      }
    }

    // Age range (soft filter: deviations outside preferred range lower the match)
    const fromYear = query.fromyear !== undefined ? Number(query.fromyear) : 0;
    const toYear = query.toyear !== undefined ? Number(query.toyear) : 40;
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
    if (query.breed && query.breed !== 'Any' && query.breed !== 'mindegy') {
      const b = (raw.breed || '').toLowerCase();
      const q = query.breed.toLowerCase();
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
      const wanted = (query as any)[t.key];
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
    if (query.keepin && query.keepin !== 'Any') {
      if (raw.keep_in === query.keepin || raw.keep_in === 'FlatAndGarden') {
        // match
      } else if (raw.keep_in === 'Any' || !raw.keep_in) {
        score -= 4;
      } else {
        score -= 15;
      }
    }

    // Max distance
    const maxDistance =
      query.max_distance_km !== undefined && Number(query.max_distance_km) > 0
        ? Number(query.max_distance_km)
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
    const minPercent = query.min_match_percent ? Number(query.min_match_percent) : 0;
    if (minPercent > 0 && matchPercent < minPercent) {
      isMatched = false;
    }

    // Factual shelter attribute badges only (no synthetic personality categories)
    const traitBadges: Array<{ icon: string; label: string; color: string }> = [];
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
    const sizeText =
      raw.size === 'Small'
        ? 'Kisméretű'
        : raw.size === 'Large'
          ? 'Nagyméretű'
          : 'Közepes méretű';

    if (raw.keep_in === 'Flat') {
      matchReasons.push(`${sizeText}, lakásban tartásra javasolt`);
    } else if (raw.keep_in === 'FlatAndGarden') {
      matchReasons.push(`${sizeText}, lakásban és kertben is tartható`);
    } else {
      matchReasons.push(`${sizeText}, kertes házba javasolt`);
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
      adopted_at: raw.adopted_at ? new Date(raw.adopted_at).toISOString() : null,
      image_links: imageLinks,
      trait_badges: traitBadges.slice(0, 4),
      distance_km: distanceKm,
      match_percent: matchPercent,
      match_reasons: matchReasons.slice(0, 4),
      ...waiting,
      waiting_label: isAdopted ? 'Gazdira talált! 🏡' : waiting.waiting_label,
    };
  }

  async findAnimals(query: AnimalFilterQuery, userId?: string) {
    let rawAnimals: any[] = [];
    if (DbModule.isConnected) {
      rawAnimals = await this.db.selectFrom('animals').selectAll().execute();
    } else {
      rawAnimals = this.memoryAnimals;
    }

    let userLat = query.lat ? Number(query.lat) : undefined;
    let userLng = query.lng ? Number(query.lng) : undefined;
    if ((userLat === undefined || isNaN(userLat) || userLng === undefined || isNaN(userLng))) {
      const [cLat, cLng] = resolveHungarianCoords(
        query.city || 'Budapest',
        undefined,
        undefined,
        query.postal_code,
      );
      userLat = cLat;
      userLng = cLng;
    }

    const allEnriched = rawAnimals.map((a) =>
      this.enrichAndScoreAnimal(a, query, userLat!, userLng!),
    );

    // Adopted animals are NEVER shown in the Tinder swipe deck or recommendations,
    // only in the user's saved matches ("Kedvenceim") if they previously liked them.
    const adoptedItems = allEnriched.filter((a) => a.is_adopted);

    // Hard filters (species, breed, age, gender, size, shelter, max_distance, min_match_percent)
    // strictly exclude non-matching animals (is_matched === false).
    // Stale listings (20+ years old or waiting 20+ years) are also hidden.
    const filtered = allEnriched.filter(
      (a) => !a.is_adopted && !this.isLikelyStaleListing(a) && a.is_matched !== false,
    );

    // Sort by admission date descending (newest admitted pets first), then highest match percent
    filtered.sort((a, b) => {
      const timeA = this.getAnimalAdmissionTimestamp(a);
      const timeB = this.getAnimalAdmissionTimestamp(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (b.match_percent || 0) - (a.match_percent || 0);
    });

    // Attach user's existing swipes if authenticated
    let swipedMap: Record<string, string> = {};
    if (userId) {
      swipedMap = await this.getUserSwipeMap(userId);
    }

    return {
      total: filtered.length,
      user_coords: { lat: userLat, lng: userLng },
      swiped_map: swipedMap,
      items: filtered,
      adopted_items: adoptedItems,
    };
  }

  async getAnimalById(externalId: string, query: AnimalFilterQuery = {}) {
    let raw: any = null;
    if (DbModule.isConnected) {
      raw = await this.db
        .selectFrom('animals')
        .selectAll()
        .where('external_id', '=', String(externalId))
        .executeTakeFirst();
    } else {
      raw = this.memoryAnimals.find((a) => String(a.external_id) === String(externalId));
    }

    if (!raw) {
      throw new NotFoundException('Az állat adatlapja nem található (talán már örökbe fogadták!).');
    }

    const [uLat, uLng] = resolveHungarianCoords(query.city || 'Budapest');
    return this.enrichAndScoreAnimal(
      raw,
      query,
      query.lat ? Number(query.lat) : uLat,
      query.lng ? Number(query.lng) : uLng,
    );
  }

  async getUserSwipeMap(userId: string): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    if (DbModule.isConnected) {
      const rows = await this.db
        .selectFrom('user_swipes')
        .select(['animal_id', 'direction'])
        .where('user_id', '=', userId)
        .execute();
      for (const r of rows) {
        map[r.animal_id] = r.direction;
      }
    } else {
      const uMap = this.memorySwipes.get(userId);
      if (uMap) {
        for (const [aid, val] of uMap.entries()) {
          map[aid] = val.direction;
        }
      }
    }
    return map;
  }

  async recordSwipe(
    userId: string,
    animalId: string,
    direction: 'right' | 'left',
    matchPercent = 85,
  ) {
    if (DbModule.isConnected) {
      await this.db
        .insertInto('user_swipes')
        .values({
          user_id: userId,
          animal_id: String(animalId),
          direction,
          match_percent: Number(matchPercent || 85),
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'animal_id']).doUpdateSet({
            direction,
            match_percent: Number(matchPercent || 85),
            created_at: new Date(),
          }),
        )
        .execute();
    } else {
      if (!this.memorySwipes.has(userId)) {
        this.memorySwipes.set(userId, new Map());
      }
      this.memorySwipes.get(userId)!.set(String(animalId), {
        direction,
        match_percent: Number(matchPercent || 85),
        created_at: new Date(),
      });
    }

    return {
      success: true,
      animal_id: String(animalId),
      direction,
      is_match: direction === 'right',
    };
  }

  async getUserMatches(userId: string, query: AnimalFilterQuery = {}) {
    const [uLat, uLng] = resolveHungarianCoords(query.city || 'Budapest');
    const lat = query.lat ? Number(query.lat) : uLat;
    const lng = query.lng ? Number(query.lng) : uLng;

    if (DbModule.isConnected) {
      const swipes = await this.db
        .selectFrom('user_swipes')
        .innerJoin('animals', 'animals.external_id', 'user_swipes.animal_id')
        .selectAll('animals')
        .select([
          'user_swipes.match_percent as saved_match_percent',
          'user_swipes.created_at as matched_at',
        ])
        .where('user_swipes.user_id', '=', userId)
        .where('user_swipes.direction', '=', 'right')
        .orderBy('user_swipes.created_at', 'desc')
        .execute();

      return swipes.map((row) => {
        const enriched = this.enrichAndScoreAnimal(row, query, lat, lng);
        return {
          ...enriched,
          match_percent: row.saved_match_percent || enriched.match_percent,
          matched_at: row.matched_at,
        };
      });
    } else {
      const uMap = this.memorySwipes.get(userId);
      if (!uMap) return [];
      const results: any[] = [];
      for (const [aid, swipe] of uMap.entries()) {
        if (swipe.direction === 'right') {
          const raw = this.memoryAnimals.find((a) => String(a.external_id) === String(aid));
          if (raw) {
            const enriched = this.enrichAndScoreAnimal(raw, query, lat, lng);
            results.push({
              ...enriched,
              match_percent: swipe.match_percent || enriched.match_percent,
              matched_at: swipe.created_at,
            });
          }
        }
      }
      return results;
    }
  }

  async removeSwipe(userId: string, animalId: string) {
    if (DbModule.isConnected) {
      await this.db
        .deleteFrom('user_swipes')
        .where('user_id', '=', userId)
        .where('animal_id', '=', String(animalId))
        .execute();
    } else {
      this.memorySwipes.get(userId)?.delete(String(animalId));
    }
    return { success: true };
  }

  async resetLeftSwipes(userId: string) {
    if (DbModule.isConnected) {
      await this.db
        .deleteFrom('user_swipes')
        .where('user_id', '=', userId)
        .where('direction', '=', 'left')
        .execute();
    } else {
      const uMap = this.memorySwipes.get(userId);
      if (uMap) {
        for (const [aid, val] of uMap.entries()) {
          if (val.direction === 'left') uMap.delete(aid);
        }
      }
    }
    return { success: true };
  }
}

