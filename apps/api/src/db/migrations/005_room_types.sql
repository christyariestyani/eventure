-- ============================================================
-- ROOM TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS room_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
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

-- ============================================================
-- SEED: Room types for each accommodation (3 tiers per hotel)
-- Standard ≈ base_price, Deluxe ≈ base_price × 1.3, Suite ≈ base_price × 1.8
-- ============================================================

INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT
  id,
  'Kamar Standar',
  'Kamar nyaman dengan fasilitas lengkap dan pemandangan kota.',
  'Double Bed',
  2,
  base_price,
  ARRAY['WiFi Gratis','AC','TV 32"','Kamar Mandi Dalam','Air Panas'],
  1
FROM accommodations;

INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT
  id,
  'Kamar Deluxe',
  'Kamar lebih luas dengan dekorasi modern dan fasilitas premium.',
  'King Bed',
  2,
  ROUND(base_price * 1.3),
  ARRAY['WiFi Gratis','AC','TV 43"','Mini Bar','Kamar Mandi Dalam','Bathtub','Air Panas','Sarapan'],
  2
FROM accommodations;

INSERT INTO room_types (accommodation_id, name, description, bed_type, max_occupancy, price_per_night, amenities, sort_order)
SELECT
  id,
  'Suite',
  'Pengalaman menginap mewah dengan ruang tamu terpisah dan fasilitas eksklusif.',
  'King Bed',
  3,
  ROUND(base_price * 1.8),
  ARRAY['WiFi Gratis','AC','TV 55"','Mini Bar','Living Room','Bathtub','Air Panas','Sarapan','Late Check-out'],
  3
FROM accommodations
WHERE star_rating >= 3;
