-- ============================================================
-- 005_db_fix.sql
-- Jalankan di Supabase SQL Editor
--
-- PENTING: Jangan jalankan 004_seed_fix.sql — data event sudah
-- berubah total, script itu akan overwrite dengan data lama.
-- ============================================================


-- ============================================================
-- 1. PERBAIKI KOORDINAT VENUE YANG SALAH
-- ============================================================

-- Venue 003 — Lodji Paris, Yogyakarta
--   Sebelumnya: lat=-0.75, lng=120.083 (lokasi di Sulawesi, SALAH)
--   Seharusnya: sekitar Jl. Diponegoro, Yogyakarta
UPDATE venues SET
  latitude  = -7.800280,
  longitude = 110.366200
WHERE id = '11111111-0000-0000-0000-000000000003';

-- Venue 005 — Stadion Manahan, Surakarta
--   Sebelumnya: longitude = -7.55556 (copy dari latitude, SALAH)
--   Seharusnya: longitude ~110.834
UPDATE venues SET
  latitude  = -7.555600,
  longitude = 110.834300
WHERE id = '11111111-0000-0000-0000-000000000005';

-- Venue 008 — Taman Wisata Candi Prambanan, Yogyakarta
--   Sebelumnya: latitude = 7.75 (positif, SALAH — harusnya negatif/Selatan)
UPDATE venues SET
  latitude  = -7.751794,
  longitude = 110.491697
WHERE id = '11111111-0000-0000-0000-000000000008';


-- ============================================================
-- 2. SERAGAMKAN CITY NAME DI ACCOMMODATIONS
--    Venue Solo Batik Run = city "Surakarta"
--    Venue Festival Seni Bali = city "Denpasar"
--    Hotel harus pakai kota yang sama agar muncul di checkout
-- ============================================================

-- Solo → Surakarta (agar match dengan venue Stadion Manahan)
UPDATE accommodations
SET city = 'Surakarta'
WHERE city = 'Solo';

-- Bali → Denpasar (agar match dengan venue Pusat Kebudayaan Bali)
UPDATE accommodations
SET city = 'Denpasar'
WHERE city = 'Bali';


-- ============================================================
-- 3. HAPUS DUPLIKAT ACCOMMODATION DI BANDUNG
--    Aryaduta Bandung & Ibis Trans Studio masing-masing muncul 2x
-- ============================================================

-- Hapus row duplikat yang lebih baru (created_at lebih besar)
DELETE FROM accommodations
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY name, city
             ORDER BY created_at ASC          -- keep oldest row
           ) AS rn
    FROM accommodations
  ) ranked
  WHERE rn > 1
);


-- ============================================================
-- 4. TAMBAH AKOMODASI YANG MASIH KURANG
--    Kota yang event-nya ada tapi hotel minim:
--    Jakarta (cukup), Yogyakarta (cukup), Makassar (3 ada),
--    Surakarta (3 ada setelah rename), Denpasar (2 ada setelah rename)
--    Pekalongan (2 ada) — OK
-- ============================================================

-- Tambah 1 pilihan budget di Makassar
INSERT INTO accommodations (name, type, city, address, latitude, longitude, star_rating, base_price)
VALUES
  ('MaxOne Hotel Makassar', 'hotel', 'Makassar', 'Jl. Gunung Bawakaraeng No.85, Makassar', -5.128490, 119.418780, 3, 430000),
  ('Amaris Hotel Makassar', 'hotel', 'Makassar', 'Jl. Pattimura No.3, Makassar',            -5.131180, 119.411060, 2, 320000)
ON CONFLICT DO NOTHING;

-- Tambah pilihan budget di Surakarta
INSERT INTO accommodations (name, type, city, address, latitude, longitude, star_rating, base_price)
VALUES
  ('Lorin Solo Hotel', 'hotel', 'Surakarta', 'Jl. Adisucipto No.47, Surakarta', -7.560940, 110.852040, 4, 780000),
  ('Amaris Hotel Solo', 'hotel', 'Surakarta', 'Jl. Slamet Riyadi No.354, Surakarta', -7.566790, 110.802560, 2, 280000)
ON CONFLICT DO NOTHING;

-- Tambah pilihan di Denpasar
INSERT INTO accommodations (name, type, city, address, latitude, longitude, star_rating, base_price)
VALUES
  ('Bali Dynasty Resort',    'hotel', 'Denpasar', 'Jl. Kartika Plaza, Kuta, Badung, Bali',       -8.724780, 115.172340, 4, 1100000),
  ('Ibis Styles Bali Kuta',  'hotel', 'Denpasar', 'Jl. Dewi Sri No.9, Kuta, Bali',               -8.724090, 115.169910, 3,  580000),
  ('Pop! Hotel Kuta Beach',  'hotel', 'Denpasar', 'Jl. Benesari No.1, Kuta, Bali',               -8.722440, 115.170110, 2,  320000)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Verifikasi
-- ============================================================

-- Cek koordinat venue sudah benar
SELECT id, name, city, latitude, longitude
FROM venues
ORDER BY id;

-- Cek hotel per kota (pastikan Surakarta & Denpasar ada)
SELECT city, COUNT(*) AS jumlah, MIN(base_price) AS min_price, MAX(base_price) AS max_price
FROM accommodations
GROUP BY city
ORDER BY city;

-- Pastikan tidak ada duplikat nama+kota
SELECT name, city, COUNT(*) AS cnt
FROM accommodations
GROUP BY name, city
HAVING COUNT(*) > 1;
