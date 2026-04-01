-- Seed data: 10 test merchants in Koramangala, Bengaluru. Run after all migrations.
-- Usage: psql $DATABASE_URL < supabase/seed.sql
--        or paste into Supabase Studio SQL editor

BEGIN;

-- Reset seed data
DELETE FROM merchants WHERE user_id::text LIKE '00000000-0000-0000-0000-0000000000%';

-- Food × 3
INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Ravi Tiffin Centre',
  'Fresh South Indian breakfast and lunch — idli, dosa, vada, sambar',
  'Food',
  ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography,
  '1st Block, Koramangala',
  'Koramangala',
  '+919876543210',
  2000,
  false,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Annapoorna Home Kitchen',
  'Home-cooked North Karnataka meals, tiffin delivery available',
  'Food',
  ST_SetSRID(ST_MakePoint(77.6258, 12.9361), 4326)::geography,
  '3rd Block, Koramangala',
  'Koramangala',
  '+919845012345',
  3000,
  true,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Spice Route Catering',
  'Bulk orders for events, corporate lunches, and home functions',
  'Food',
  ST_SetSRID(ST_MakePoint(77.6232, 12.9344), 4326)::geography,
  '5th Block, Koramangala',
  'Koramangala',
  '+918022334455',
  5000,
  false,
  true
);

-- Beauty × 4
INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'Meera Beauty Parlour',
  'Full beauty services including threading, facials, and bridal packages',
  'Beauty',
  ST_SetSRID(ST_MakePoint(77.6220, 12.9340), 4326)::geography,
  '5th Block, Koramangala',
  'Koramangala',
  '+918012345678',
  3000,
  false,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'Lakshmi Bridal Studio',
  'Bridal makeup, mehendi, and pre-wedding beauty packages',
  'Beauty',
  ST_SetSRID(ST_MakePoint(77.6265, 12.9368), 4326)::geography,
  '7th Block, Koramangala',
  'Koramangala',
  '+919901122334',
  4000,
  true,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000006',
  'Glow & Trim Salon',
  'Haircuts, colouring, keratin treatments, and pedicure for all',
  'Beauty',
  ST_SetSRID(ST_MakePoint(77.6238, 12.9358), 4326)::geography,
  '2nd Block, Koramangala',
  'Koramangala',
  '+918099887766',
  2500,
  false,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000007',
  'Priya Skin & Hair Care',
  'Dermat-guided facials, hair spa, and scalp treatments',
  'Beauty',
  ST_SetSRID(ST_MakePoint(77.6250, 12.9345), 4326)::geography,
  '4th Block, Koramangala',
  'Koramangala',
  '+919611223344',
  3500,
  true,
  true
);

-- Tailoring × 3
INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000008',
  'Suresh Master Tailor',
  'Gents and ladies stitching, alterations, and bulk uniforms',
  'Tailoring',
  ST_SetSRID(ST_MakePoint(77.6242, 12.9355), 4326)::geography,
  '6th Block, Koramangala',
  'Koramangala',
  '+919742233445',
  2000,
  false,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000009',
  'Divya Boutique & Stitching',
  'Designer blouses, salwar kameez, and saree falls — express delivery',
  'Tailoring',
  ST_SetSRID(ST_MakePoint(77.6228, 12.9362), 4326)::geography,
  '8th Block, Koramangala',
  'Koramangala',
  '+919886655443',
  3000,
  true,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Ramesh Alterations',
  'Quick alterations, zip repairs, and curtain stitching at home',
  'Tailoring',
  ST_SetSRID(ST_MakePoint(77.6255, 12.9337), 4326)::geography,
  '9th Block, Koramangala',
  'Koramangala',
  '+918033221100',
  1500,
  false,
  true
);

INSERT INTO merchants (user_id, name, description, category, location, address_text, neighborhood, phone, service_radius_meters, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  'Closed Tailor Shop',
  'Previously offered tailoring services — currently inactive',
  'Tailoring',
  ST_SetSRID(ST_MakePoint(77.6248, 12.9350), 4326)::geography,
  '4th Block, Koramangala',
  'Koramangala',
  '+919876501234',
  2000,
  false,
  false
);

-- Services seed data
INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Idli Plate', 40.00, 'per plate', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Dosa', 50.00, 'per item', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Threading', 50.00, 'per session', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000004';

INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Facial', 800.00, 'per session', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000004';

INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Shirt Stitching', 300.00, 'per piece', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000008';

