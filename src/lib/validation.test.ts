import test from 'node:test';
import assert from 'node:assert/strict';
import {
  borrowRequestSchema,
  createRegisterSchema,
  isAllowedCollegeEmail,
  normalizeItemPayload,
  purchaseRequestSchema,
  validateImageFile,
} from './validation';

test('college email domain validation respects configurable domain rules', () => {
  assert.equal(isAllowedCollegeEmail('alex@stanford.edu', ['edu']), true);
  assert.equal(isAllowedCollegeEmail('alex@mit.edu', ['stanford.edu']), false);
  assert.equal(isAllowedCollegeEmail('alex@stanford.edu', ['stanford.edu']), true);
  assert.equal(isAllowedCollegeEmail('alex@cs.iitd.ac.in', ['ac.in']), true);
  assert.equal(isAllowedCollegeEmail('alex@gmail.com', ['edu', 'ac.in']), false);
  assert.equal(isAllowedCollegeEmail('not-an-email', ['edu']), false);
});

test('register schema validates matching passwords and required student profile fields', () => {
  const schema = createRegisterSchema(['campus.edu']);
  const valid = schema.safeParse({
    full_name: 'Priya Nair',
    email: 'priya@campus.edu',
    department: 'Computer Science',
    year: '3rd Year',
    password: 'StrongPassword123',
    confirm_password: 'StrongPassword123',
  });
  assert.equal(valid.success, true);

  const mismatch = schema.safeParse({
    full_name: 'Priya Nair',
    email: 'priya@campus.edu',
    department: 'Computer Science',
    year: '3rd Year',
    password: 'StrongPassword123',
    confirm_password: 'DifferentPassword123',
  });
  assert.equal(mismatch.success, false);

  const nonCollege = schema.safeParse({
    full_name: 'Priya Nair',
    email: 'priya@gmail.com',
    department: 'Computer Science',
    year: '3rd Year',
    password: 'StrongPassword123',
    confirm_password: 'StrongPassword123',
  });
  assert.equal(nonCollege.success, false);
});

test('normalizeItemPayload enforces borrow_only business rules (price must be null)', () => {
  const normalized = normalizeItemPayload({
    title: 'TI-84 Plus Calculator',
    description: 'Clean graphing calculator with USB cable included.',
    category: 'Calculators & Electronics',
    condition: 'Good',
    pickup_location: 'Engineering Lobby',
    listing_type: 'borrow_only',
    price: '45',
    borrow_duration: '7 Days',
    available: true,
  });

  assert.equal(normalized.price, null);
  assert.equal(normalized.borrow_duration, '7 Days');

  assert.throws(() =>
    normalizeItemPayload({
      title: 'TI-84 Plus Calculator',
      description: 'Clean graphing calculator with USB cable included.',
      category: 'Calculators & Electronics',
      condition: 'Good',
      pickup_location: 'Engineering Lobby',
      listing_type: 'borrow_only',
      price: '',
      borrow_duration: '',
      available: true,
    })
  );
});

test('normalizeItemPayload enforces sell_only business rules (borrow_duration must be null, price > 0)', () => {
  const normalized = normalizeItemPayload({
    title: 'Organic Chemistry Textbook',
    description: 'Hardcover 8th edition with zero highlighting inside.',
    category: 'Textbooks',
    condition: 'Like New',
    pickup_location: 'Science Library Desk',
    listing_type: 'sell_only',
    price: '39.50',
    borrow_duration: '2 Weeks',
    available: true,
  });

  assert.equal(normalized.price, 39.5);
  assert.equal(normalized.borrow_duration, null);

  assert.throws(() =>
    normalizeItemPayload({
      title: 'Organic Chemistry Textbook',
      description: 'Hardcover 8th edition with zero highlighting inside.',
      category: 'Textbooks',
      condition: 'Like New',
      pickup_location: 'Science Library Desk',
      listing_type: 'sell_only',
      price: '0',
      borrow_duration: '',
      available: true,
    })
  );
});

test('normalizeItemPayload enforces borrow_or_buy business rules (both price > 0 and borrow_duration)', () => {
  const normalized = normalizeItemPayload({
    title: 'Architectural Scale & Compass Kit',
    description: 'Precision drafting tools used for Studio 101.',
    category: 'Drafting & Tools',
    condition: 'Good',
    pickup_location: 'Architecture Hall',
    listing_type: 'borrow_or_buy',
    price: '24',
    borrow_duration: '2 Weeks',
    available: true,
  });

  assert.equal(normalized.price, 24);
  assert.equal(normalized.borrow_duration, '2 Weeks');
});

test('borrow and purchase request schemas validate phone numbers and offered price', () => {
  assert.equal(borrowRequestSchema.safeParse({ borrower_phone: '+1 555-234-5678' }).success, true);
  assert.equal(borrowRequestSchema.safeParse({ borrower_phone: '123' }).success, false);

  assert.equal(
    purchaseRequestSchema.safeParse({ buyer_phone: '555-0192', offered_price: '25.00' }).success,
    true
  );
  assert.equal(
    purchaseRequestSchema.safeParse({ buyer_phone: '555-0192', offered_price: '0' }).success,
    false
  );
});

test('validateImageFile accepts valid JPEG/PNG/WebP under 5MB and rejects others', () => {
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 1024 * 1024 }).valid, true);
  assert.equal(validateImageFile({ type: 'image/png', size: 4 * 1024 * 1024 }).valid, true);
  assert.equal(validateImageFile({ type: 'image/webp', size: 512 * 1024 }).valid, true);
  assert.equal(validateImageFile({ type: 'application/pdf', size: 1024 }).valid, false);
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }).valid, false);
  assert.equal(validateImageFile({ type: 'image/png', size: 0 }).valid, false);
});
