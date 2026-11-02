import type { ColumnType, Generated } from 'kysely';

export type Timestamp = Date | string;

export interface TraitScores {
  playfulness: number;
  activity: number;
  trainability: number;
  temperament: number;
}

export interface UserPreferences {
  species?: 'kutya' | 'macska' | 'mindegy';
  breed?: string;
  fromyear?: number;
  toyear?: number;
  gender?: 'Any' | 'Male' | 'Female';
  peopleok?: 'Any' | 'Yes' | 'No';
  size?: 'Any' | 'Small' | 'Medium' | 'Large';
  kidsok?: 'Any' | 'Yes' | 'No';
  housebroken?: 'Any' | 'Yes' | 'No';
  malesok?: 'Any' | 'Yes' | 'No';
  keepin?: 'Any' | 'Flat' | 'Garden' | 'FlatAndGarden';
  femalesok?: 'Any' | 'Yes' | 'No';
  spayed?: 'Any' | 'Yes' | 'No';
  shelter_id?: string;
  max_distance_km?: number;
  min_match_percent?: number;
  traits?: TraitScores;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string | null;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  max_distance_km: Generated<number>;
  preferences_json: ColumnType<UserPreferences, string | UserPreferences, string | UserPreferences>;
  created_at: Generated<Timestamp>;
}

export interface OtpCodesTable {
  id: Generated<string>;
  email: string;
  code: string;
  expires_at: Timestamp;
  used: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token: string;
  expires_at: Timestamp;
  revoked: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface AnimalsTable {
  external_id: string;
  species: string;
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
  image_links: ColumnType<string[], string | string[], string | string[]>;
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
  traits_json: ColumnType<TraitScores, string | TraitScores, string | TraitScores>;
  is_adopted: Generated<boolean>;
  adopted_at: Timestamp | null;
  updated_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
}

export interface UserSwipesTable {
  id: Generated<string>;
  user_id: string;
  animal_id: string;
  direction: string;
  match_percent: number;
  created_at: Generated<Timestamp>;
}

export interface ScraperRunsTable {
  id: Generated<string>;
  started_at: Generated<Timestamp>;
  finished_at: Timestamp | null;
  status: string;
  total_checked: number;
  created_count: number;
  updated_count: number;
  deleted_count: number;
  error_message: string | null;
}

export interface UserEventsTable {
  id: Generated<string>;
  user_id: string | null;
  event_name: string;
  properties: ColumnType<unknown, string | null, string | null>;
  created_at: Generated<Timestamp>;
}

export interface DB {
  users: UsersTable;
  otp_codes: OtpCodesTable;
  refresh_tokens: RefreshTokensTable;
  animals: AnimalsTable;
  user_swipes: UserSwipesTable;
  scraper_runs: ScraperRunsTable;
  user_events: UserEventsTable;
}
