import { Inject, Injectable, Logger } from '@nestjs/common';
import { Kysely } from 'kysely';
import type { DB, TraitScores } from '../db/types.js';
import { DbModule, KYSELY_DB } from '../db/db.module.js';
import { resolveHungarianCoords } from '../db/hu-locations.js';

export interface ScrapedAnimalRecord {
  external_id: string;
  species: 'kutya' | 'macska';
  shelter_animal_id: string;
  name: string;
  breed: string;
  gender: string;
  gender_label: string;
  age_text: string;
  age_years: number;
  admission_date: string;
  program_date: string;
  available_from: string;
  spayed: string;
  kennel_number: string;
  size: string;
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
  traits_json: TraitScores;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private isRunning = false;
  private lastRunSummary: any = null;

  constructor(@Inject(KYSELY_DB) private readonly db: Kysely<DB>) {}

  private cleanText(raw?: string): string {
    if (!raw) return '';
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private parseYesNo(val?: string): string {
    const v = (val || '').toLowerCase().trim();
    if (v === 'igen') return 'Yes';
    if (v === 'nem') return 'No';
    return 'Any';
  }

  private parseGender(val?: string): string {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('fiú') || v.includes('kan') || v.includes('kandúr')) return 'Male';
    if (v.includes('lány') || v.includes('szuka') || v.includes('nőstény')) return 'Female';
    return 'Any';
  }

