import { z } from 'zod';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  MAX_IMAGE_FILE_SIZE_BYTES,
  parseAllowedEmailDomains,
} from '@/src/config/campus';
import type { ListingType } from '@/src/types/database';

export function isAllowedCollegeEmail(email: string, allowedDomains?: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return false;
  }
  const domainPart = normalized.slice(atIndex + 1);
  if (!domainPart.includes('.') && domainPart !== 'edu') {
    return false;
  }

  const rules = allowedDomains && allowedDomains.length > 0
    ? allowedDomains.map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/^\./, ''))
    : parseAllowedEmailDomains();

  return rules.some((rule) => {
    if (!rule) return false;
    // Exact domain match (e.g. stanford.edu) or suffix match (e.g. edu matches mit.edu, ac.in matches iitd.ac.in)
    return domainPart === rule || domainPart.endsWith(`.${rule}`);
  });
}

export function formatAllowedDomainsLabel(allowedDomains?: string[]): string {
  const rules = allowedDomains && allowedDomains.length > 0
    ? allowedDomains
    : parseAllowedEmailDomains();
  return rules.map((r) => (r.includes('.') ? `@${r}` : `.${r}`)).join(', ');
}

export function createRegisterSchema(allowedDomains?: string[]) {
  const domainsLabel = formatAllowedDomainsLabel(allowedDomains);
  return z
    .object({
      full_name: z
        .string()
        .trim()
        .min(2, 'Full name must be at least 2 characters.')
        .max(120, 'Full name cannot exceed 120 characters.'),
      email: z
        .string()
        .trim()
        .email('Enter a valid college email address.')
        .refine(
          (val) => isAllowedCollegeEmail(val, allowedDomains),
          `Use a valid college email ending with ${domainsLabel}.`
        ),
      department: z
        .string()
        .trim()
        .min(2, 'Enter your academic department.')
        .max(120, 'Department cannot exceed 120 characters.'),
      year: z
        .string()
        .trim()
        .min(2, 'Select your academic year.')
        .max(40, 'Academic year is too long.'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .max(72, 'Password cannot exceed 72 characters.'),
      confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: 'Passwords do not match.',
      path: ['confirm_password'],
    });
}

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters.')
    .max(120, 'Full name cannot exceed 120 characters.'),
  department: z
    .string()
    .trim()
    .min(2, 'Department must be at least 2 characters.')
    .max(120, 'Department cannot exceed 120 characters.'),
  year: z
    .string()
    .trim()
    .min(2, 'Select your academic year.')
    .max(40, 'Academic year is too long.'),
});

export interface ItemFormInput {
  title: string;
  description: string;
  category: string;
  condition: string;
  pickup_location: string;
  listing_type: ListingType;
  price: string;
  borrow_duration: string;
  available: boolean;
}

export interface NormalizedItemPayload {
  title: string;
  description: string;
  category: (typeof ITEM_CATEGORIES)[number];
  condition: (typeof ITEM_CONDITIONS)[number];
  pickup_location: string;
  listing_type: ListingType;
  price: number | null;
  borrow_duration: string | null;
  available: boolean;
}

export const itemFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters.')
      .max(140, 'Title cannot exceed 140 characters.'),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters.')
      .max(2000, 'Description cannot exceed 2000 characters.'),
    category: z.enum(ITEM_CATEGORIES, { message: 'Select a valid category.' }),
    condition: z.enum(ITEM_CONDITIONS, { message: 'Select item condition.' }),
    pickup_location: z
      .string()
      .trim()
      .min(2, 'Enter a campus pickup location.')
      .max(160, 'Pickup location cannot exceed 160 characters.'),
    listing_type: z.enum(['borrow_only', 'sell_only', 'borrow_or_buy']),
    price: z.string().trim(),
    borrow_duration: z.string().trim(),
    available: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.listing_type === 'sell_only' || data.listing_type === 'borrow_or_buy') {
      const parsed = Number(data.price);
      if (!data.price || Number.isNaN(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Price must be greater than zero for sellable items.',
        });
      }
    }

    if (data.listing_type === 'borrow_only' || data.listing_type === 'borrow_or_buy') {
      if (!data.borrow_duration || data.borrow_duration.trim().length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['borrow_duration'],
          message: 'Specify a borrow duration (e.g., 7 Days, 2 Weeks).',
        });
      }
    }
  });

export function normalizeItemPayload(input: ItemFormInput): NormalizedItemPayload {
  const parsed = itemFormSchema.parse(input);
  const price =
    parsed.listing_type === 'borrow_only'
      ? null
      : Number(Number(parsed.price).toFixed(2));
  const borrow_duration =
    parsed.listing_type === 'sell_only'
      ? null
      : parsed.borrow_duration.trim();

  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    condition: parsed.condition,
    pickup_location: parsed.pickup_location,
    listing_type: parsed.listing_type,
    price,
    borrow_duration,
    available: parsed.available,
  };
}

const PHONE_REGEX = /^[+\d][\d\s\-().]{5,23}\d$/;

export const borrowRequestSchema = z.object({
  borrower_phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid campus/mobile phone number.')
    .max(25, 'Phone number is too long.')
    .refine((val) => PHONE_REGEX.test(val), 'Enter a valid phone number (digits, spaces, +, -).'),
});

export const purchaseRequestSchema = z.object({
  buyer_phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid campus/mobile phone number.')
    .max(25, 'Phone number is too long.')
    .refine((val) => PHONE_REGEX.test(val), 'Enter a valid phone number (digits, spaces, +, -).'),
  offered_price: z
    .string()
    .trim()
    .refine((val) => {
      const n = Number(val);
      return Boolean(val) && !Number.isNaN(n) && n > 0 && n <= 100000;
    }, 'Offered price must be greater than zero.'),
});

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: { type: string; size: number }): ImageValidationResult {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Only JPG, PNG, and WebP images are supported.',
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Selected image file is empty.',
    };
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image must be 5 MB or smaller.',
    };
  }
  return { valid: true };
}
