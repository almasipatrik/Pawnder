import { Global, Inject, Module, OnModuleInit, Logger } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const KYSELY_DB = 'KYSELY_DB';

export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT DEFAULT 'Budapest',
    "postal_code" TEXT DEFAULT '1051',
    "lat" DOUBLE PRECISION DEFAULT 47.4979,
    "lng" DOUBLE PRECISION DEFAULT 19.0402,
    "max_distance_km" INTEGER NOT NULL DEFAULT 100,
    "preferences_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "otp_codes_email_idx" ON "otp_codes"("email");

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "refresh_tokens_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE TABLE IF NOT EXISTS "animals" (
    "external_id" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "shelter_animal_id" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL DEFAULT 'keverék',
    "gender" TEXT NOT NULL DEFAULT 'Any',
    "gender_label" TEXT NOT NULL DEFAULT '',
    "age_text" TEXT NOT NULL DEFAULT '',
    "age_years" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "admission_date" TEXT NOT NULL DEFAULT '',
    "program_date" TEXT NOT NULL DEFAULT '',
    "available_from" TEXT NOT NULL DEFAULT 'bármikor',
    "spayed" TEXT NOT NULL DEFAULT 'Any',
    "kennel_number" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT 'Medium',
    "size_label" TEXT NOT NULL DEFAULT '',
    "coat_type" TEXT NOT NULL DEFAULT '',
    "coat_color" TEXT NOT NULL DEFAULT '',
    "people_ok" TEXT NOT NULL DEFAULT 'Any',
    "kids_ok" TEXT NOT NULL DEFAULT 'Any',
    "housebroken" TEXT NOT NULL DEFAULT 'Any',
    "males_ok" TEXT NOT NULL DEFAULT 'Any',
    "females_ok" TEXT NOT NULL DEFAULT 'Any',
    "other_species_ok" TEXT NOT NULL DEFAULT 'Any',
    "keep_in" TEXT NOT NULL DEFAULT 'FlatAndGarden',
    "keep_in_label" TEXT NOT NULL DEFAULT '',
    "distinguishing_marks" TEXT NOT NULL DEFAULT '',
    "admission_circumstances" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "original_owner_only" TEXT NOT NULL DEFAULT 'nem',
    "foreign_adoption" TEXT NOT NULL DEFAULT 'igen',
    "contact_hu" TEXT NOT NULL DEFAULT '',
    "contact_de" TEXT NOT NULL DEFAULT '',
    "contact_en" TEXT NOT NULL DEFAULT '',
    "thumbnail_url" TEXT NOT NULL DEFAULT '',
    "image_links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "source_url" TEXT NOT NULL DEFAULT '',
    "shelter_id" TEXT NOT NULL DEFAULT '',
    "shelter_name" TEXT NOT NULL DEFAULT '',
    "shelter_type" TEXT NOT NULL DEFAULT '',
    "shelter_county" TEXT NOT NULL DEFAULT '',
    "shelter_city" TEXT NOT NULL DEFAULT '',
    "shelter_address" TEXT NOT NULL DEFAULT '',
    "shelter_postal_code" TEXT NOT NULL DEFAULT '',
    "shelter_no_kill" TEXT NOT NULL DEFAULT 'nem',
    "shelter_tax_number" TEXT NOT NULL DEFAULT '',
    "shelter_bank_account" TEXT NOT NULL DEFAULT '',
    "shelter_website" TEXT NOT NULL DEFAULT '',
    "shelter_adoption_conditions" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL DEFAULT 47.4979,
    "lng" DOUBLE PRECISION NOT NULL DEFAULT 19.0402,
    "traits_json" JSONB NOT NULL DEFAULT '{"playfulness":3,"activity":3,"trainability":3,"temperament":3}'::jsonb,
    "is_adopted" BOOLEAN NOT NULL DEFAULT false,
    "adopted_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "animals_pkey" PRIMARY KEY ("external_id")
);
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "is_adopted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "adopted_at" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "animals_species_idx" ON "animals"("species");
CREATE INDEX IF NOT EXISTS "animals_shelter_id_idx" ON "animals"("shelter_id");
CREATE INDEX IF NOT EXISTS "animals_size_idx" ON "animals"("size");
CREATE INDEX IF NOT EXISTS "animals_gender_idx" ON "animals"("gender");
CREATE INDEX IF NOT EXISTS "animals_is_adopted_idx" ON "animals"("is_adopted");

CREATE TABLE IF NOT EXISTS "user_swipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "animal_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "match_percent" INTEGER NOT NULL DEFAULT 85,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_swipes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_swipes_user_animal_unique" UNIQUE ("user_id", "animal_id"),
    CONSTRAINT "user_swipes_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "user_swipes_animal_fk" FOREIGN KEY ("animal_id") REFERENCES "animals"("external_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "user_swipes_user_id_idx" ON "user_swipes"("user_id");

