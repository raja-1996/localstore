-- 006_merchants.sql
-- Core merchant entity: one merchant profile per user (user_id UNIQUE).
-- Location stored as PostGIS GEOGRAPHY(POINT) for radius-based queries.
-- Full-text search maintained via a TSVECTOR column updated by trigger.

CREATE TABLE merchants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One merchant account per user; cascade-delete when auth user is removed
  user_id               UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  -- Closed category list; extend via new migration, not ad-hoc inserts
  category              TEXT NOT NULL CHECK (category IN ('Food', 'Tailoring', 'Beauty', 'HomeServices', 'Events', 'Other')),
  tags                  TEXT[],
  -- WGS 84 point (longitude, latitude); GEOGRAPHY uses metres for distance ops
  location              GEOGRAPHY(POINT, 4326) NOT NULL,
  address_text          TEXT,
  neighborhood          TEXT,
  service_radius_meters INT DEFAULT 5000,
  phone                 TEXT,
  whatsapp              TEXT,
  avg_rating            NUMERIC(3,2) DEFAULT 0 CHECK (avg_rating BETWEEN 0 AND 5),
  review_count          INT DEFAULT 0 CHECK (review_count >= 0),
  follower_count        INT DEFAULT 0 CHECK (follower_count >= 0),
  response_time_minutes INT,
  is_verified           BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  video_intro_url       TEXT,
  -- Maintained by trg_merchant_search_vector (below); never written by app code
  search_vector         TSVECTOR,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- RLS: anyone can read; only the owning user can write
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchants_select ON merchants FOR SELECT USING (true);
CREATE POLICY merchants_insert ON merchants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY merchants_update ON merchants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY merchants_delete ON merchants FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Spatial index for ST_DWithin radius queries
CREATE INDEX idx_merchants_location  ON merchants USING GIST (location);
-- Equality filter on category
CREATE INDEX idx_merchants_category  ON merchants(category);
-- Full-text search
CREATE INDEX idx_merchants_search    ON merchants USING GIN (search_vector);
-- Filter active merchants cheaply
CREATE INDEX idx_merchants_active    ON merchants(is_active);
-- Fuzzy name search (requires pg_trgm from 004)
CREATE INDEX idx_merchants_name_trgm ON merchants USING GIN (name gin_trgm_ops);

-- Populate search_vector from name + description + tags before every write
CREATE OR REPLACE FUNCTION update_merchant_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_search_vector
  BEFORE INSERT OR UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_merchant_search_vector();

-- Reuse the shared update_updated_at() function from 001_initial_schema.sql
CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sync profiles.is_merchant when a merchant row is created or deleted
CREATE OR REPLACE FUNCTION sync_is_merchant()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET is_merchant = true WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET is_merchant = false WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_is_merchant
  AFTER INSERT OR DELETE ON merchants
  FOR EACH ROW EXECUTE FUNCTION sync_is_merchant();
