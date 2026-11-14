import type { ItemCategory } from '@/src/types/database';

export const HERO_COMMONS_IMAGE = '/src/assets/images/hero_campus_commons_1794674930257.jpg';

const FALLBACK_TEXTBOOKS = '/src/assets/images/fallback_textbooks_1794674929686.jpg';
const FALLBACK_ELECTRONICS = '/src/assets/images/fallback_electronics_1794674930619.jpg';
const FALLBACK_TOOLS_GEAR = '/src/assets/images/fallback_tools_gear_1794674931221.jpg';

export function getCategoryFallbackImage(category: ItemCategory | string): string {
  switch (category) {
    case 'Textbooks':
    case 'Notes & Supplies':
      return FALLBACK_TEXTBOOKS;
    case 'Calculators & Electronics':
    case 'Lab Equipment':
      return FALLBACK_ELECTRONICS;
    case 'Drafting & Tools':
    case 'Sports Equipment':
    case 'Other':
    default:
      return FALLBACK_TOOLS_GEAR;
  }
}

export function resolveItemImageUrl(
  imageUrl: string | null | undefined,
  category: ItemCategory | string
): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }
  return getCategoryFallbackImage(category);
}
