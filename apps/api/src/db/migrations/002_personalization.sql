-- 002_personalization.sql
-- Personalization system: user preferences, behavioral tracking, saved events

-- ─── User Preferences ──────────────────────────────────────────────────────────
-- Structured replacement for the loose preferences JSONB in users table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  event_types        TEXT[]  NOT NULL DEFAULT '{}',      -- ['music','sports','festival']
  subcategories      TEXT[]  NOT NULL DEFAULT '{}',      -- ['marathon','EDM','indie-concert']
  favorite_artists   TEXT[]  NOT NULL DEFAULT '{}',
  travel_style       VARCHAR(20) NOT NULL DEFAULT 'solo', -- solo|couple|group|family
  budget_tier        VARCHAR(20) NOT NULL DEFAULT 'mid',  -- budget|mid|premium|luxury
  budget_min         INTEGER NOT NULL DEFAULT 0,
  budget_max         INTEGER NOT NULL DEFAULT 2000000,
  accommodation_pref TEXT[]  NOT NULL DEFAULT '{}',      -- hotel|hostel|near_venue|aesthetic
  home_city          VARCHAR(100),
  preferred_cities   TEXT[]  NOT NULL DEFAULT '{}',
  onboarding_done    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Behavioral Events ─────────────────────────────────────────────────────────
-- Implicit signals: every interaction becomes a learning signal
CREATE TABLE IF NOT EXISTS user_behavior (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action      VARCHAR(30) NOT NULL,   -- view|save|unsave|book|dismiss|share|itinerary_view
  dwell_ms    INTEGER,                -- milliseconds on event detail screen
  session_id  VARCHAR(50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_user_time   ON user_behavior(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_event       ON user_behavior(event_id);
CREATE INDEX IF NOT EXISTS idx_behavior_user_action ON user_behavior(user_id, action);

-- ─── Saved Events (Wishlist) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_events (
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_events(user_id);

-- ─── Similarity Cache (for collaborative filtering) ────────────────────────────
-- Precomputed user-to-user similarity scores (refreshed periodically)
CREATE TABLE IF NOT EXISTS user_similarity (
  user_a     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      REAL    NOT NULL DEFAULT 0,           -- 0..1 Jaccard similarity
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_similarity_a ON user_similarity(user_a, score DESC);
