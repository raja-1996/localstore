-- 005_profiles.sql
-- Extend the existing `profiles` table with LocalStore-specific fields.
-- DO NOT recreate — profiles already exists from 001_initial_schema.sql.

-- Add merchant-related and localisation columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommendation_count INT DEFAULT 0;

-- Index on phone for fast lookup during sign-in / WhatsApp contact
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Trigram GIN index on full_name for fuzzy search (requires pg_trgm from 004)
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON profiles USING GIN (full_name gin_trgm_ops);

-- Update the signup trigger to also capture the phone number that Supabase
-- passes via auth.users.phone (populated when SMS/phone auth is used).
-- CREATE OR REPLACE is safe here — trigger already exists from 001.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
