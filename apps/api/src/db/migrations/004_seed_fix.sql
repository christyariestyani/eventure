-- ============================================================
-- 004_seed_fix.sql
-- Jalankan di Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 1. PERBAIKI TANGGAL EVENT SEED YANG SUDAH LEWAT
-- ============================================================

-- Event 001: dulunya Coldplay (sekarang sudah di-rename ke Joyland Festival 2026)
--   start_at asli: 2025-02-15 → update ke 2026-05-30
UPDATE events SET
  start_at = '2026-05-30 14:00:00+07',
  end_at   = '2026-05-31 23:00:00+07',
  status   = 'published'
WHERE id = '22222222-0000-0000-0000-000000000001';

-- Event 002: Java Jazz (Pestapora setelah rename)
--   sudah memiliki tanggal yang benar: 2026-05-30 hingga 2026-06-01
--   pastikan status published
UPDATE events SET status = 'published'
WHERE id = '22222222-0000-0000-0000-000000000002';

-- Event 003: Borobudur Marathon (Mandiri Jogja Marathon setelah rename)
--   sudah 2026-11-15, OK
UPDATE events SET status = 'published'
WHERE id = '22222222-0000-0000-0000-000000000003';


-- ============================================================
-- 2. TAMBAH VENUE BARU (KOTA BARU)
-- ============================================================

INSERT INTO venues (id, name, city, address, latitude, longitude, capacity) VALUES
  ('11111111-0000-0000-0000-000000000004', 'Lapangan Karebosi',        'Makassar',  'Jl. Jenderal Ahmad Yani, Makassar',              -5.139440, 119.422120, 40000),
  ('11111111-0000-0000-0000-000000000005', 'Pantai Losari Makassar',   'Makassar',  'Jl. Penghibur, Losari, Makassar',                -5.147690, 119.405480, 30000),
  ('11111111-0000-0000-0000-000000000006', 'Alun-Alun Bandung',        'Bandung',   'Jl. Asia Afrika, Bandung',                       -6.921390, 107.606850, 50000),
  ('11111111-0000-0000-0000-000000000007', 'Pantai Kuta',              'Bali',      'Jl. Pantai Kuta, Kuta, Badung, Bali',            -8.718390, 115.168670, 25000),
  ('11111111-0000-0000-0000-000000000008', 'GOR Ken Arok',             'Malang',    'Jl. Ahmad Yani No.1, Malang',                    -7.973560, 112.633870, 10000),
  ('11111111-0000-0000-0000-000000000009', 'Stadion Gelora Delta',     'Sidoarjo',  'Jl. Raya Gelora, Sidoarjo',                      -7.448970, 112.718070, 30000),
  ('11111111-0000-0000-0000-000000000010', 'Pantai Parangtritis',      'Yogyakarta','Bantul, Yogyakarta',                              -8.024340, 110.333000, 20000)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 3. TAMBAH EVENT BARU DI BERBAGAI KOTA
-- ============================================================

