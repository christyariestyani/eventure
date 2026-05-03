-- ============================================================
-- Eventure — Dev Seed Data
-- ============================================================

-- Event Organizers
INSERT INTO users (id, email, full_name, preferences) VALUES
  ('33333333-0000-0000-0000-000000000001', 'hello@promotornusantara.id', 'Promotor Nusantara', '{"type":"organizer"}'),
  ('33333333-0000-0000-0000-000000000002', 'info@sportiveindonesia.id',  'Sportive Indonesia',  '{"type":"organizer"}'),
  ('33333333-0000-0000-0000-000000000003', 'contact@idemfestival.id',    'IDEM Festival',       '{"type":"organizer"}')
ON CONFLICT (id) DO NOTHING;

-- Venues
INSERT INTO venues (id, name, city, address, latitude, longitude, capacity) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Gelora Bung Karno', 'Jakarta', 'Jl. Pintu Satu Senayan, Jakarta Pusat', -6.218544, 106.802400, 77193),
  ('11111111-0000-0000-0000-000000000002', 'Indonesia Arena', 'Jakarta', 'Jl. Pintu Satu Senayan, Jakarta Pusat', -6.216820, 106.799340, 16000),
  ('11111111-0000-0000-0000-000000000003', 'Stadion Mandala Krida', 'Yogyakarta', 'Jl. Kusumanegara No.1, Yogyakarta', -7.800540, 110.387220, 15000);

-- Events
INSERT INTO events (id, organizer_id, venue_id, title, category, tags, start_at, end_at, status, description) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',  -- Promotor Nusantara
    '11111111-0000-0000-0000-000000000001',
    'Coldplay: Music of the Spheres World Tour — Jakarta',
    'music',
    ARRAY['coldplay', 'pop', 'rock', 'international', 'konser'],
    '2025-02-15 19:00:00+07',
    '2025-02-15 23:00:00+07',
    'published',
    'Konser spektakuler Coldplay hadir di Jakarta dengan pengalaman visual yang memukau dan setlist terbaik sepanjang masa.'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000001',  -- Promotor Nusantara (sama)
    '11111111-0000-0000-0000-000000000002',
    'Jakarta International BNI Java Jazz Festival 2026',
    'music',
    ARRAY['jazz', 'festival', 'java-jazz', 'international'],
    '2026-05-30 16:00:00+07',
    '2026-06-01 23:00:00+07',
    'published',
    'Festival jazz terbesar di Asia Tenggara dengan lebih dari 100 penampil dari seluruh dunia.'
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    '33333333-0000-0000-0000-000000000002',  -- Sportive Indonesia (berbeda)
    '11111111-0000-0000-0000-000000000003',
    'Borobudur Marathon 2026',
    'sports',
    ARRAY['marathon', 'lari', 'borobudur', 'olahraga', 'heritage'],
    '2026-11-15 05:00:00+07',
    '2026-11-15 12:00:00+07',
    'published',
    'Lari marathon premium dengan latar belakang Candi Borobudur. Tersedia kategori Full Marathon, Half Marathon, dan 10K.'
  );

-- Ticket Tiers
INSERT INTO ticket_tiers (event_id, name, price, total_quota, max_per_user, status, benefits) VALUES
  -- Coldplay
  ('22222222-0000-0000-0000-000000000001', 'VVIP Golden Circle', 3500000, 500, 2, 'available', '["Pit area terdekat stage", "Merchandise eksklusif", "Akses early entry", "Lampu LED gelang"]'),
  ('22222222-0000-0000-0000-000000000001', 'VIP Tribune A', 2200000, 2000, 4, 'available', '["Kursi VIP tribun A", "Akses early entry", "Lampu LED gelang"]'),
  ('22222222-0000-0000-0000-000000000001', 'Festival B', 1200000, 8000, 4, 'available', '["Area festival standing", "Lampu LED gelang"]'),
  ('22222222-0000-0000-0000-000000000001', 'Festival C', 850000, 10000, 4, 'available', '["Area festival standing"]'),
  -- Java Jazz
  ('22222222-0000-0000-0000-000000000002', 'All-Access 3 Hari', 1800000, 3000, 2, 'available', '["Akses semua stage 3 hari", "Lounge eksklusif", "Program booklet"]'),
  ('22222222-0000-0000-0000-000000000002', 'Day Pass', 750000, 5000, 4, 'available', '["Akses semua stage 1 hari pilihan"]'),
  -- Borobudur Marathon
  ('22222222-0000-0000-0000-000000000003', 'Full Marathon 42K', 650000, 1000, 1, 'available', '["Jersey premium", "Medali finisher", "Sertifikat", "Pasta party"]'),
  ('22222222-0000-0000-0000-000000000003', 'Half Marathon 21K', 450000, 2000, 1, 'available', '["Jersey premium", "Medali finisher", "Sertifikat"]'),
  ('22222222-0000-0000-0000-000000000003', '10K Fun Run', 250000, 5000, 2, 'available', '["T-shirt event", "Sertifikat digital"]');

-- Accommodations near venues
INSERT INTO accommodations (name, type, city, address, latitude, longitude, star_rating, base_price) VALUES
  ('Hotel Mulia Senayan', 'hotel', 'Jakarta', 'Jl. Asia Afrika, Senayan', -6.225300, 106.800140, 5, 2850000),
  ('Pullman Jakarta Indonesia', 'hotel', 'Jakarta', 'Jl. M.H. Thamrin Kav. 59', -6.193350, 106.821850, 5, 1950000),
  ('Ibis Styles Jakarta Tanah Abang', 'hotel', 'Jakarta', 'Jl. KH Wahid Hasyim', -6.204580, 106.816920, 3, 580000),
  ('Amaris Hotel Mampang', 'hotel', 'Jakarta', 'Jl. Mampang Prapatan Raya', -6.239810, 106.821530, 2, 380000),
  ('Hyatt Regency Yogyakarta', 'hotel', 'Yogyakarta', 'Jl. Palagan Tentara Pelajar', -7.757680, 110.375020, 5, 1650000),
  ('Grand Aston Yogyakarta', 'hotel', 'Yogyakarta', 'Jl. Urip Sumoharjo No.37', -7.789000, 110.381450, 4, 980000);
