-- 012_orders.sql
-- Orders layer: orders and payment_events tables.
-- orders: full order lifecycle with Razorpay payment fields and generated balance_amount.
-- payment_events: immutable webhook audit log; service role only (no user-facing policies).
-- RLS on orders enforces participant access (customer or merchant owner).
-- updated_at trigger on orders; Realtime enabled for live status updates.

-- ---------------------------------------------------------------------------
-- orders
-- balance_amount is GENERATED ALWAYS AS (total_amount - advance_amount) STORED.
-- CHECK constraint ensures advance_amount never exceeds total_amount.
-- merchant_id is set server-side from service_id — not provided by client directly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  merchant_id                  UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  service_id                   UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  status                       TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
                                 'pending_payment', 'confirmed', 'in_progress',
                                 'ready', 'delivered', 'cancelled', 'refunded'
                               )),
  quantity                     INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_amount                 NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  advance_amount               NUMERIC(10,2) NOT NULL CHECK (advance_amount >= 0),
  balance_amount               NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - advance_amount) STORED,
  requirements_text            TEXT,
  requirements_image_url       TEXT,
  razorpay_order_id            TEXT,
  razorpay_payment_id          TEXT,
  refund_id                    TEXT,
  scheduled_at                 TIMESTAMPTZ,
  cancellation_policy_snapshot TEXT,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_advance_lte_total CHECK (advance_amount <= total_amount)
);

-- ---------------------------------------------------------------------------
-- payment_events
-- Append-only Razorpay webhook audit log.
-- razorpay_event_id UNIQUE prevents duplicate webhook processing.
-- No updated_at — events are immutable once recorded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID REFERENCES orders(id),
  event_type        TEXT NOT NULL,
  razorpay_event_id TEXT UNIQUE,
  payload           JSONB,
  processed_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- orders: SELECT — caller is the customer or the merchant owner
CREATE POLICY orders_select ON orders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM merchants WHERE id = orders.merchant_id AND user_id = auth.uid()
    )
  );

-- orders: INSERT — caller must be the customer placing the order
CREATE POLICY orders_insert ON orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- orders: UPDATE — merchant owner can update status; customer can cancel only when still early
-- NOTE: Column-level restrictions (preventing customer from modifying total_amount,
-- advance_amount, balance_amount, merchant_id, etc.) cannot be enforced by Postgres RLS,
-- which operates at the row level only. These restrictions MUST be enforced at the API layer
-- (route handler or service) before any UPDATE is issued against this table.
CREATE POLICY orders_update ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM merchants WHERE id = orders.merchant_id AND user_id = auth.uid()
    )
    OR (
      user_id = auth.uid()
      AND status IN ('pending_payment', 'confirmed')
    )
  );

-- payment_events: no user-facing policies.
-- Service role bypasses RLS automatically; users get no access whatsoever.
-- Do NOT add SELECT/INSERT policies here — that would expose raw payment data to users.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_created      ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_status   ON orders(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_order     ON payment_events(order_id);

-- ---------------------------------------------------------------------------
-- Trigger: updated_at on orders
-- Reuses the shared update_updated_at() function created in 001_initial_schema.sql.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime
-- Enables Supabase Realtime postgres_changes subscription on orders
-- so the app receives live order status updates.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
