export function getBaseApiUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    // Production (pawnder.hu, www.pawnder.hu, *.cloudfront.net, etc.)
    return 'https://api.pawnder.hu';
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://api.pawnder.hu'
    : 'http://localhost:3000';
}

export const TOKEN_KEY = 'pawnder_token';
export const REFRESH_TOKEN_KEY = 'pawnder_refresh_token';
export const USER_STORAGE_KEY = 'pawnder_user';
export const LOCAL_FILTERS_KEY = 'pawnder_filters_v1';
export const LOCAL_FILTERS_TOUCHED_KEY = 'pawnder_filters_touched_v1';
export const LOCAL_SWIPES_KEY = 'pawnder_swipes_v1';
export const LOCAL_SAVED_PETS_KEY = 'pawnder_saved_pet_records_v1';

// Auto-purge any legacy authentication tokens
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {}
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${getBaseApiUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || 'Váratlan hiba történt a kérés feldolgozásakor.',
    );
  }

  return data as T;
}
