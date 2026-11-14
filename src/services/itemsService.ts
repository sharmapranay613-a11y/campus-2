import { STORAGE_BUCKET_NAME } from '@/src/config/campus';
import { requireSupabase, supabaseConfigured } from '@/src/lib/supabase';
import {
  normalizeItemPayload,
  validateImageFile,
  type ItemFormInput,
} from '@/src/lib/validation';
import type {
  Item,
  ItemCategory,
  ItemCondition,
  ItemWithOwner,
} from '@/src/types/database';

export type ExploreListingTypeFilter = 'all' | 'borrow' | 'buy' | 'both';

export interface MarketplaceFilterParams {
  search?: string;
  category?: ItemCategory | 'all';
  listingType?: ExploreListingTypeFilter;
  condition?: ItemCondition | 'all';
  availableOnly?: boolean;
  limit?: number;
}

const ITEM_SELECT_WITH_OWNER = `
  *,
  owner:profiles!items_owner_id_fkey (
    id,
    full_name,
    department,
    year
  )
`;

function extractStoragePathFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const marker = `/object/public/${STORAGE_BUCKET_NAME}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(imageUrl.slice(idx + marker.length));
}

export async function uploadItemImage(ownerId: string, file: File): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const supabase = requireSupabase();
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const objectPath = `${ownerId}/${crypto.randomUUID()}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function removeOwnedStorageImage(
  ownerId: string,
  imageUrl: string | null | undefined
): Promise<void> {
  const path = extractStoragePathFromUrl(imageUrl);
  if (!path || !path.startsWith(`${ownerId}/`)) {
    return;
  }
  const supabase = requireSupabase();
  await supabase.storage.from(STORAGE_BUCKET_NAME).remove([path]);
}

export async function listMarketplaceItems(
  filters: MarketplaceFilterParams = {}
): Promise<ItemWithOwner[]> {
  if (!supabaseConfigured) {
    return [];
  }
  const supabase = requireSupabase();

  let query = supabase
    .from('items')
    .select(ITEM_SELECT_WITH_OWNER)
    .order('created_at', { ascending: false });

  if (filters.availableOnly) {
    query = query.eq('available', true).eq('is_sold', false);
  }

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters.condition && filters.condition !== 'all') {
    query = query.eq('condition', filters.condition);
  }

  if (filters.listingType === 'borrow') {
    query = query.in('listing_type', ['borrow_only', 'borrow_or_buy']);
  } else if (filters.listingType === 'buy') {
    query = query.in('listing_type', ['sell_only', 'borrow_or_buy']);
  } else if (filters.listingType === 'both') {
    query = query.eq('listing_type', 'borrow_or_buy');
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().replace(/[,%()]/g, ' ');
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  if (filters.limit && filters.limit > 0) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as ItemWithOwner[];
}

export async function countAvailableMarketplaceItems(): Promise<number> {
  if (!supabaseConfigured) {
    return 0;
  }
  const supabase = requireSupabase();
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('available', true)
    .eq('is_sold', false);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getItemById(itemId: string): Promise<ItemWithOwner | null> {
  if (!supabaseConfigured) {
    return null;
  }
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_SELECT_WITH_OWNER)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as ItemWithOwner | null) ?? null;
}

export async function listUserItems(ownerId: string): Promise<Item[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return (data ?? []) as Item[];
}

export async function createItem(
  ownerId: string,
  formInput: ItemFormInput,
  imageFile: File | null
): Promise<Item> {
  const normalized = normalizeItemPayload(formInput);
  const supabase = requireSupabase();

  let uploadedImageUrl: string | null = null;
  if (imageFile) {
    uploadedImageUrl = await uploadItemImage(ownerId, imageFile);
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      owner_id: ownerId,
      title: normalized.title,
      description: normalized.description,
      category: normalized.category,
      condition: normalized.condition,
      image_url: uploadedImageUrl,
      pickup_location: normalized.pickup_location,
      listing_type: normalized.listing_type,
      price: normalized.price,
      borrow_duration: normalized.borrow_duration,
      available: normalized.available,
      is_sold: false,
    })
    .select()
    .single();

  if (error) {
    if (uploadedImageUrl) {
      await removeOwnedStorageImage(ownerId, uploadedImageUrl).catch(() => undefined);
    }
    throw error;
  }

  return data as Item;
}

export async function updateItem(params: {
  itemId: string;
  ownerId: string;
  formInput: ItemFormInput;
  imageFile: File | null;
  existingImageUrl: string | null;
  removeExistingImage: boolean;
}): Promise<Item> {
  const { itemId, ownerId, formInput, imageFile, existingImageUrl, removeExistingImage } = params;
  const normalized = normalizeItemPayload(formInput);
  const supabase = requireSupabase();

  let nextImageUrl: string | null = removeExistingImage ? null : existingImageUrl;
  let newlyUploadedUrl: string | null = null;

  if (imageFile) {
    newlyUploadedUrl = await uploadItemImage(ownerId, imageFile);
    nextImageUrl = newlyUploadedUrl;
  }

  const { data, error } = await supabase
    .from('items')
    .update({
      title: normalized.title,
      description: normalized.description,
      category: normalized.category,
      condition: normalized.condition,
      image_url: nextImageUrl,
      pickup_location: normalized.pickup_location,
      listing_type: normalized.listing_type,
      price: normalized.price,
      borrow_duration: normalized.borrow_duration,
      available: normalized.available,
    })
    .eq('id', itemId)
    .eq('owner_id', ownerId)
    .select()
    .single();

  if (error) {
    if (newlyUploadedUrl) {
      await removeOwnedStorageImage(ownerId, newlyUploadedUrl).catch(() => undefined);
    }
    throw error;
  }

  if ((newlyUploadedUrl || removeExistingImage) && existingImageUrl) {
    await removeOwnedStorageImage(ownerId, existingImageUrl).catch(() => undefined);
  }

  return data as Item;
}

export async function toggleItemAvailability(
  itemId: string,
  ownerId: string,
  available: boolean
): Promise<Item> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('items')
    .update({ available })
    .eq('id', itemId)
    .eq('owner_id', ownerId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data as Item;
}

export async function deleteItem(
  itemId: string,
  ownerId: string,
  imageUrl: string | null
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('owner_id', ownerId);

  if (error) {
    throw error;
  }

  if (imageUrl) {
    await removeOwnedStorageImage(ownerId, imageUrl).catch(() => undefined);
  }
}
