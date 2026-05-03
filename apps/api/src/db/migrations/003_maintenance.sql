-- ============================================================
-- 003_maintenance.sql
-- Jalankan di Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 1. UPDATE NAMA EVENT → event lokal & kurang terkenal
--    (tapi nyata ada di Indonesia)
-- ============================================================

UPDATE events SET
  title       = 'Joyland Festival Jakarta 2026',
  description = 'Festival musik indie dan alternatif tahunan yang hadir kembali di Jakarta. '
                'Menampilkan lebih dari 40 artis lokal pilihan dari berbagai genre — dari indie pop, '
                'post-rock, hingga folk elektronik. Ramah keluarga, penuh instalasi seni interaktif.',
  tags        = ARRAY['indie', 'musik', 'festival', 'joyland', 'lokal', 'alternatif'],
  start_at    = '2026-05-30 14:00:00+07',
  end_at      = '2026-05-31 23:00:00+07'
WHERE id = '22222222-0000-0000-0000-000000000001';

UPDATE events SET
  title       = 'Pestapora 2026',
  description = 'Festival budaya pop dan musik lokal yang merayakan kreativitas anak bangsa. '
                'Berlangsung selama tiga hari dengan panggung utama dan side stages, bazar UMKM, '
                'zona kuliner daerah, dan pertunjukan seni pertunjukan dari seluruh penjuru Indonesia.',
  tags        = ARRAY['musik', 'festival', 'pestapora', 'lokal', 'indie', 'pop', 'budaya']
WHERE id = '22222222-0000-0000-0000-000000000002';

UPDATE events SET
  title       = 'Mandiri Jogja Marathon 2026',
  description = 'Lari maraton tahunan yang melintasi jantung Kota Yogyakarta — dari Stadion Mandala Krida, '
                'menyusuri Jl. Malioboro, melewati Keraton, hingga finish di alun-alun. '
                'Tersedia kategori Full Marathon 42K, Half Marathon, 10K, dan 5K Family Run.',
  tags        = ARRAY['lari', 'marathon', 'jogja', 'olahraga', 'lokal', 'heritage']
WHERE id = '22222222-0000-0000-0000-000000000003';

-- Jika ada event lain di luar seed (dibuat manual / dari onboarding),
-- update sekaligus dengan daftar nama lokal Indonesia yang nyata:

WITH local_names (title, description, tags, category) AS (
  VALUES
    ('Dieng Culture Festival 2026',
     'Festival budaya tahunan di Dataran Tinggi Dieng, Wonosobo. Puncak acara adalah prosesi ruwatan '
     'rambut gimbal anak-anak Dieng yang dikeramatkan. Dilengkapi pertunjukan wayang, jazz di awan, '
     'dan pameran produk pertanian lokal.',
     ARRAY['budaya','dieng','wonosobo','ruwatan','festival','lokal'],
     'festival'::event_category),

    ('Solo Batik Run 2026',
     'Lomba lari bertema batik yang unik di Solo. Para peserta berlari mengenakan kemeja batik, '
     'menyusuri warisan budaya Kota Surakarta. Tersedia kategori 5K dan 10K untuk semua usia.',
     ARRAY['lari','batik','solo','olahraga','lokal','heritage'],
     'sports'::event_category),

    ('Pasar Kangen Yogyakarta 2026',
     'Pasar nostalgia tahunan yang menampilkan jajanan, permainan, dan kerajinan Jawa dari era 1970–1990an. '
     'Berlokasi di Taman Budaya Yogyakarta. Cocok untuk semua generasi yang rindu suasana tempo dulu.',
     ARRAY['pasar','nostalgia','yogyakarta','kuliner','budaya','lokal'],
     'festival'::event_category),

    ('Festival Teluk Jailolo 2026',
     'Festival bahari tahunan di Halmahera Barat, Maluku Utara. Menampilkan tarian tradisional Soya-Soya, '
     'lomba perahu tradisional, ritual adat Legu Gam, dan bazaar seafood segar langsung dari nelayan lokal.',
     ARRAY['bahari','halmahera','maluku','budaya','festival','lokal','legu-gam'],
     'festival'::event_category),

    ('Bromo Tengger Semeru Ultra 2026',
     'Trail running ekstrem menyusuri kawasan Taman Nasional Bromo Tengger Semeru. '
     'Rute melewati lautan pasir, perbukitan savana, dan pemandangan vulkanik khas Jawa Timur. '
     'Kategori 50K, 30K, dan 15K trail run.',
     ARRAY['trail','running','bromo','semeru','olahraga','alam','lokal'],
     'sports'::event_category),

    ('Festival Seni Bali Jani 2026',
     'Festival seni pertunjukan yang diinisiasi Gubernur Bali untuk merevitalisasi seni tradisional '
     'lokal Bali. Menampilkan tari kecak, legong, dan wayang kulit dari sanggar-sanggar kecil di seluruh Bali.',
     ARRAY['seni','bali','tari','wayang','budaya','lokal','festival'],
     'festival'::event_category),

    ('Pekan Raya Batik Pekalongan 2026',
     'Pameran dan lomba batik terbesar di "Kota Batik" Pekalongan. Ratusan UMKM batik hadir, '
     'mulai batik cap, tulis, hingga batik kontemporer. Terdapat workshop membatik untuk umum.',
     ARRAY['batik','pekalongan','pameran','kerajinan','lokal','umkm'],
     'conference'::event_category)
),
-- Ambil events yang bukan seed utama (bukan 3 event di atas) lalu update nama secara round-robin
ranked AS (
  SELECT
    e.id,
    ln.title,
    ln.description,
    ln.tags,
    ln.category,
    ROW_NUMBER() OVER (ORDER BY e.created_at) AS rn,
    COUNT(*) OVER ()                            AS total
  FROM events e
  CROSS JOIN LATERAL (
    SELECT * FROM local_names
    OFFSET (ABS(HASHTEXT(e.id::text)) % 7)
    LIMIT 1
  ) ln
  WHERE e.id NOT IN (
    '22222222-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003'
  )
)
UPDATE events e
SET
  title       = r.title,
  description = r.description,
  tags        = r.tags
