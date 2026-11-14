export const ITEM_CATEGORIES = [
  'Textbooks',
  'Calculators & Electronics',
  'Lab Equipment',
  'Drafting & Tools',
  'Notes & Supplies',
  'Sports Equipment',
  'Other',
] as const;

export const ITEM_CONDITIONS = ['Like New', 'Good', 'Fair'] as const;

export const LISTING_TYPES = [
  { value: 'borrow_only', label: 'Borrow Only' },
  { value: 'sell_only', label: 'Sell Only' },
  { value: 'borrow_or_buy', label: 'Borrow or Buy' },
] as const;

export const ACADEMIC_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Graduate',
  'PhD',
] as const;

export const BORROW_DURATION_SUGGESTIONS = [
  '3 Days',
  '7 Days',
  '2 Weeks',
  '1 Month',
  '1 Semester',
] as const;

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const STORAGE_BUCKET_NAME = 'item-images';

function readEnv(): Record<string, string | undefined> {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return meta?.env ?? {};
}

export function parseAllowedEmailDomains(rawValue?: string): string[] {
  const source = (rawValue ?? readEnv().VITE_ALLOWED_EMAIL_DOMAINS ?? 'edu').trim();
  if (!source) {
    return ['edu'];
  }
  return source
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^@/, '').replace(/^\./, ''))
    .filter((entry) => entry.length > 0);
}

export function getCampusConfig() {
  const env = readEnv();
  const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim();
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const allowedDomains = parseAllowedEmailDomains(env.VITE_ALLOWED_EMAIL_DOMAINS);
  const campusName = (env.VITE_CAMPUS_NAME ?? 'CampusConnect').trim() || 'CampusConnect';

  return {
    supabaseUrl,
    supabaseAnonKey,
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    allowedDomains,
    campusName,
  };
}
