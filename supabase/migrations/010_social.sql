-- 010_social.sql
-- Social layer: follows, reviews, posts, likes, comments.
-- Triggers maintain denormalized counts (follower_count, avg_rating, like_count, comment_count).
-- All tables use auth.uid() RLS patterns consistent with 006–007 migrations.

-- ---------------------------------------------------------------------------
-- Defensive columns on merchants (already present in 006; no-op if exists)
-- ---------------------------------------------------------------------------
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0 CHECK (follower_count >= 0);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS avg_rating     NUMERIC(3,2) DEFAULT 0 CHECK (avg_rating BETWEEN 0 AND 5);

-- ---------------------------------------------------------------------------
-- follows
-- Composite PK prevents duplicate follows; no surrogate key needed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, merchant_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follow relationships (e.g. follower count displays)
CREATE POLICY follows_select ON follows FOR SELECT USING (true);

-- Users can only follow / unfollow as themselves
CREATE POLICY follows_insert ON follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY follows_delete ON follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_follows_merchant  ON follows(merchant_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);

-- ---------------------------------------------------------------------------
-- reviews
-- UNIQUE (reviewer_id, merchant_id) enforces one review per user per merchant.
-- Self-review prevention is enforced via RLS (see policy below).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reviewer_id  UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reviewer_id, merchant_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);

-- Authenticated users can insert a review only when:
--   1. reviewer_id matches the caller
--   2. caller is NOT the merchant owner (self-review prevention)
CREATE POLICY reviews_insert ON reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM merchants WHERE id = reviews.merchant_id AND user_id = auth.uid()
    )
  );

-- Users can only update their own reviews
CREATE POLICY reviews_update ON reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Users can only delete their own reviews
CREATE POLICY reviews_delete ON reviews FOR DELETE TO authenticated
  USING (reviewer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reviews_merchant  ON reviews(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer  ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created   ON reviews(created_at DESC);

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- posts
-- Merchant-authored content (updates or offers).
-- like_count / comment_count are denormalized and maintained by triggers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  image_url     TEXT,
  -- Optional link to a specific service being promoted
  service_id    UUID REFERENCES services(id) ON DELETE SET NULL,
  post_type     TEXT NOT NULL CHECK (post_type IN ('update', 'offer')),
  like_count    INT  NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count INT  NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read active posts; merchant owners can see their own inactive posts
CREATE POLICY posts_select ON posts FOR SELECT
  USING (
    is_active = true
    OR EXISTS (SELECT 1 FROM merchants WHERE id = posts.merchant_id AND user_id = auth.uid())
  );

-- Only the merchant owner can create posts for their merchant
CREATE POLICY posts_insert ON posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE id = posts.merchant_id AND user_id = auth.uid()
  ));

-- Only the merchant owner can update their posts
CREATE POLICY posts_update ON posts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = posts.merchant_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM merchants WHERE id = posts.merchant_id AND user_id = auth.uid()
  ));

-- Only the merchant owner can delete their posts
CREATE POLICY posts_delete ON posts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = posts.merchant_id AND user_id = auth.uid()
  ));

-- Feed query: list active posts per merchant ordered by time
CREATE INDEX IF NOT EXISTS idx_posts_merchant_created ON posts(merchant_id, created_at DESC);
-- Filter active posts quickly for feed queries
CREATE INDEX IF NOT EXISTS idx_posts_active           ON posts(is_active);
-- Find posts by service (for service detail pages)
CREATE INDEX IF NOT EXISTS idx_posts_service          ON posts(service_id);

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- likes
-- Composite PK prevents duplicate likes; no surrogate key needed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY likes_select ON likes FOR SELECT USING (true);

CREATE POLICY likes_insert ON likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY likes_delete ON likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Efficiently find all likes for a given post (e.g. count, is_liked_by_me checks)
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- ---------------------------------------------------------------------------
-- comments
-- Flat comment thread per post; no nesting in MVP.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON comments FOR SELECT USING (true);

CREATE POLICY comments_insert ON comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY comments_update ON comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY comments_delete ON comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- List all comments for a post ordered by time
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: update_follower_count
-- Increments or decrements merchants.follower_count on follows INSERT/DELETE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE merchants SET follower_count = follower_count + 1 WHERE id = NEW.merchant_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE merchants
      SET follower_count = GREATEST(follower_count - 1, 0)
    WHERE id = OLD.merchant_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_follower_count
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_count();

-- ---------------------------------------------------------------------------
-- Trigger: update_merchant_rating
-- Recalculates merchants.avg_rating and review_count after any review change.
-- Uses AVG() so partial deletes/updates stay accurate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_merchant_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  -- Determine which merchant is affected regardless of operation
  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.merchant_id;
  ELSE
    v_merchant_id := NEW.merchant_id;
  END IF;

  UPDATE merchants
  SET
    avg_rating   = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM reviews WHERE merchant_id = v_merchant_id), 0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE merchant_id = v_merchant_id)
  WHERE id = v_merchant_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_merchant_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_merchant_rating();

-- ---------------------------------------------------------------------------
-- Trigger: update_like_count
-- Increments or decrements posts.like_count on likes INSERT/DELETE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
      SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_like_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- ---------------------------------------------------------------------------
-- Trigger: update_comment_count
-- Increments or decrements posts.comment_count on comments INSERT/DELETE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
      SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();
