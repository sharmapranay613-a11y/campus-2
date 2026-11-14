import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select } from '@/src/components/ui/select';
import { Textarea } from '@/src/components/ui/textarea';
import {
  BORROW_DURATION_SUGGESTIONS,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  LISTING_TYPES,
} from '@/src/config/campus';
import { getCategoryFallbackImage } from '@/src/lib/images';
import {
  itemFormSchema,
  validateImageFile,
  type ItemFormInput,
} from '@/src/lib/validation';
import type { ListingType } from '@/src/types/database';

interface ItemFormProps {
  initialValues?: Partial<ItemFormInput>;
  existingImageUrl?: string | null;
  isSold?: boolean;
  submitLabel: string;
  onSubmit: (params: {
    formInput: ItemFormInput;
    imageFile: File | null;
    removeExistingImage: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export function ItemForm({
  initialValues,
  existingImageUrl = null,
  isSold = false,
  submitLabel,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [category, setCategory] = useState<string>(
    initialValues?.category ?? ITEM_CATEGORIES[0]
  );
  const [condition, setCondition] = useState<string>(
    initialValues?.condition ?? ITEM_CONDITIONS[0]
  );
  const [pickupLocation, setPickupLocation] = useState(
    initialValues?.pickup_location ?? ''
  );
  const [listingType, setListingType] = useState<ListingType>(
    initialValues?.listing_type ?? 'borrow_or_buy'
  );
  const [price, setPrice] = useState(initialValues?.price ?? '');
  const [borrowDuration, setBorrowDuration] = useState(
    initialValues?.borrow_duration ?? '7 Days'
  );
  const [available, setAvailable] = useState(initialValues?.available ?? true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingImageUrl);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showPrice = listingType === 'sell_only' || listingType === 'borrow_or_buy';
  const showBorrowDuration =
    listingType === 'borrow_only' || listingType === 'borrow_or_buy';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateImageFile(file);
    if (!check.valid) {
      setFieldErrors((prev) => ({ ...prev, image: check.error ?? 'Invalid image.' }));
      e.target.value = '';
      return;
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setImageFile(file);
    setRemoveExistingImage(false);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setRemoveExistingImage(true);
  };

  const handleListingTypeChange = (nextType: ListingType) => {
    setListingType(nextType);
    if (nextType === 'borrow_only') {
      setPrice('');
    }
    if (nextType === 'sell_only') {
      setBorrowDuration('');
    } else if (!borrowDuration) {
      setBorrowDuration('7 Days');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const candidate: ItemFormInput = {
      title,
      description,
      category,
      condition,
      pickup_location: pickupLocation,
      listing_type: listingType,
      price: showPrice ? price : '',
      borrow_duration: showBorrowDuration ? borrowDuration : '',
      available: isSold ? false : available,
    };

    const result = itemFormSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        formInput: candidate,
        imageFile,
        removeExistingImage,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const fallbackPreview = getCategoryFallbackImage(category);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Item photo upload */}
        <div className="space-y-3">
          <Label htmlFor="item-image-upload">Item Photo</Label>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            <img
              src={previewUrl || fallbackPreview}
              alt={previewUrl ? 'Uploaded item preview' : 'Default category preview'}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-stone-500">
            {previewUrl
              ? 'Custom photo selected.'
              : 'Optional. A clean category photo is used if none is uploaded.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="item-image-upload"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-xs font-medium text-zinc-900 hover:bg-stone-50 focus-within:ring-2 focus-within:ring-emerald-800"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{previewUrl ? 'Replace Photo' : 'Upload Photo'}</span>
              <input
                id="item-image-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-stone-500">JPG, PNG, or WebP up to 5 MB.</p>
          {fieldErrors.image && (
            <p className="text-xs font-medium text-red-700">{fieldErrors.image}</p>
          )}
        </div>

        {/* Right: Structured form fields */}
        <div className="space-y-5 lg:col-span-2">
          <div>
            <Label htmlFor="item-title">Item Title</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Linear Algebra Done Right (4th Ed.) or TI-84 Plus CE"
              className="mt-1.5"
              required
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.title}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-category">Category</Label>
              <Select
                id="item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5"
              >
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
              {fieldErrors.category && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {fieldErrors.category}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="item-condition">Condition</Label>
              <Select
                id="item-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1.5"
              >
                {ITEM_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </Select>
              {fieldErrors.condition && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {fieldErrors.condition}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include edition, included accessories, wear notes, or syllabus course code."
              className="mt-1.5"
              required
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs font-medium text-red-700">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="item-pickup">Campus Pickup Location</Label>
            <Input
              id="item-pickup"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="e.g., Main Science Library Lobby, North Quad Dorms"
              className="mt-1.5"
              required
            />
            {fieldErrors.pickup_location && (
              <p className="mt-1 text-xs font-medium text-red-700">
                {fieldErrors.pickup_location}
              </p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-800">Listing Type</span>
            <div
              role="radiogroup"
              aria-label="Listing type"
              className="mt-1.5 grid grid-cols-3 gap-2 rounded-lg border border-stone-200 bg-stone-100 p-1"
            >
              {LISTING_TYPES.map((option) => {
                const active = listingType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleListingTypeChange(option.value)}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-stone-600 hover:text-zinc-900'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {showPrice && (
              <div>
                <Label htmlFor="item-price">Selling Price (USD)</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="25.00"
                  className="mt-1.5 font-mono tabular-nums"
                  required
                />
                {fieldErrors.price && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {fieldErrors.price}
                  </p>
                )}
              </div>
            )}

            {showBorrowDuration && (
              <div>
                <Label htmlFor="item-duration">Borrow Duration</Label>
                <Input
                  id="item-duration"
                  list="borrow-duration-options"
                  value={borrowDuration}
                  onChange={(e) => setBorrowDuration(e.target.value)}
                  placeholder="e.g., 7 Days, 2 Weeks"
                  className="mt-1.5"
                  required
                />
                <datalist id="borrow-duration-options">
                  {BORROW_DURATION_SUGGESTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                {fieldErrors.borrow_duration && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {fieldErrors.borrow_duration}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <Label htmlFor="item-available" className="font-medium text-zinc-900">
                Available for student requests
              </Label>
              <p className="text-xs text-stone-500">
                {isSold
                  ? 'This item is sold and cannot be made available.'
                  : 'Uncheck to temporarily hide this listing from active availability.'}
              </p>
            </div>
            <input
              id="item-available"
              type="checkbox"
              checked={isSold ? false : available}
              disabled={isSold}
              onChange={(e) => setAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 accent-emerald-900"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 pt-5">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || isSold}>
              {submitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
