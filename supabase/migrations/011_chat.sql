-- 011_chat.sql
-- Chat layer: chat_threads and chat_messages tables.
-- SECURITY DEFINER helper function for participant checks.
-- RLS policies enforce participant-only access on both tables.
-- BEFORE INSERT trigger maintains denormalized counters and auto-marks sender's read flag.
-- Realtime enabled on chat_messages for live message delivery.

-- ---------------------------------------------------------------------------
-- chat_threads
-- One thread per (user_id, merchant_id) pair — enforced by UNIQUE constraint.
-- user_id is the customer; merchant owner found via merchants.user_id.
-- Separate int counters for unread (not booleans) to support UI count display.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_threads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id           UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  last_message_at       TIMESTAMPTZ DEFAULT now(),
  unread_user_count     INT NOT NULL DEFAULT 0 CHECK (unread_user_count >= 0),
  unread_merchant_count INT NOT NULL DEFAULT 0 CHECK (unread_merchant_count >= 0),
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);

-- ---------------------------------------------------------------------------
-- chat_messages
-- read_by_user / read_by_merchant are separate booleans (NOT is_read).
-- content CHECK prevents empty or whitespace-only messages.
-- Messages are immutable — no updated_at column.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL CHECK (length(trim(content)) > 0),
  read_by_user     BOOLEAN NOT NULL DEFAULT false,
  read_by_merchant BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- is_chat_participant()
-- SECURITY DEFINER: resolves merchant owner without exposing rows.
-- Returns true if auth.uid() is either the thread customer or the merchant owner.
-- Defined BEFORE the RLS policies that reference it, so the function exists
-- when policies are evaluated (important during supabase db reset).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_chat_participant(p_thread_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id           UUID;
  v_merchant_owner_id UUID;
BEGIN
  SELECT ct.user_id, m.user_id
  INTO v_user_id, v_merchant_owner_id
  FROM chat_threads ct
  JOIN merchants m ON m.id = ct.merchant_id
  WHERE ct.id = p_thread_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN auth.uid() IN (v_user_id, v_merchant_owner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE chat_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_threads: SELECT — caller is the customer or the merchant owner
CREATE POLICY chat_threads_select ON chat_threads FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM merchants WHERE id = chat_threads.merchant_id AND user_id = auth.uid()
    )
  );

-- chat_threads: INSERT — caller must be the customer side
CREATE POLICY chat_threads_insert ON chat_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- chat_threads: UPDATE — caller is the customer or the merchant owner (mark-read counter reset)
CREATE POLICY chat_threads_update ON chat_threads FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM merchants WHERE id = chat_threads.merchant_id AND user_id = auth.uid()
    )
  );

-- No DELETE policy on chat_threads: threads are immutable from the user side.
-- Deletion only happens via CASCADE when the associated profile or merchant is deleted.
-- Users cannot manually delete a thread in the MVP.

-- chat_messages: SELECT — caller must be a participant of the thread
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT TO authenticated
  USING (is_chat_participant(thread_id));

-- chat_messages: INSERT — sender must be self and a participant
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_participant(thread_id)
  );

-- chat_messages: UPDATE — caller must be a participant (mark-read)
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE TO authenticated
  USING (is_chat_participant(thread_id));

-- No DELETE policy on chat_messages: messages are immutable (no updated_at either).
-- Message cleanup only occurs via CASCADE when the parent chat_thread is deleted.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_threads_user      ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_merchant  ON chat_threads(merchant_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_msg  ON chat_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread   ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender   ON chat_messages(sender_id);

-- ---------------------------------------------------------------------------
-- Trigger: update_chat_thread_on_message
-- BEFORE INSERT so it can mutate NEW.read_by_user / NEW.read_by_merchant.
-- Determines sender role (customer vs merchant owner) and:
--   customer sends  → increments unread_merchant_count; marks message read by sender
--   merchant sends  → increments unread_user_count;     marks message read by sender
--   unknown sender  → only updates last_message_at (safety fallback)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_chat_thread_on_message()
RETURNS TRIGGER AS $$
DECLARE
  v_thread_user_id    UUID;
  v_merchant_owner_id UUID;
BEGIN
  SELECT ct.user_id, m.user_id
  INTO v_thread_user_id, v_merchant_owner_id
  FROM chat_threads ct
  JOIN merchants m ON m.id = ct.merchant_id
  WHERE ct.id = NEW.thread_id;

  -- Guard: thread not found (should not happen due to FK, but be explicit)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = v_thread_user_id THEN
    -- Customer sent → merchant has unread; auto-mark as read by sender (customer)
    UPDATE chat_threads
    SET last_message_at       = NEW.created_at,
        unread_merchant_count = unread_merchant_count + 1
    WHERE id = NEW.thread_id;
    NEW.read_by_user := true;

  ELSIF NEW.sender_id = v_merchant_owner_id THEN
    -- Merchant sent → customer has unread; auto-mark as read by sender (merchant)
    UPDATE chat_threads
    SET last_message_at   = NEW.created_at,
        unread_user_count = unread_user_count + 1
    WHERE id = NEW.thread_id;
    NEW.read_by_merchant := true;

  ELSE
    -- Fallback: unknown sender — only refresh last_message_at
    UPDATE chat_threads
    SET last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_chat_thread_on_message
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_thread_on_message();

-- ---------------------------------------------------------------------------
-- Realtime
-- Enables Supabase Realtime postgres_changes subscription on chat_messages.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