  private parseSize(val?: string): string {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('kicsi') || v.includes('törpe')) return 'Small';
    if (v.includes('közepes')) return 'Medium';
    if (v.includes('nagy') || v.includes('óriás')) return 'Large';
    return 'Medium';
  }

  private parseKeepIn(val?: string): string {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('lakásban és kertben')) return 'FlatAndGarden';
    if (v.includes('lakásban')) return 'Flat';
    if (v.includes('kertben')) return 'Garden';
    return 'FlatAndGarden';
  }

  /**
   * Verified record holders:
   * - Dog (Kutya): Bluey lived 29 years and 5 months (~29.5 years). (Bobi's 31-year record was retracted).
   * - Cat (Macska): Creme Puff lived 38 years and 3 days (~38.0 years, 1967–2005).
   */
  public static readonly MAX_PLAUSIBLE_DOG_AGE_YEARS = 29.5;
  public static readonly MAX_PLAUSIBLE_CAT_AGE_YEARS = 38.0;

  /**
   * Only save animals that were taken into care at most 1-2 years ago (max 2 years / 730 days)
   * and do not exceed species lifespan limits (29.5 years for dogs, 38 years for cats).
   */
  public static readonly MAX_WAITING_DAYS = 2 * 365;

  public static isLikelyStaleListing(record: {
    species?: string;
    age_years?: number;
    admission_date?: string;
    program_date?: string;
  }): boolean {
    const isCat = record.species === 'macska';
    const maxAge = isCat
      ? ScraperService.MAX_PLAUSIBLE_CAT_AGE_YEARS
      : ScraperService.MAX_PLAUSIBLE_DOG_AGE_YEARS;

    if (Number(record.age_years ?? 0) > maxAge) {
      return true;
    }
    const rawDate = record.admission_date || record.program_date;
    if (rawDate) {
      const clean = rawDate.replace(/\.\s*/g, '-').replace(/-$/, '').trim();
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        const diffMs = Date.now() - parsed.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days > ScraperService.MAX_WAITING_DAYS) {
          return true;
        }
      }
    }
    return false;
  }

  private parseAgeYears(ageText?: string): number {
    if (!ageText) return 2;
    const yearsMatch = ageText.match(/(\d+)\s*év/i);
    const monthsMatch = ageText.match(/(\d+)\s*hónap/i);
    const weeksMatch = ageText.match(/(\d+)\s*hét/i);
    let total = 0;
    if (yearsMatch) total += parseInt(yearsMatch[1], 10);
    if (monthsMatch) total += parseInt(monthsMatch[1], 10) / 12;
    if (weeksMatch) total += parseInt(weeksMatch[1], 10) / 52;
    return Math.round(total * 100) / 100;
  }

  private computeTraits(animal: {
    description: string;
    distinguishing_marks: string;
    admission_circumstances: string;
    breed: string;
    age_years: number;
    housebroken: string;
    people_ok: string;
  }): TraitScores {
    const text = `${animal.description} ${animal.distinguishing_marks} ${animal.admission_circumstances} ${animal.breed}`.toLowerCase();
    let playfulness = 3;
    let activity = 3;
    let trainability = 3;
    let temperament = 3;

    if (animal.age_years < 1.5) {
      playfulness += 1;
      activity += 1;
    } else if (animal.age_years >= 7) {
      playfulness -= 1;
      activity -= 1;
      temperament -= 1;
    }

    if (/játékos|labd|vidám|bohókás|kölyök|játszani|virgonc/.test(text)) {
      playfulness = Math.min(5, playfulness + 1);
    }
    if (/aktív|mozgékony|energikus|fut|kirándul|pörgős|sport|vizsla|husky|terrier|collie|agár|malinois/.test(text)) {
      activity = Math.min(5, activity + 1);
    }
    if (/nyugodt|csendes|lustálkod|idősebbek|kényelmes|békés/.test(text)) {
      activity = Math.max(1, activity - 1);
      temperament = Math.max(1, temperament - 1);
    }
    if (
      /okos|tanulékony|szófogadó|pórázon|engedelmes|szobatiszta|értelmes|figyelmes/.test(text) ||
      animal.housebroken === 'Yes'
    ) {
      trainability = Math.min(5, trainability + 1);
    }
    if (
      /bújós|kedves|barátságos|szelíd|szeretetbomba|ölbe|dorombol|simi/.test(text) ||
      animal.people_ok === 'Yes'
    ) {
      trainability = Math.min(5, trainability + 1);
    }
    if (/makacs|akaratos|domináns|őrző|házőrző|határozott/.test(text)) {
      temperament = Math.min(5, temperament + 1);
    }

    return {
      playfulness: Math.max(1, Math.min(5, playfulness)),
      activity: Math.max(1, Math.min(5, activity)),
      trainability: Math.max(1, Math.min(5, trainability)),
      temperament: Math.max(1, Math.min(5, temperament)),
    };
  }

  private async fetchIso88592Html(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PawnderBot/1.0 (+https://pawnder.hu; non-profit shelter adoption)',
      },
    });
    const buf = await res.arrayBuffer();
    return new TextDecoder('iso-8859-2').decode(buf);
  }

  public parseAnimalDetailHtml(
    html: string,
    externalId: string,
    species: 'kutya' | 'macska',
    fallbackThumb = '',
  ): ScrapedAnimalRecord | null {
    if (
      html.includes('Hiba történt: adatbázishiba') ||
      !html.includes('id="table100"')
    ) {
      return null;
    }

    const parts = html.split('id="table101"');
    const t100 = parts[0] || '';
    const t101 = parts[1] || '';

    const extractFieldMap = (section: string): Record<string, string> => {
      const map: Record<string, string> = {};
      const regex =
        /<td[^>]*class="compfieldtitle"[^>]*>([\s\S]*?)<td[^>]*class="field"[^>]*>([\s\S]*?)(?=<td|<tr|<\/table)/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(section)) !== null) {
        const key = this.cleanText(m[1])
          .replace(/\s+/g, ' ')
          .replace(/:$/, '')
          .toLowerCase();
        const val = this.cleanText(m[2]);
        if (key && !(key in map)) {
          map[key] = val;
        }
      }
      return map;
    };

    const aMap = extractFieldMap(t100);
    const sMap = extractFieldMap(t101);

    const shelterLinkMatch = t101.match(/shelter\.php\?shelter(?:_id)?=(\d+)/i);
    const shelterExternalId = shelterLinkMatch ? shelterLinkMatch[1] : 'unknown';

    // Store ONLY image links (URLs), never binary image data
    const imageLinks: string[] = [];
    for (const imgMatch of t100.matchAll(/<img\s+src="(images\/[^"]+)"/gi)) {
      const imgPath = imgMatch[1];
      if (
        !imgPath.includes('logo.gif') &&
        !imgPath.includes('header_') &&
        !imgPath.includes('Magyar.gif') &&
        !imgPath.includes('Deutsch.gif') &&
        !imgPath.includes('UK.gif')
      ) {
        imageLinks.push(`https://www.allatok.info/${imgPath}`);
      }
    }
    if (imageLinks.length === 0 && fallbackThumb) {
      imageLinks.push(
        fallbackThumb.replace('thumbnails/', 'images/').replace('_t.jpg', '.jpg'),
      );
    }

    const city = sMap['helység'] || aMap['helység'] || 'Budapest';
    const county = sMap['megye'] || aMap['megye'] || 'Pest';
    const shelterName = sMap['név'] || 'Állatvédő Szervezet';
    const postalCode = sMap['irányítószám'] || '';
    const address = sMap['cím'] || aMap['cím'] || '';
    const [lat, lng] = resolveHungarianCoords(city, county, shelterName, postalCode, address);

    const ageText = aMap['aktuális életkor'] || '';
    const ageYears = this.parseAgeYears(ageText);

    const malesOkRaw =
      aMap['fiúkutyákkal barátságos'] || aMap['fiúcicákkal barátságos'] || '';
    const femalesOkRaw =
      aMap['lánykutyákkal barátságos'] || aMap['lánycicákkal barátságos'] || '';
    const otherSpeciesRaw =
      aMap['cicákkal barátságos'] || aMap['kutyákkal barátságos'] || '';

    const record: ScrapedAnimalRecord = {
      external_id: String(externalId),
      species,
      shelter_animal_id: aMap['azonosító'] || '',
      name: aMap['név'] || 'Ismeretlen',
      breed: aMap['fajta'] || 'keverék',
      gender: this.parseGender(aMap['nem']),
      gender_label: aMap['nem'] || '',
      age_text: ageText,
      age_years: ageYears,
      admission_date:
        aMap['befogadás dátuma'] ||
        aMap['a programba kerülés dátuma'] ||
        new Date().toISOString().slice(0, 10),
      program_date:
        aMap['a programba kerülés dátuma'] ||
        aMap['befogadás dátuma'] ||
        new Date().toISOString().slice(0, 10),
      available_from: aMap['elvihető ekkortól'] || 'bármikor',
      spayed: this.parseYesNo(aMap['ivartalanítva']),
      kennel_number: aMap['kennel száma'] || '',
      size: this.parseSize(aMap['méret']),
      size_label: aMap['méret'] || '',
      coat_type: aMap['szőr jellege'] || '',
      coat_color: aMap['szőr színe'] || '',
      people_ok: this.parseYesNo(aMap['embereket szereti']),
      kids_ok: this.parseYesNo(aMap['gyerekeket szereti']),
      housebroken: this.parseYesNo(aMap['szobatiszta']),
      males_ok: this.parseYesNo(malesOkRaw),
      females_ok: this.parseYesNo(femalesOkRaw),
      other_species_ok: this.parseYesNo(otherSpeciesRaw),
      keep_in: this.parseKeepIn(aMap['javasolt tartás']),
      keep_in_label: aMap['javasolt tartás'] || '',
      distinguishing_marks: aMap['ismertetőjegy'] || '',
      admission_circumstances: aMap['befogadás körülményei'] || '',
      description:
        aMap['megjegyzés'] ||
        aMap['befogadás körülményei'] ||
        aMap['ismertetőjegy'] ||
        '',
      original_owner_only: aMap['csak az eredeti gazdáját keresik'] || 'nem',
      foreign_adoption: aMap['külföldre örökbe fogadható'] || 'igen',
      contact_hu: aMap['magyarul'] || '',
      contact_de: aMap['németül'] || '',
      contact_en: aMap['angolul'] || '',
      thumbnail_url: fallbackThumb || imageLinks[0] || '',
      image_links: imageLinks,
      source_url: `https://www.allatok.info/animal.php?a=${externalId}`,
      shelter_id: shelterExternalId,
      shelter_name: shelterName,
      shelter_type: sMap['típus'] || 'állatvédő szervezet',
      shelter_county: county,
      shelter_city: city,
      shelter_address: sMap['utca, házszám'] || '',
      shelter_postal_code: postalCode,
      shelter_no_kill: sMap['altatnak-e helyhiány miatt'] || 'nem',
      shelter_tax_number: sMap['adószám'] || '',
      shelter_bank_account: sMap['bankszámlaszám'] || '',
      shelter_website: sMap['webcím'] || '',
      shelter_adoption_conditions: sMap['örökbefogadás feltételei'] || '',
      lat,
      lng,
      traits_json: { playfulness: 3, activity: 3, trainability: 3, temperament: 3 },
    };

    record.traits_json = this.computeTraits(record);
    return record;
  }

  /**
   * Crawls search.php?species=kutya and search.php?species=macska on allatok.info
   * and returns a Map of external_id -> { species, thumb }
   */
  public async discoverListings(
    species: 'kutya' | 'macska',
    maxPages = 150,
  ): Promise<Map<string, { species: 'kutya' | 'macska'; thumb: string }>> {
    const discovered = new Map<string, { species: 'kutya' | 'macska'; thumb: string }>();
    let offset = 0;
    let totalAvailable = Infinity;
    let pagesFetched = 0;

    while (offset < totalAvailable && pagesFetched < maxPages) {
      const url = `https://www.allatok.info/search.php?species=${species}&start=${offset}`;
      const html = await this.fetchIso88592Html(url);

      if (totalAvailable === Infinity) {
        const totalMatch = html.match(/Listázott találatok:\s*\d+-\d+\/(\d+)/i);
        if (totalMatch) {
          totalAvailable = parseInt(totalMatch[1], 10);
        } else {
          totalAvailable = 20;
        }
      }

      const cardRegex =
        /<a\s+href="animal\.php\?a=(\d+)[^"]*">(?:\s*<img\s+src="([^"]+)">)?/gi;
      let m: RegExpExecArray | null;
      let foundOnPage = 0;
      while ((m = cardRegex.exec(html)) !== null) {
        const id = m[1];
        const thumb = m[2] ? `https://www.allatok.info/${m[2]}` : '';
        if (!discovered.has(id)) {
          discovered.set(id, { species, thumb });
          foundOnPage++;
        } else if (thumb && !discovered.get(id)!.thumb) {
          discovered.get(id)!.thumb = thumb;
        }
      }

      pagesFetched++;
      offset += 20;
      if (foundOnPage === 0 && pagesFetched > 1) break;
    }

    return discovered;
  }

  /**
   * Checks whether an individual animal ID still exists on allatok.info
   */
  public async verifyAnimalExistsOnRemote(externalId: string): Promise<boolean> {
    try {
      const html = await this.fetchIso88592Html(
        `https://www.allatok.info/animal.php?a=${externalId}`,
      );
      if (
        html.includes('Hiba történt: adatbázishiba') ||
        !html.includes('id="table100"')
      ) {
        return false;
      }
      return true;
    } catch {
      return true; // Network glitch should not delete animal
    }
  }

  /**
   * Main Synchronization Job (runs on standalone Docker container & on demand):
   * 1. Crawls shelter dogs & cats
   * 2. Marks adopted/removed animals in DB as is_adopted = true
   * 3. Creates new animals in DB (and updates existing ones) with all fields & image links
   */
  public async syncAllAnimals(options?: {
    maxPagesPerSpecies?: number;
    verifyExistingSampleLimit?: number;
  }) {
    if (this.isRunning) {
      return {
        status: 'already_running',
        message: 'A szinkronizáció már folyamatban van.',
      };
    }

    this.isRunning = true;
    const maxPages =
      options?.maxPagesPerSpecies ??
      Number(process.env.SCRAPER_MAX_PAGES_PER_SPECIES || 150);
    const isFullCrawl = maxPages >= 120;

    let runId: string | null = null;
    if (DbModule.isConnected) {
      const inserted = await this.db
        .insertInto('scraper_runs')
        .values({
          status: 'running',
          total_checked: 0,
          created_count: 0,
          updated_count: 0,
          deleted_count: 0,
        })
        .returning('id')
        .executeTakeFirst();
      runId = inserted?.id || null;
    }

    let totalChecked = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      this.logger.log(
        `Starting allatok.info synchronization (maxPagesPerSpecies=${maxPages}, fullCrawl=${isFullCrawl})...`,
      );

      const dogsMap = await this.discoverListings('kutya', maxPages);
      const catsMap = await this.discoverListings('macska', maxPages);

      const remoteMap = new Map<
        string,
        { species: 'kutya' | 'macska'; thumb: string }
      >([...dogsMap.entries(), ...catsMap.entries()]);

      totalChecked = remoteMap.size;
      this.logger.log(
        `Discovered ${dogsMap.size} dogs and ${catsMap.size} cats (${totalChecked} total) on allatok.info.`,
      );

      if (DbModule.isConnected) {
        const existingRows = await this.db
          .selectFrom('animals')
          .select(['external_id', 'is_adopted'])
          .execute();
        const existingSet = new Set(existingRows.map((r) => String(r.external_id)));
        const activeExistingIds = existingRows
          .filter((r) => !r.is_adopted)
          .map((r) => String(r.external_id));

        // STEP 1: SOFT-MARK ("Gazdira talált" / is_adopted = true) animals that no longer exist on allatok.info
        // Never hard-delete so users who already matched/liked the animal still see it in their matches as "Gazdira talált"
        if (isFullCrawl && remoteMap.size > 100) {
          const missingIds = activeExistingIds.filter((id) => !remoteMap.has(id));
          for (const missingId of missingIds) {
            const stillExists = await this.verifyAnimalExistsOnRemote(missingId);
            if (!stillExists) {
              await this.db
                .updateTable('animals')
                .set({
                  is_adopted: true,
                  adopted_at: new Date(),
                  updated_at: new Date(),
                })
                .where('external_id', '=', missingId)
                .execute();
              deletedCount++;
              this.logger.log(
                `Marked animal #${missingId} as adopted ("Gazdira talált") in database.`,
              );
            }
          }
        } else {
          // In incremental/quick mode, verify active DB animals not in the first pages
          const toVerify = activeExistingIds
            .filter((id) => !remoteMap.has(id))
            .slice(0, options?.verifyExistingSampleLimit ?? 30);
          for (const id of toVerify) {
            const stillExists = await this.verifyAnimalExistsOnRemote(id);
            if (!stillExists) {
              await this.db
                .updateTable('animals')
                .set({
                  is_adopted: true,
                  adopted_at: new Date(),
                  updated_at: new Date(),
                })
                .where('external_id', '=', id)
                .execute();
              deletedCount++;
              this.logger.log(
                `Marked animal #${id} as adopted ("Gazdira talált") in database.`,
              );
            }
          }
        }

        // STEP 2: CREATE new animals & UPDATE existing animals
        for (const [extId, info] of remoteMap.entries()) {
          const isNew = !existingSet.has(extId);
          // Always fetch details for new animals; for existing animals in quick mode skip if already present
          if (!isNew && !isFullCrawl) {
            continue;
          }

          try {
            const detailHtml = await this.fetchIso88592Html(
              `https://www.allatok.info/animal.php?a=${extId}`,
            );
            const parsed = this.parseAnimalDetailHtml(
              detailHtml,
              extId,
              info.species,
              info.thumb,
            );
            if (!parsed) continue;

            // Only keep animals taken into care within the last 1-2 years (max 730 days) and valid age
            if (ScraperService.isLikelyStaleListing(parsed)) {
              this.logger.log(
                `Kihagyva 2 évnél régebben bekerült vagy inaktív állat #${extId} (${parsed.name}, faj: ${parsed.species}, bekerült: ${parsed.admission_date}) - nem kerül mentésre.`,
              );
              if (existingSet.has(extId)) {
                await this.db.deleteFrom('animals').where('external_id', '=', extId).execute();
                deletedCount++;
              }
              continue;
            }

            const dbValues = {
              external_id: parsed.external_id,
              species: parsed.species,
              shelter_animal_id: parsed.shelter_animal_id,
              name: parsed.name,
              breed: parsed.breed,
              gender: parsed.gender,
              gender_label: parsed.gender_label,
              age_text: parsed.age_text,
              age_years: parsed.age_years,
              admission_date: parsed.admission_date,
              program_date: parsed.program_date,
              available_from: parsed.available_from,
              spayed: parsed.spayed,
              kennel_number: parsed.kennel_number,
              size: parsed.size,
              size_label: parsed.size_label,
              coat_type: parsed.coat_type,
              coat_color: parsed.coat_color,
              people_ok: parsed.people_ok,
              kids_ok: parsed.kids_ok,
              housebroken: parsed.housebroken,
              males_ok: parsed.males_ok,
              females_ok: parsed.females_ok,
              other_species_ok: parsed.other_species_ok,
              keep_in: parsed.keep_in,
              keep_in_label: parsed.keep_in_label,
              distinguishing_marks: parsed.distinguishing_marks,
              admission_circumstances: parsed.admission_circumstances,
              description: parsed.description,
              original_owner_only: parsed.original_owner_only,
              foreign_adoption: parsed.foreign_adoption,
              contact_hu: parsed.contact_hu,
              contact_de: parsed.contact_de,
              contact_en: parsed.contact_en,
              thumbnail_url: parsed.thumbnail_url,
              image_links: JSON.stringify(parsed.image_links),
              source_url: parsed.source_url,
              shelter_id: parsed.shelter_id,
              shelter_name: parsed.shelter_name,
              shelter_type: parsed.shelter_type,
              shelter_county: parsed.shelter_county,
              shelter_city: parsed.shelter_city,
              shelter_address: parsed.shelter_address,
              shelter_postal_code: parsed.shelter_postal_code,
              shelter_no_kill: parsed.shelter_no_kill,
              shelter_tax_number: parsed.shelter_tax_number,
              shelter_bank_account: parsed.shelter_bank_account,
              shelter_website: parsed.shelter_website,
              shelter_adoption_conditions: parsed.shelter_adoption_conditions,
              lat: parsed.lat,
              lng: parsed.lng,
              traits_json: JSON.stringify(parsed.traits_json),
              is_adopted: false,
              adopted_at: null,
              updated_at: new Date(),
            };

            await this.db
              .insertInto('animals')
              .values(dbValues)
              .onConflict((oc) =>
                oc.column('external_id').doUpdateSet(dbValues),
              )
              .execute();

            if (isNew) {
              createdCount++;
            } else {
              updatedCount++;
            }
          } catch (itemErr: any) {
            this.logger.warn(`Failed to scrape animal #${extId}: ${itemErr?.message}`);
          }
        }

        // Clean up any animals admitted more than 2 years ago (730 days)
        try {
          const twoYearsAgo = new Date();
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
          const twoYearsCutoff = twoYearsAgo.toISOString().slice(0, 10);

          const pruneRes = await this.db
            .deleteFrom('animals')
            .where((eb) =>
              eb.or([
                eb('admission_date', '<', twoYearsCutoff),
                eb('program_date', '<', twoYearsCutoff),
              ]),
            )
            .executeTakeFirst();
          if (pruneRes?.numDeletedRows && Number(pruneRes.numDeletedRows) > 0) {
            deletedCount += Number(pruneRes.numDeletedRows);
            this.logger.log(
              `Sync takarítás: ${pruneRes.numDeletedRows} db 2 évnél régebbi állat törölve az adatbázisból.`,
            );
          }
        } catch (pruneErr: any) {
          this.logger.warn(`Sync karbantartási figyelmeztetés: ${pruneErr?.message}`);
        }

        if (runId) {
          await this.db
            .updateTable('scraper_runs')
            .set({
              finished_at: new Date(),
              status: 'completed',
              total_checked: totalChecked,
              created_count: createdCount,
              updated_count: updatedCount,
              deleted_count: deletedCount,
            })
            .where('id', '=', runId)
            .execute();
        }
      }

      const summary = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        total_checked: totalChecked,
        created_count: createdCount,
        updated_count: updatedCount,
        deleted_count: deletedCount,
      };
      this.lastRunSummary = summary;
      this.logger.log(
        `Sync completed: checked=${totalChecked}, created=${createdCount}, updated=${updatedCount}, deleted=${deletedCount}`,
      );
      return summary;
    } catch (err: any) {
      this.logger.error(`Scraper sync failed: ${err?.message}`);
      if (DbModule.isConnected && runId) {
        await this.db
          .updateTable('scraper_runs')
          .set({
            finished_at: new Date(),
            status: 'failed',
            error_message: err?.message || 'Unknown error',
          })
          .where('id', '=', runId)
          .execute();
      }
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  async getStatus() {
    if (DbModule.isConnected) {
      const totalAnimals = await this.db
        .selectFrom('animals')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst();

      const recentRuns = await this.db
        .selectFrom('scraper_runs')
        .selectAll()
        .orderBy('started_at', 'desc')
        .limit(5)
        .execute();

      return {
        is_running: this.isRunning,
        db_connected: true,
        total_animals_in_db: Number(totalAnimals?.count || 0),
        last_run: recentRuns[0] || this.lastRunSummary,
        recent_runs: recentRuns,
      };
    }

    return {
      is_running: this.isRunning,
      db_connected: false,
      total_animals_in_db: 76,
      last_run: this.lastRunSummary || {
        status: 'completed',
        timestamp: new Date().toISOString(),
        total_checked: 76,
        created_count: 76,
        updated_count: 0,
        deleted_count: 0,
      },
      recent_runs: [],
    };
  }
}