CREATE TABLE IF NOT EXISTS "scraper_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finished_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'running',
    "total_checked" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    CONSTRAINT "scraper_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_name" TEXT NOT NULL,
    "properties" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
`;

export function createKyselyInstance(): Kysely<DB> {
  let connectionString =
    process.env.DATABASE_URL ||
    'postgres://pawnder_user:pawnder_password@localhost:5432/pawnder_db';

  const sslDisabled =
    process.env.DATABASE_SSL === 'false' ||
    process.env.DB_SSL === 'false';

  const isLocalhostOrDocker =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('host.docker.internal') ||
    connectionString.includes('@postgres:') ||
    connectionString.includes('@db:') ||
    sslDisabled;

  const needsSsl =
    !sslDisabled &&
    (process.env.DATABASE_SSL === 'true' ||
      process.env.DB_SSL === 'true' ||
      connectionString.includes('rds.amazonaws.com') ||
      (!isLocalhostOrDocker && process.env.NODE_ENV === 'production'));

  if (needsSsl) {
    try {
      const parsed = new URL(connectionString);
      parsed.searchParams.set('sslmode', 'require');
      parsed.searchParams.set('uselibpqcompat', 'true');
      connectionString = parsed.toString();
    } catch {
      const sep = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${sep}sslmode=require&uselibpqcompat=true`;
    }
  }

  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 4000,
      }),
    }),
  });
}

export function loadDropdownsFromFile(): any {
  let currentDir = '';
  try {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {}

  const candidates = [
    path.resolve(process.cwd(), 'src/db/dropdowns.json'),
    path.resolve(process.cwd(), 'backend/src/db/dropdowns.json'),
    path.resolve(process.cwd(), 'dist/db/dropdowns.json'),
    path.resolve(process.cwd(), 'backend/dist/db/dropdowns.json'),
    ...(currentDir ? [path.resolve(currentDir, 'dropdowns.json')] : []),
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return {};
  try {
    return JSON.parse(fs.readFileSync(found, 'utf-8'));
  } catch {
    return {};
  }
}

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DB,
      useFactory: () => createKyselyInstance(),
    },
  ],
  exports: [KYSELY_DB],
})
export class DbModule implements OnModuleInit {
  private readonly logger = new Logger(DbModule.name);
  public static isConnected = false;

  constructor(@Inject(KYSELY_DB) private readonly db: Kysely<DB>) {}

  async onModuleInit() {
    try {
      await sql.raw(INIT_SCHEMA_SQL).execute(this.db);
      DbModule.isConnected = true;
      this.logger.log('PostgreSQL database schema verified/initialized successfully.');

      // Tisztítás a hitelesített fajrekordok alapján:
      // 🐶 Kutya: Bluey (29 év 5 hónap -> 29,5 év)
      // 🐱 Macska: Creme Puff (38 év 3 nap -> 38 év)
      const dogYearsAgo = new Date();
      dogYearsAgo.setFullYear(dogYearsAgo.getFullYear() - 30);
      const dogCutoff = dogYearsAgo.toISOString().slice(0, 10);

      const catYearsAgo = new Date();
      catYearsAgo.setFullYear(catYearsAgo.getFullYear() - 38);
      const catCutoff = catYearsAgo.toISOString().slice(0, 10);

      const staleDeleteRes = await this.db
        .deleteFrom('animals')
        .where((eb) =>
          eb.or([
            // Kutyák életkor/várakozási korlátja (29,5 év)
            eb.and([
              eb('species', '=', 'kutya'),
              eb.or([
                eb('age_years', '>', 29.5),
                eb('admission_date', '<', dogCutoff),
                eb('program_date', '<', dogCutoff),
              ]),
            ]),
            // Macskák életkor/várakozási korlátja (38 év)
            eb.and([
              eb('species', '=', 'macska'),
              eb.or([
                eb('age_years', '>', 38),
                eb('admission_date', '<', catCutoff),
                eb('program_date', '<', catCutoff),
              ]),
            ]),
            // Ismeretlen fajta esetén maximum 38 év
            eb('age_years', '>', 38),
          ]),
        )
        .executeTakeFirst();

      const purgedCount = Number(staleDeleteRes.numDeletedRows || 0);
      if (purgedCount > 0) {
        this.logger.log(`Törölve ${purgedCount} elavult/inaktív szellem-állat az adatbázisból.`);
      }
    } catch (err: any) {
      DbModule.isConnected = false;
      this.logger.warn(
        `PostgreSQL connection unavailable (${err?.message}). Running with empty in-memory fallback store.`,
      );
    }
  }
}

