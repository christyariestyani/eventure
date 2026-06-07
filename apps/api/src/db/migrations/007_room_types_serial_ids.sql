-- ============================================================
-- MIGRASI LENGKAP: UUID → Serial Integer untuk semua tabel
-- Jalankan di Supabase SQL Editor
--
-- Yang TIDAK berubah:
--   • users.id          → tetap UUID (diikat Supabase Auth)
--   • *_id yang referensi users → tetap UUID
--
-- Yang berubah:
--   • venues, events, ticket_tiers, accommodations → BIGSERIAL
--   • bookings, booking_items, tickets             → BIGSERIAL
--   • user_behavior                                → BIGSERIAL
--   • room_types                                   → SERIAL (sudah di-drop/recreate)
-- ============================================================

BEGIN;

-- ============================================================
-- FASE 1 — Tambah kolom integer PK baru di semua tabel utama
-- ============================================================

ALTER TABLE venues        ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE events        ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE ticket_tiers  ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE bookings      ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE tickets       ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;
ALTER TABLE user_behavior ADD COLUMN IF NOT EXISTS _new_id BIGSERIAL;

-- accommodations: gunakan acc_no SERIAL yang sudah ada (dari migrasi sebelumnya)
-- Jika belum ada, buat sekarang
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS acc_no SERIAL;

-- ============================================================
-- FASE 2 — Tambah kolom FK integer di child tables & populate
-- ============================================================

-- events → venues
ALTER TABLE events ADD COLUMN IF NOT EXISTS _venue_id BIGINT;
UPDATE events e SET _venue_id = v._new_id FROM venues v WHERE e.venue_id = v.id AND e._venue_id IS NULL;
ALTER TABLE events ALTER COLUMN _venue_id SET NOT NULL;

-- ticket_tiers → events
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS _event_id BIGINT;
UPDATE ticket_tiers tt SET _event_id = e._new_id FROM events e WHERE tt.event_id = e.id AND tt._event_id IS NULL;
ALTER TABLE ticket_tiers ALTER COLUMN _event_id SET NOT NULL;

-- user_behavior → events
ALTER TABLE user_behavior ADD COLUMN IF NOT EXISTS _event_id BIGINT;
UPDATE user_behavior ub SET _event_id = e._new_id FROM events e WHERE ub.event_id = e.id AND ub._event_id IS NULL;

-- saved_events → events
ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS _event_id BIGINT;
UPDATE saved_events se SET _event_id = e._new_id FROM events e WHERE se.event_id = e.id AND se._event_id IS NULL;

-- booking_items → bookings
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS _booking_id BIGINT;
UPDATE booking_items bi SET _booking_id = b._new_id FROM bookings b WHERE bi.booking_id = b.id AND bi._booking_id IS NULL;
ALTER TABLE booking_items ALTER COLUMN _booking_id SET NOT NULL;

-- booking_items → ticket_tiers (nullable)
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS _ticket_tier_id BIGINT;
UPDATE booking_items bi SET _ticket_tier_id = tt._new_id
  FROM ticket_tiers tt WHERE bi.ticket_tier_id = tt.id AND bi._ticket_tier_id IS NULL;

-- booking_items → accommodations (via acc_no)
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS _accommodation_id BIGINT;
UPDATE booking_items bi SET _accommodation_id = a.acc_no
  FROM accommodations a WHERE bi.accommodation_id = a.id AND bi._accommodation_id IS NULL;

-- tickets → booking_items
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS _booking_item_id BIGINT;
UPDATE tickets t SET _booking_item_id = bi._new_id FROM booking_items bi WHERE t.booking_item_id = bi.id AND t._booking_item_id IS NULL;
ALTER TABLE tickets ALTER COLUMN _booking_item_id SET NOT NULL;

-- tickets → ticket_tiers
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS _tier_id BIGINT;
UPDATE tickets t SET _tier_id = tt._new_id FROM ticket_tiers tt WHERE t.tier_id = tt.id AND t._tier_id IS NULL;
ALTER TABLE tickets ALTER COLUMN _tier_id SET NOT NULL;