INSERT INTO services (merchant_id, name, price, price_unit, is_available)
SELECT id, 'Pant Alteration', 150.00, 'per piece', true FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000008';

-- Portfolio images seed data
INSERT INTO portfolio_images (merchant_id, image_url, sort_order)
SELECT id, 'https://example.com/portfolio/meera-1.jpg', 0 FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000004';

INSERT INTO portfolio_images (merchant_id, image_url, sort_order)
SELECT id, 'https://example.com/portfolio/meera-2.jpg', 1 FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000004';

-- Verify row counts after seeding:
-- SELECT count(*) FROM merchants;        -- Expected: 11
-- SELECT count(*) FROM services;         -- Expected: 6
-- SELECT count(*) FROM portfolio_images; -- Expected: 2

COMMIT;

-- Note: user_id values are placeholder UUIDs. In production, link to real profile rows.

-- Sprint 6: Follows + Posts seed data
-- Seed follower UUID: 00000000-0000-0000-0000-000000000099 (placeholder, same pattern as merchant user_ids)
-- Followed merchants: user_ids 001 (Ravi Tiffin), 006 (Glow & Trim), 008 (Suresh Tailor)

BEGIN;

-- Reset Sprint 6 seed data (idempotent re-run)
DELETE FROM posts
WHERE merchant_id IN (
  SELECT id FROM merchants
  WHERE user_id::text IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000008'
  )
);

DELETE FROM follows WHERE follower_id = '00000000-0000-0000-0000-000000000099';

-- Follows: seed user follows 3 merchants
INSERT INTO follows (follower_id, merchant_id)
SELECT '00000000-0000-0000-0000-000000000099', id
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO follows (follower_id, merchant_id)
SELECT '00000000-0000-0000-0000-000000000099', id
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000006'
ON CONFLICT DO NOTHING;

INSERT INTO follows (follower_id, merchant_id)
SELECT '00000000-0000-0000-0000-000000000099', id
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000008'
ON CONFLICT DO NOTHING;

-- Posts: 2 posts for Ravi Tiffin Centre (merchant user_id 001)
INSERT INTO posts (merchant_id, content, post_type, is_active)
SELECT id, 'Weekend special: buy 2 idli plates, get 1 free! Offer valid Sat–Sun only.', 'offer', true
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO posts (merchant_id, content, post_type, is_active)
SELECT id, 'We now offer home delivery for all tiffin orders within 2 km. Call us to order!', 'update', true
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- Posts: 2 posts for Glow & Trim Salon (merchant user_id 006)
INSERT INTO posts (merchant_id, content, post_type, is_active)
SELECT id, 'New haircut special this weekend! 20% off all styles — walk-ins welcome.', 'offer', true
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000006';

INSERT INTO posts (merchant_id, content, post_type, is_active)
SELECT id, 'We have added keratin smoothing treatment to our menu. Book your slot today!', 'update', true
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000006';

-- Posts: 1 post for Suresh Master Tailor (merchant user_id 008)
INSERT INTO posts (merchant_id, content, post_type, is_active)
SELECT id, 'Festive season offer: get your traditional outfit stitched in 3 days. Limited slots.', 'offer', true
FROM merchants WHERE user_id = '00000000-0000-0000-0000-000000000008';

-- Verify Sprint 6 seed counts:
-- SELECT count(*) FROM follows WHERE follower_id = '00000000-0000-0000-0000-000000000099'; -- Expected: 3
-- SELECT count(*) FROM posts;                                                               -- Expected: 5

COMMIT;

-- =============================================================================
-- Sprint 8: E2E Test Users + Merchant + Follows + Posts
-- TEST_PHONE      : +919182666194  (regular user — flows 11, 12)
-- TEST_MERCHANT_PHONE: +919182666195  (merchant user — flow 13)
-- Fixed UUIDs so follows/merchant rows are deterministic across resets.
-- =============================================================================

BEGIN;

-- Fixed UUIDs for E2E test accounts
-- TEST_PHONE user       : 00000000-0000-0000-0000-e2e000000001
-- TEST_MERCHANT_PHONE   : 00000000-0000-0000-0000-e2e000000002
-- TEST_MERCHANT record  : 00000000-0000-0000-0000-e2e000000003  (merchant.id, kept stable)

-- ── Clean up previous Sprint 8 seed (idempotent) ────────────────────────────
DELETE FROM posts
WHERE merchant_id IN (
  SELECT id FROM merchants WHERE user_id = '00000000-0000-0000-0000-e2e000000002'
);

