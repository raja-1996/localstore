-- 007_services_portfolio.sql
-- Two supporting tables for a merchant's offerings:
--   services        — bookable/purchasable items with price and cancellation policy
--   portfolio_images — gallery images showcasing past work

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
CREATE TABLE services (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  price                NUMERIC(10,2) CHECK (price >= 0),
  -- e.g. 'per hour', 'per visit', 'fixed' — free-form, not an enum
  price_unit           TEXT,
  image_url            TEXT,
  is_available         BOOLEAN DEFAULT true,
  cancellation_policy  TEXT,
  -- Percentage of total price collected upfront at booking
  advance_percent      INT DEFAULT 20 CHECK (advance_percent BETWEEN 0 AND 100),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read; write restricted to the merchant owner
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY services_select ON services FOR SELECT USING (true);
CREATE POLICY services_insert ON services FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE id = services.merchant_id AND user_id = auth.uid()
  ));
CREATE POLICY services_update ON services FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = services.merchant_id AND user_id = auth.uid()
  ));
CREATE POLICY services_delete ON services FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = services.merchant_id AND user_id = auth.uid()
  ));

-- List all services for a given merchant
CREATE INDEX idx_services_merchant   ON services(merchant_id);
-- Filter available services per merchant without a full table scan
CREATE INDEX idx_services_available  ON services(merchant_id, is_available);

CREATE TRIGGER services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- portfolio_images
-- ---------------------------------------------------------------------------
CREATE TABLE portfolio_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  caption      TEXT,
  -- Lower value = displayed first
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read; write restricted to the merchant owner
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolio_select ON portfolio_images FOR SELECT USING (true);
CREATE POLICY portfolio_insert ON portfolio_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE id = portfolio_images.merchant_id AND user_id = auth.uid()
  ));
CREATE POLICY portfolio_update ON portfolio_images FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = portfolio_images.merchant_id AND user_id = auth.uid()
  ));
CREATE POLICY portfolio_delete ON portfolio_images FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = portfolio_images.merchant_id AND user_id = auth.uid()
  ));

-- Fetch all gallery images for a merchant ordered by sort_order
CREATE INDEX idx_portfolio_merchant ON portfolio_images(merchant_id);