-- ============================================================
-- FASE 3 — Drop semua FK constraint lama (UUID-based)
-- ============================================================

ALTER TABLE events        DROP CONSTRAINT IF EXISTS events_venue_id_fkey;
ALTER TABLE events        DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE ticket_tiers  DROP CONSTRAINT IF EXISTS ticket_tiers_event_id_fkey;
ALTER TABLE saved_events  DROP CONSTRAINT IF EXISTS saved_events_event_id_fkey;
ALTER TABLE saved_events  DROP CONSTRAINT IF EXISTS saved_events_user_id_fkey;
ALTER TABLE user_behavior DROP CONSTRAINT IF EXISTS user_behavior_event_id_fkey;
ALTER TABLE user_behavior DROP CONSTRAINT IF EXISTS user_behavior_user_id_fkey;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_booking_id_fkey;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_ticket_tier_id_fkey;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_accommodation_id_fkey;
ALTER TABLE bookings       DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE tickets        DROP CONSTRAINT IF EXISTS tickets_booking_item_id_fkey;
ALTER TABLE tickets        DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE tickets        DROP CONSTRAINT IF EXISTS tickets_tier_id_fkey;
ALTER TABLE room_types    DROP CONSTRAINT IF EXISTS room_types_accommodation_id_fkey;

-- ============================================================
-- FASE 4 — Swap UUID PK → BIGSERIAL/SERIAL untuk setiap tabel
-- ============================================================

-- ── venues ──────────────────────────────────────────────────
ALTER TABLE venues DROP CONSTRAINT venues_pkey;
ALTER TABLE venues DROP COLUMN id;
ALTER TABLE venues RENAME COLUMN _new_id TO id;
ALTER TABLE venues ADD PRIMARY KEY (id);
ALTER TABLE venues DROP COLUMN IF EXISTS _venue_id;   -- bersihkan sisa kolom temp jika ada

-- ── events ──────────────────────────────────────────────────
ALTER TABLE events DROP CONSTRAINT events_pkey;
ALTER TABLE events DROP COLUMN id;                    -- drop UUID id
ALTER TABLE events DROP COLUMN venue_id;              -- drop UUID FK
ALTER TABLE events RENAME COLUMN _new_id   TO id;
ALTER TABLE events RENAME COLUMN _venue_id TO venue_id;
ALTER TABLE events ADD PRIMARY KEY (id);

-- ── ticket_tiers ─────────────────────────────────────────────
-- Perlu drop generated column dulu sebelum restrukturisasi
ALTER TABLE ticket_tiers DROP COLUMN IF EXISTS available_quota;
ALTER TABLE ticket_tiers DROP CONSTRAINT ticket_tiers_pkey;
ALTER TABLE ticket_tiers DROP COLUMN id;
ALTER TABLE ticket_tiers DROP COLUMN event_id;
ALTER TABLE ticket_tiers RENAME COLUMN _new_id   TO id;
ALTER TABLE ticket_tiers RENAME COLUMN _event_id TO event_id;
ALTER TABLE ticket_tiers ADD PRIMARY KEY (id);
-- Re-add generated column
ALTER TABLE ticket_tiers
  ADD COLUMN available_quota INTEGER
  GENERATED ALWAYS AS (total_quota - reserved_quota - sold_quota) STORED;

-- ── accommodations ───────────────────────────────────────────
-- Hapus semua tabel yang FK ke accommodations.id (UUID) dulu sudah di-drop di FASE 3
ALTER TABLE accommodations DROP CONSTRAINT accommodations_pkey;
ALTER TABLE accommodations DROP COLUMN id;            -- drop UUID
ALTER TABLE accommodations RENAME COLUMN acc_no TO id;
ALTER TABLE accommodations ADD PRIMARY KEY (id);