DELETE FROM follows
WHERE follower_id = '00000000-0000-0000-0000-e2e000000001'
  AND merchant_id IN (
    SELECT id FROM merchants WHERE user_id = '00000000-0000-0000-0000-e2e000000002'
  );

DELETE FROM merchants WHERE user_id = '00000000-0000-0000-0000-e2e000000002';

-- Remove profiles (cascade will remove follows referencing them as follower)
DELETE FROM profiles WHERE id IN (
  '00000000-0000-0000-0000-e2e000000001',
  '00000000-0000-0000-0000-e2e000000002'
);

-- Remove auth users (cascade removes profiles via FK)
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-e2e000000001',
  '00000000-0000-0000-0000-e2e000000002'
);

-- ── Auth users (phone-based, OTP = 123456) ───────────────────────────────────
-- Supabase local dev accepts pre-seeded auth.users rows for phone auth.
INSERT INTO auth.users (
  id, instance_id, aud, role,
  phone, phone_confirmed_at,
  encrypted_password,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES (
  '00000000-0000-0000-0000-e2e000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  '+919182666194', now(),
  '',
  now(), now(),
  '', '', '', ''
),
(
  '00000000-0000-0000-0000-e2e000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  '+919182666195', now(),
  '',
  now(), now(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- ── Profiles (handle_new_user trigger may fire; upsert is safe) ───────────────
INSERT INTO profiles (id, phone, is_merchant)
VALUES
  ('00000000-0000-0000-0000-e2e000000001', '+919182666194', false),
  ('00000000-0000-0000-0000-e2e000000002', '+919182666195', false)
ON CONFLICT (id) DO UPDATE
  SET phone = EXCLUDED.phone;

-- ── Merchant record owned by TEST_MERCHANT_PHONE ─────────────────────────────
-- Using explicit id so posts/follows can reference it without a sub-select.
INSERT INTO merchants (
  id, user_id, name, description, category,
  location, address_text, neighborhood,
  phone, service_radius_meters, is_verified, is_active
)
VALUES (
  '00000000-0000-0000-0000-e2e000000003',
  '00000000-0000-0000-0000-e2e000000002',
  'E2E Test Merchant Shop',
  'Automated test merchant for Sprint 8 E2E flows',
  'Food',
  ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography,
  '1st Block, Koramangala',
  'Koramangala',
  '+919182666195',
  3000,
  false,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── 2 Posts for E2E merchant (flows 11 & 12 need ≥ 1 post visible) ───────────
INSERT INTO posts (merchant_id, content, post_type, is_active)
VALUES
  ('00000000-0000-0000-0000-e2e000000003',
   'Weekend special: 20% off all items — valid Saturday and Sunday only!',
   'offer', true),
  ('00000000-0000-0000-0000-e2e000000003',
   'We are now open on public holidays. Come visit us!',
   'update', true)
ON CONFLICT DO NOTHING;

-- ── TEST_PHONE follows E2E merchant (required for Following-tab in flows 11, 12) ──
INSERT INTO follows (follower_id, merchant_id)
VALUES ('00000000-0000-0000-0000-e2e000000001', '00000000-0000-0000-0000-e2e000000003')
ON CONFLICT DO NOTHING;

-- Verify Sprint 8 seed:
-- SELECT count(*) FROM follows  WHERE follower_id = '00000000-0000-0000-0000-e2e000000001'; -- 1
-- SELECT count(*) FROM posts    WHERE merchant_id = '00000000-0000-0000-0000-e2e000000003'; -- 2
-- SELECT is_merchant FROM profiles WHERE id = '00000000-0000-0000-0000-e2e000000002';       -- true (set by trigger)

COMMIT;

-- =============================================================================
-- Sprint 9: Chat Seed Data
-- Uses E2E test users seeded in Sprint 8.
-- customer       : 00000000-0000-0000-0000-e2e000000001
-- merchant_owner : 00000000-0000-0000-0000-e2e000000002
-- E2E merchant   : 00000000-0000-0000-0000-e2e000000003
-- Thread 1       : 00000000-0000-0000-0000-chat00000001  (E2E customer ↔ E2E merchant)
-- Thread 2       : 00000000-0000-0000-0000-chat00000002  (E2E customer ↔ Ravi Tiffin Centre)
-- =============================================================================

BEGIN;

-- ── Clean up previous Sprint 9 seed (idempotent) ────────────────────────────
DELETE FROM chat_messages WHERE thread_id IN (
  SELECT id FROM chat_threads WHERE user_id = '00000000-0000-0000-0000-e2e000000001'
);
DELETE FROM chat_threads WHERE user_id = '00000000-0000-0000-0000-e2e000000001';

-- ── Thread 1: E2E customer ↔ E2E merchant ────────────────────────────────────
INSERT INTO chat_threads (id, user_id, merchant_id, last_message_at) VALUES (
  '00000000-0000-0000-0000-chat00000001',
  '00000000-0000-0000-0000-e2e000000001',
  '00000000-0000-0000-0000-e2e000000003',
  now() - interval '10 minutes'
);

INSERT INTO chat_messages (thread_id, sender_id, content, read_by_user, read_by_merchant, created_at) VALUES
  ('00000000-0000-0000-0000-chat00000001', '00000000-0000-0000-0000-e2e000000001',
   'Hi, do you offer home delivery for tiffin?', true, true, now() - interval '50 minutes'),
  ('00000000-0000-0000-0000-chat00000001', '00000000-0000-0000-0000-e2e000000002',
   'Yes! We deliver within 3 km. What is your location?', true, true, now() - interval '45 minutes'),
  ('00000000-0000-0000-0000-chat00000001', '00000000-0000-0000-0000-e2e000000001',
   'I am in 4th Block Koramangala. Is that within range?', true, true, now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-chat00000001', '00000000-0000-0000-0000-e2e000000002',
   'Yes, 4th Block is covered. We can deliver by 12:30 PM.', true, true, now() - interval '35 minutes'),
  ('00000000-0000-0000-0000-chat00000001', '00000000-0000-0000-0000-e2e000000001',
   'Great, please deliver 2 idli plates and 1 dosa. Thank you!', true, false, now() - interval '10 minutes');

-- Normalize Thread 1 counters to intended seed state (trigger fires during INSERTs above).
UPDATE chat_threads
SET last_message_at       = now() - interval '10 minutes',
    unread_merchant_count = 1,
    unread_user_count     = 0
WHERE id = '00000000-0000-0000-0000-chat00000001';

-- ── Thread 2: E2E customer ↔ Ravi Tiffin Centre (seed merchant user 001) ─────
INSERT INTO chat_threads (id, user_id, merchant_id, last_message_at)
SELECT
  '00000000-0000-0000-0000-chat00000002',
  '00000000-0000-0000-0000-e2e000000001',
  m.id,
  now() - interval '2 hours'
FROM merchants m WHERE m.user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO chat_messages (thread_id, sender_id, content, read_by_user, read_by_merchant, created_at) VALUES
  ('00000000-0000-0000-0000-chat00000002', '00000000-0000-0000-0000-e2e000000001',
   'What time do you open on Sundays?', true, true, now() - interval '5 hours'),
  ('00000000-0000-0000-0000-chat00000002', '00000000-0000-0000-0000-000000000001',
   'We open at 7 AM on Sundays. Breakfast served till 11 AM.', true, true, now() - interval '4 hours 50 minutes'),
  ('00000000-0000-0000-0000-chat00000002', '00000000-0000-0000-0000-e2e000000001',
   'Do you have the weekend special idli offer?', true, true, now() - interval '4 hours 45 minutes'),
  ('00000000-0000-0000-0000-chat00000002', '00000000-0000-0000-0000-000000000001',
   'Yes! Buy 2 idli plates get 1 free on weekends.', true, true, now() - interval '4 hours 40 minutes'),
  ('00000000-0000-0000-0000-chat00000002', '00000000-0000-0000-0000-000000000001',
   'We also added new filter coffee to the menu. Do try it!', true, false, now() - interval '2 hours');

-- Normalize Thread 2 counters to intended seed state.
UPDATE chat_threads
SET last_message_at       = now() - interval '2 hours',
    unread_user_count     = 1,
    unread_merchant_count = 0
WHERE id = '00000000-0000-0000-0000-chat00000002';

-- Verify Sprint 9 seed:
-- SELECT count(*) FROM chat_threads  WHERE user_id = '00000000-0000-0000-0000-e2e000000001'; -- Expected: 2
-- SELECT count(*) FROM chat_messages WHERE thread_id = '00000000-0000-0000-0000-chat00000001'; -- Expected: 5
-- SELECT count(*) FROM chat_messages WHERE thread_id = '00000000-0000-0000-0000-chat00000002'; -- Expected: 5

COMMIT;