INSERT INTO events (id, organizer_id, venue_id, title, category, tags, start_at, end_at, status, description) VALUES
  (
    '22222222-0000-0000-0000-000000000004',
    '33333333-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000004',
    'Makassar 10K Run 2026',
    'sports',
    ARRAY['lari','makassar','olahraga','10k','heritage'],
    '2026-08-09 06:00:00+08',
    '2026-08-09 11:00:00+08',
    'published',
    'Lari 10K tahunan di jantung kota Makassar melewati ikoniknya Lapangan Karebosi dan kawasan pesisir Losari. Terbuka untuk umum, tersedia kategori 5K dan 10K.'
  ),
  (
    '22222222-0000-0000-0000-000000000005',
    '33333333-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000006',
    'Bandung Indie Fest 2026',
    'music',
    ARRAY['indie','musik','bandung','festival','lokal'],
    '2026-07-18 15:00:00+07',
    '2026-07-18 23:00:00+07',
    'published',
    'Festival musik indie tahunan di Bandung. Menampilkan lebih dari 20 band lokal Bandung pilihan — dari post-rock, shoegaze, hingga folk akustik. Gratis parkir, tersedia food truck.'
  ),
  (
    '22222222-0000-0000-0000-000000000006',
    '33333333-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000007',
    'Bali Arts & Culture Festival 2026',
    'festival',
    ARRAY['seni','bali','budaya','festival','tari','lokal'],
    '2026-06-21 10:00:00+08',
    '2026-06-23 22:00:00+08',
    'published',
    'Festival seni dan budaya Bali selama 3 hari di tepi Pantai Kuta. Menampilkan tari kecak, legong, pertunjukan gamelan, pameran lukisan, dan bazaar kerajinan tangan Bali.'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 4. TAMBAH TICKET TIERS UNTUK EVENT BARU
-- ============================================================

INSERT INTO ticket_tiers (event_id, name, price, total_quota, max_per_user, status, benefits) VALUES
  -- Makassar 10K Run
  ('22222222-0000-0000-0000-000000000004', '10K Run', 175000, 2000, 2, 'available',
   '["Jersey premium","Medali finisher","Sertifikat digital","Race pack"]'),
  ('22222222-0000-0000-0000-000000000004', '5K Fun Run', 100000, 3000, 4, 'available',
   '["T-shirt event","Sertifikat digital"]'),

  -- Bandung Indie Fest
  ('22222222-0000-0000-0000-000000000005', 'Early Bird', 75000,  500, 4, 'available',
   '["Akses penuh festival","Sticker pack eksklusif"]'),
  ('22222222-0000-0000-0000-000000000005', 'Regular',    120000, 2000, 4, 'available',
   '["Akses penuh festival"]'),
  ('22222222-0000-0000-0000-000000000005', 'VIP',        350000, 200, 2, 'available',
   '["Akses penuh festival","Area VIP","Meet & Greet 1 band","Merchandise"]'),

  -- Bali Arts & Culture
  ('22222222-0000-0000-0000-000000000006', '3-Day Pass', 250000, 3000, 4, 'available',
   '["Akses semua area 3 hari","Souvenir kain tradisional"]'),
  ('22222222-0000-0000-0000-000000000006', 'Day Pass',   100000, 5000, 4, 'available',
   '["Akses semua area 1 hari pilihan"]')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. TAMBAH AKOMODASI UNTUK KOTA-KOTA BARU
-- ============================================================

INSERT INTO accommodations (name, type, city, address, latitude, longitude, star_rating, base_price) VALUES
  -- Makassar
  ('Ibis Makassar City Center',          'hotel', 'Makassar',  'Jl. Maipo No.8, Makassar',                    -5.139440, 119.420080, 3,  550000),
  ('Swiss-Belhotel Makassar',            'hotel', 'Makassar',  'Jl. Lembeh No.8, Makassar',                   -5.135080, 119.413420, 4,  850000),
  ('Claro Makassar',                     'hotel', 'Makassar',  'Jl. A. Pettarani No.3, Makassar',             -5.153980, 119.432560, 5, 1450000),
  ('Amaris Hotel Makassar',              'hotel', 'Makassar',  'Jl. Pattimura No.3, Makassar',                -5.131180, 119.411060, 2,  350000),
  ('MaxOne Hotel Makassar',              'hotel', 'Makassar',  'Jl. Gunung Bawakaraeng, Makassar',            -5.128490, 119.418780, 3,  480000),

  -- Bandung
  ('Padma Hotel Bandung',                'hotel', 'Bandung',   'Jl. Ranca Bentang No.56-58, Bandung',         -6.867790, 107.602070, 5, 1900000),
  ('Hotel Grandia Bandung',              'hotel', 'Bandung',   'Jl. Asia Afrika No.67, Bandung',              -6.921580, 107.606830, 4,  780000),
  ('Ibis Bandung Trans Studio',          'hotel', 'Bandung',   'Jl. Gatot Subroto No.289, Bandung',           -6.908670, 107.613010, 3,  520000),
  ('Amaris Hotel Bandung',               'hotel', 'Bandung',   'Jl. Otto Iskandar Dinata No.16, Bandung',     -6.918890, 107.603110, 2,  380000),

  -- Bali
  ('The Mulia Bali',                     'hotel', 'Bali',      'Jl. Raya Nusa Dua Selatan, Nusa Dua',         -8.805340, 115.225090, 5, 5500000),
  ('Kuta Seaview Boutique Resort',       'hotel', 'Bali',      'Jl. Pantai Kuta, Kuta',                       -8.716890, 115.166490, 4, 1200000),
  ('Ibis Styles Bali Kuta',              'hotel', 'Bali',      'Jl. Dewi Sri No.9, Kuta',                     -8.724090, 115.169910, 3,  600000),
  ('Pop! Hotel Kuta Beach',              'hotel', 'Bali',      'Jl. Benesari No.1, Kuta, Bali',               -8.722440, 115.170110, 2,  350000),

  -- Malang
  ('Atria Hotel Malang',                 'hotel', 'Malang',    'Jl. Letjen S. Parman No.87, Malang',          -7.977760, 112.630890, 4,  750000),
  ('Ibis Malang',                        'hotel', 'Malang',    'Jl. Jend. Basuki Rachmat No.11, Malang',      -7.983110, 112.630560, 3,  500000),
  ('Amaris Hotel Malang',                'hotel', 'Malang',    'Jl. Letjen S. Parman No.71, Malang',          -7.978450, 112.629080, 2,  320000),

  -- Solo
  ('The Sunan Hotel Solo',               'hotel', 'Solo',      'Jl. A. Yani No.40, Surakarta',                -7.559130, 110.834080, 4,  680000),
  ('Ibis Solo',                          'hotel', 'Solo',      'Jl. Gajah Mada No.23, Surakarta',             -7.565880, 110.821890, 3,  420000),
  ('Amaris Hotel Solo',                  'hotel', 'Solo',      'Jl. Slamet Riyadi No.354, Surakarta',         -7.566790, 110.802560, 2,  280000),

  -- Semarang
  ('PO Hotel Semarang',                  'hotel', 'Semarang',  'Jl. Pemuda No.118, Semarang',                 -6.984210, 110.410450, 5, 1350000),
  ('Ciputra Hotel Semarang',             'hotel', 'Semarang',  'Jl. Simpang Lima, Semarang',                  -6.992670, 110.425330, 4,  820000),
  ('Ibis Semarang Simpang Lima',         'hotel', 'Semarang',  'Jl. Gajahmada No.123, Semarang',              -6.992180, 110.413210, 3,  490000),
  ('Amaris Hotel Semarang',              'hotel', 'Semarang',  'Jl. Piere Tendean No.7, Semarang',            -6.990780, 110.422390, 2,  320000),

  -- Surabaya
  ('Shangri-La Surabaya',                'hotel', 'Surabaya',  'Jl. May. Jend. Sungkono No.120, Surabaya',    -7.293710, 112.729360, 5, 2200000),
  ('Majapahit Hotel Surabaya',           'hotel', 'Surabaya',  'Jl. Tunjungan No.65, Surabaya',               -7.258900, 112.741480, 4,  950000),
  ('Ibis Surabaya City Center',          'hotel', 'Surabaya',  'Jl. Rajawali No.9-11, Surabaya',              -7.239380, 112.739500, 3,  510000),
  ('Amaris Hotel Surabaya',              'hotel', 'Surabaya',  'Jl. Mayjend HR Muhammad No.21, Surabaya',     -7.278590, 112.726580, 2,  300000)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Verifikasi
-- ============================================================

SELECT id, title, category, status,
       TO_CHAR(start_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS start_wib
FROM events
ORDER BY start_at;

SELECT city, COUNT(*) AS jumlah_hotel, MIN(base_price) AS min_price, MAX(base_price) AS max_price
FROM accommodations
GROUP BY city
ORDER BY city;
