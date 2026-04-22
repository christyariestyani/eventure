-- ============================================================
-- Eventure — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  phone        VARCHAR(20),
  full_name    VARCHAR(255) NOT NULL,
  avatar_url   TEXT,
  preferences  JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE IF NOT EXISTS venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  address     TEXT NOT NULL,
  latitude    DECIMAL(10, 8) NOT NULL,
  longitude   DECIMAL(11, 8) NOT NULL,
  capacity    INTEGER,
  amenities   JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_city ON venues(city);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TYPE event_category AS ENUM ('music', 'sports', 'festival', 'conference');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'sold_out', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  venue_id      UUID REFERENCES venues(id) ON DELETE RESTRICT NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  category      event_category NOT NULL,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  banner_url    TEXT,
  status        event_status NOT NULL DEFAULT 'draft',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_event_dates CHECK (end_at > start_at)
);

CREATE INDEX idx_events_status_start ON events(status, start_at);
CREATE INDEX idx_events_venue ON events(venue_id);
CREATE INDEX idx_events_tags ON events USING GIN(tags);
CREATE INDEX idx_events_fts ON events USING GIN(to_tsvector('english', title));

-- ============================================================
-- TICKET TIERS
-- ============================================================
CREATE TYPE tier_status AS ENUM ('available', 'sold_out', 'paused');

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  price           DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
  total_quota     INTEGER NOT NULL CHECK (total_quota > 0),
  reserved_quota  INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quota >= 0),
  sold_quota      INTEGER NOT NULL DEFAULT 0 CHECK (sold_quota >= 0),
  max_per_user    INTEGER NOT NULL DEFAULT 4,
  status          tier_status NOT NULL DEFAULT 'available',
  benefits        JSONB NOT NULL DEFAULT '[]',
  sale_start_at   TIMESTAMPTZ,
  sale_end_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quota_consistency
    CHECK (reserved_quota + sold_quota <= total_quota)
);

-- Computed column: available tickets
ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS available_quota INTEGER
  GENERATED ALWAYS AS (total_quota - reserved_quota - sold_quota) STORED;

CREATE INDEX idx_ticket_tiers_event ON ticket_tiers(event_id);

-- ============================================================
-- ACCOMMODATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS accommodations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  type             VARCHAR(50),
  city             VARCHAR(100) NOT NULL,
  address          TEXT NOT NULL,
  latitude         DECIMAL(10, 8) NOT NULL,
  longitude        DECIMAL(11, 8) NOT NULL,
  star_rating      SMALLINT CHECK (star_rating BETWEEN 1 AND 5),
  base_price       DECIMAL(12, 2) NOT NULL CHECK (base_price >= 0),
  image_urls       TEXT[] NOT NULL DEFAULT '{}',
  amenities        JSONB NOT NULL DEFAULT '[]',
  external_id      VARCHAR(255),
  external_source  VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accommodations_city ON accommodations(city);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TYPE booking_status AS ENUM (
  'pending', 'awaiting_payment', 'confirmed', 'completed', 'cancelled', 'refunded'
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  booking_number  VARCHAR(20) UNIQUE NOT NULL,
  status          booking_status NOT NULL DEFAULT 'pending',
  total_amount    DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
  platform_fee    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(50),
  payment_ref     VARCHAR(255),
  paid_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_number ON bookings(booking_number);
-- Partial index: only index pending bookings for expiry job
CREATE INDEX idx_bookings_pending_expires ON bookings(expires_at)
  WHERE status IN ('pending', 'awaiting_payment');

-- ============================================================
-- BOOKING ITEMS
-- ============================================================
CREATE TYPE item_type AS ENUM ('ticket', 'accommodation', 'transport');

CREATE TABLE IF NOT EXISTS booking_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  item_type         item_type NOT NULL,
  ticket_tier_id    UUID REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  accommodation_id  UUID REFERENCES accommodations(id) ON DELETE RESTRICT,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal          DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_items_booking ON booking_items(booking_id);
CREATE INDEX idx_booking_items_tier ON booking_items(ticket_tier_id) WHERE ticket_tier_id IS NOT NULL;

-- ============================================================
-- TICKETS (issued after payment confirmed)
-- ============================================================
CREATE TYPE ticket_status AS ENUM ('issued', 'used', 'cancelled', 'transferred');

CREATE TABLE IF NOT EXISTS tickets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_item_id  UUID REFERENCES booking_items(id) ON DELETE RESTRICT NOT NULL,
  user_id          UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
  tier_id          UUID REFERENCES ticket_tiers(id) ON DELETE RESTRICT NOT NULL,
  qr_code          VARCHAR(500) UNIQUE NOT NULL,
  status           ticket_status NOT NULL DEFAULT 'issued',
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_qr ON tickets(qr_code);
CREATE INDEX idx_tickets_tier ON tickets(tier_id);

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

-- Increment reserved quota atomically
CREATE OR REPLACE FUNCTION increment_reserved_quota(p_tier_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ticket_tiers
  SET reserved_quota = reserved_quota + p_quantity
  WHERE id = p_tier_id
    AND (reserved_quota + sold_quota + p_quantity) <= total_quota;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Confirm ticket sale: move from reserved → sold
CREATE OR REPLACE FUNCTION confirm_ticket_sale(p_tier_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ticket_tiers
  SET
    reserved_quota = GREATEST(0, reserved_quota - p_quantity),
    sold_quota = sold_quota + p_quantity,
    status = CASE
      WHEN (sold_quota + p_quantity) >= total_quota THEN 'sold_out'::tier_status
      ELSE status
    END
  WHERE id = p_tier_id;
END;
$$ LANGUAGE plpgsql;

-- Release reserved quota (booking expired or cancelled)
CREATE OR REPLACE FUNCTION release_reserved_quota(p_tier_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ticket_tiers
  SET
    reserved_quota = GREATEST(0, reserved_quota - p_quantity),
    status = CASE
      WHEN status = 'sold_out' AND (total_quota - sold_quota - GREATEST(0, reserved_quota - p_quantity)) > 0
        THEN 'available'::tier_status
      ELSE status
    END
  WHERE id = p_tier_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