-- ── room_types ───────────────────────────────────────────────
-- Drop lama, recreate dengan struktur bersih
DROP TABLE IF EXISTS room_types CASCADE;
CREATE TABLE room_types (
  id               SERIAL PRIMARY KEY,
  accommodation_id INTEGER NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  bed_type         VARCHAR(50) NOT NULL DEFAULT 'Double Bed',
  max_occupancy    SMALLINT NOT NULL DEFAULT 2,
  price_per_night  DECIMAL(12, 2) NOT NULL,
  amenities        TEXT[] NOT NULL DEFAULT '{}',
  image_urls       TEXT[] NOT NULL DEFAULT '{}',
  is_available     BOOLEAN NOT NULL DEFAULT true,
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_room_types_accommodation ON room_types(accommodation_id);

-- Seed ulang room_types
INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT id, 'Kamar Standar',
  'Kamar nyaman dengan fasilitas lengkap dan pemandangan kota.',
  'Double Bed', 2, base_price,
  ARRAY['WiFi Gratis','AC','TV 32"','Kamar Mandi Dalam','Air Panas'], 1
FROM accommodations;

INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT id, 'Kamar Deluxe',
  'Kamar lebih luas dengan dekorasi modern dan fasilitas premium.',
  'King Bed', 2, ROUND(base_price * 1.3),
  ARRAY['WiFi Gratis','AC','TV 43"','Mini Bar','Kamar Mandi Dalam','Bathtub','Air Panas','Sarapan'], 2
FROM accommodations;

INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT id, 'Suite',
  'Pengalaman menginap mewah dengan ruang tamu terpisah dan fasilitas eksklusif.',
  'King Bed', 3, ROUND(base_price * 1.8),
  ARRAY['WiFi Gratis','AC','TV 55"','Mini Bar','Living Room','Bathtub','Air Panas','Sarapan','Late Check-out'], 3
FROM accommodations WHERE star_rating >= 3;

-- ── bookings ─────────────────────────────────────────────────
ALTER TABLE bookings DROP CONSTRAINT bookings_pkey;
ALTER TABLE bookings DROP COLUMN id;
ALTER TABLE bookings RENAME COLUMN _new_id TO id;
ALTER TABLE bookings ADD PRIMARY KEY (id);

-- ── booking_items ─────────────────────────────────────────────
ALTER TABLE booking_items DROP CONSTRAINT booking_items_pkey;
ALTER TABLE booking_items DROP COLUMN id;
ALTER TABLE booking_items DROP COLUMN booking_id;
ALTER TABLE booking_items DROP COLUMN ticket_tier_id;
ALTER TABLE booking_items DROP COLUMN accommodation_id;
ALTER TABLE booking_items RENAME COLUMN _new_id          TO id;
ALTER TABLE booking_items RENAME COLUMN _booking_id      TO booking_id;
ALTER TABLE booking_items RENAME COLUMN _ticket_tier_id  TO ticket_tier_id;
ALTER TABLE booking_items RENAME COLUMN _accommodation_id TO accommodation_id;
ALTER TABLE booking_items ADD PRIMARY KEY (id);

-- ── tickets ──────────────────────────────────────────────────
ALTER TABLE tickets DROP CONSTRAINT tickets_pkey;
ALTER TABLE tickets DROP COLUMN id;
ALTER TABLE tickets DROP COLUMN booking_item_id;
ALTER TABLE tickets DROP COLUMN tier_id;
ALTER TABLE tickets RENAME COLUMN _new_id           TO id;
ALTER TABLE tickets RENAME COLUMN _booking_item_id  TO booking_item_id;
ALTER TABLE tickets RENAME COLUMN _tier_id          TO tier_id;
ALTER TABLE tickets ADD PRIMARY KEY (id);

-- ── user_behavior ─────────────────────────────────────────────
ALTER TABLE user_behavior DROP CONSTRAINT user_behavior_pkey;
ALTER TABLE user_behavior DROP COLUMN id;
ALTER TABLE user_behavior DROP COLUMN event_id;
ALTER TABLE user_behavior RENAME COLUMN _new_id   TO id;
ALTER TABLE user_behavior RENAME COLUMN _event_id TO event_id;
ALTER TABLE user_behavior ADD PRIMARY KEY (id);

-- ── saved_events ──────────────────────────────────────────────
ALTER TABLE saved_events DROP CONSTRAINT saved_events_pkey;
ALTER TABLE saved_events DROP COLUMN event_id;               -- drop UUID event_id
ALTER TABLE saved_events RENAME COLUMN _event_id TO event_id; -- pakai BIGINT
ALTER TABLE saved_events ADD PRIMARY KEY (user_id, event_id); -- user_id tetap UUID

-- ============================================================
-- FASE 5 — Re-add semua FK constraint dengan tipe baru
-- Drop dulu (IF EXISTS) sebelum add agar idempotent
-- ============================================================

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_venue_id_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_venue_id_fkey
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE RESTRICT,
  ADD CONSTRAINT events_organizer_id_fkey
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ticket_tiers DROP CONSTRAINT IF EXISTS ticket_tiers_event_id_fkey;
ALTER TABLE ticket_tiers
  ADD CONSTRAINT ticket_tiers_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE saved_events DROP CONSTRAINT IF EXISTS saved_events_user_id_fkey;
ALTER TABLE saved_events DROP CONSTRAINT IF EXISTS saved_events_event_id_fkey;
ALTER TABLE saved_events
  ADD CONSTRAINT saved_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT saved_events_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE user_behavior DROP CONSTRAINT IF EXISTS user_behavior_user_id_fkey;
ALTER TABLE user_behavior DROP CONSTRAINT IF EXISTS user_behavior_event_id_fkey;
ALTER TABLE user_behavior
  ADD CONSTRAINT user_behavior_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_behavior_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_booking_id_fkey;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_ticket_tier_id_fkey;
ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_accommodation_id_fkey;
ALTER TABLE booking_items
  ADD CONSTRAINT booking_items_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  ADD CONSTRAINT booking_items_ticket_tier_id_fkey
    FOREIGN KEY (ticket_tier_id) REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT booking_items_accommodation_id_fkey
    FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE RESTRICT;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_booking_item_id_fkey;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tier_id_fkey;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_booking_item_id_fkey
    FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tickets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tickets_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE RESTRICT;

-- ============================================================
-- FASE 6 — Recreate indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_status_start    ON events(status, start_at);
CREATE INDEX IF NOT EXISTS idx_events_venue           ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_tags            ON events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_fts             ON events USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event     ON ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user          ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_number        ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_pending_exp   ON bookings(expires_at) WHERE status IN ('pending','awaiting_payment');
CREATE INDEX IF NOT EXISTS idx_booking_items_booking  ON booking_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_tier     ON booking_items(ticket_tier_id) WHERE ticket_tier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_user           ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr             ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_tier           ON tickets(tier_id);

-- ============================================================
-- FASE 7 — Update stored procedures (UUID → BIGINT)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_reserved_quota(p_tier_id BIGINT, p_quantity INTEGER)
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

CREATE OR REPLACE FUNCTION confirm_ticket_sale(p_tier_id BIGINT, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ticket_tiers
  SET
    reserved_quota = GREATEST(0, reserved_quota - p_quantity),
    sold_quota     = sold_quota + p_quantity,
    status = CASE
      WHEN (sold_quota + p_quantity) >= total_quota THEN 'sold_out'::tier_status
      ELSE status
    END
  WHERE id = p_tier_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_reserved_quota(p_tier_id BIGINT, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE ticket_tiers
  SET
    reserved_quota = GREATEST(0, reserved_quota - p_quantity),
    status = CASE
      WHEN status = 'sold_out'
        AND (total_quota - sold_quota - GREATEST(0, reserved_quota - p_quantity)) > 0
        THEN 'available'::tier_status
      ELSE status
    END
  WHERE id = p_tier_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFIKASI
-- ============================================================

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN ('venues','events','ticket_tiers','accommodations',
                     'bookings','booking_items','tickets','user_behavior','room_types')
ORDER BY table_name;

COMMIT;