FROM ranked r
WHERE e.id = r.id;


-- ============================================================
-- 2. HAPUS USER BESERTA SELURUH DATA TERKAIT
--    (bookings, tickets, preferences, behaviour, dll)
-- ============================================================

DO $$
DECLARE
  target_emails TEXT[] := ARRAY[
    'christymakrina@gmail.com',
    'christy@gmail.com',
    'makrinachristy@gmail.com'
  ];
  target_ids UUID[];
BEGIN
  -- Kumpulkan UUID dari email yang ditarget
  SELECT ARRAY_AGG(id) INTO target_ids
  FROM users
  WHERE email = ANY(target_emails);

  IF target_ids IS NULL OR ARRAY_LENGTH(target_ids, 1) = 0 THEN
    RAISE NOTICE 'Tidak ada user yang cocok dengan email target.';
    RETURN;
  END IF;

  RAISE NOTICE 'Menghapus % user: %', ARRAY_LENGTH(target_ids, 1), target_ids;

  -- 1. Hapus tickets (RESTRICT ke users dan booking_items — harus dihapus dulu)
  DELETE FROM tickets
  WHERE user_id = ANY(target_ids);

  -- 2. Hapus bookings (CASCADE ke booking_items otomatis)
  DELETE FROM bookings
  WHERE user_id = ANY(target_ids);

  -- 3. Hapus dari public.users
  --    (CASCADE otomatis ke: user_preferences, user_behavior,
  --     saved_events, user_similarity)
  DELETE FROM users
  WHERE id = ANY(target_ids);

  -- 4. Hapus dari auth.users (Supabase Auth)
  --    Harus dijalankan sebagai service_role atau superuser
  DELETE FROM auth.users
  WHERE email = ANY(target_emails);

  RAISE NOTICE 'Selesai. User dan semua data terkait telah dihapus.';
END;
$$;


-- ============================================================
-- 3. TAMBAH user_code — ID user yang mudah dibaca (bukan UUID)
--
--    Kenapa tidak mengganti kolom id langsung?
--    → Supabase Auth menggunakan UUID pada auth.users dan
--      semua token JWT. Mengganti tipe PK akan merusak auth.
--
--    Solusi: tambah kolom user_code sebagai ID publik/tampilan
--    dengan format:  USR-YYYYMMDD-NNNNN  (cth: USR-20260503-00042)
-- ============================================================

-- Sequence untuk nomor urut
CREATE SEQUENCE IF NOT EXISTS user_code_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Tambah kolom
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_code VARCHAR(25) UNIQUE;

-- Isi user_code untuk user yang sudah ada
-- (urutkan berdasarkan created_at agar nomor urut masuk akal)
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at) AS rn,
         created_at
  FROM users
  WHERE user_code IS NULL
)
UPDATE users u
SET user_code =
  'USR-'
  || TO_CHAR(o.created_at, 'YYYYMMDD')
  || '-'
  || LPAD(CAST(nextval('user_code_seq') AS TEXT), 5, '0')
FROM ordered o
WHERE u.id = o.id;

-- Set NOT NULL setelah semua baris terisi
ALTER TABLE users
  ALTER COLUMN user_code SET NOT NULL;

-- Index sudah ada dari UNIQUE constraint di atas
-- Tambah index eksplisit untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_users_code ON users(user_code);

-- Fungsi auto-generate user_code saat INSERT
CREATE OR REPLACE FUNCTION fn_generate_user_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code :=
      'USR-'
      || TO_CHAR(NOW(), 'YYYYMMDD')
      || '-'
      || LPAD(CAST(nextval('user_code_seq') AS TEXT), 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trg_users_code ON users;
CREATE TRIGGER trg_users_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_user_code();


-- ============================================================
-- Verifikasi hasil
-- ============================================================

-- Cek event baru
SELECT id, title, category, tags FROM events ORDER BY created_at;

-- Cek user yang tersisa (setelah hapus)
SELECT id, user_code, email, full_name, created_at
FROM users
ORDER BY created_at;

-- Cek tidak ada data sisa dari user yang dihapus
SELECT COUNT(*) AS sisa_booking
FROM bookings b
JOIN users u ON b.user_id = u.id
WHERE u.email IN (
  'christymakrina@gmail.com',
  'christy@gmail.com',
  'makrinachristy@gmail.com'
);
