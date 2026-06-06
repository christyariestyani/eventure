-- ============================================================
-- MIGRASI: users.id UUID → BIGSERIAL
-- Semua FK yang mengarah ke users.id ikut diupdate
-- Jalankan SETELAH 007_room_types_serial_ids.sql berhasil
--
-- Yang berubah:
--   users.id            UUID → BIGSERIAL
--   users.auth_uuid     (baru) menyimpan UUID lama untuk referensi
--   bookings.user_id    UUID → BIGINT
--   tickets.user_id     UUID → BIGINT
--   user_behavior.user_id UUID → BIGINT
--   user_preferences.user_id UUID PK → BIGINT PK
--   user_similarity.user_a/b UUID → BIGINT
--   events.organizer_id UUID → BIGINT
--   saved_events.user_id UUID → BIGINT
--
-- Catatan: Setelah migrasi, semua JWT lama (berisi UUID) tidak
-- valid. User perlu login ulang untuk mendapat token baru.
-- ============================================================

BEGIN;

-- ============================================================
-- FASE 1 — Tambah kolom integer baru ke users
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_no BIGSERIAL;

-- Simpan UUID lama sebagai auth_uuid (untuk debug/rollback)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uuid UUID;
UPDATE users SET auth_uuid = id WHERE auth_uuid IS NULL;

-- ============================================================
-- FASE 2 — Tambah kolom integer FK di semua child tables
-- dan populate dari users.user_no
-- ============================================================

-- user_preferences (PK = user_id UUID)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_no BIGINT;
UPDATE user_preferences up
  SET user_no = u.user_no FROM users u WHERE up.user_id = u.id AND up.user_no IS NULL;
ALTER TABLE user_preferences ALTER COLUMN user_no SET NOT NULL;

-- bookings.user_id
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS _user_no BIGINT;
UPDATE bookings b
  SET _user_no = u.user_no FROM users u WHERE b.user_id = u.id AND b._user_no IS NULL;
ALTER TABLE bookings ALTER COLUMN _user_no SET NOT NULL;

-- tickets.user_id
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS _user_no BIGINT;
UPDATE tickets t
  SET _user_no = u.user_no FROM users u WHERE t.user_id = u.id AND t._user_no IS NULL;
ALTER TABLE tickets ALTER COLUMN _user_no SET NOT NULL;

-- user_behavior.user_id
ALTER TABLE user_behavior ADD COLUMN IF NOT EXISTS _user_no BIGINT;
UPDATE user_behavior ub
  SET _user_no = u.user_no FROM users u WHERE ub.user_id = u.id AND ub._user_no IS NULL;
ALTER TABLE user_behavior ALTER COLUMN _user_no SET NOT NULL;

-- saved_events.user_id (composite PK, sudah BIGINT event_id dari migrasi 007)
ALTER TABLE saved_events ADD COLUMN IF NOT EXISTS _user_no BIGINT;
UPDATE saved_events se
  SET _user_no = u.user_no FROM users u WHERE se.user_id = u.id AND se._user_no IS NULL;
ALTER TABLE saved_events ALTER COLUMN _user_no SET NOT NULL;

-- user_similarity.user_a dan user_b
ALTER TABLE user_similarity ADD COLUMN IF NOT EXISTS _user_a_no BIGINT;
ALTER TABLE user_similarity ADD COLUMN IF NOT EXISTS _user_b_no BIGINT;
UPDATE user_similarity us
  SET _user_a_no = u.user_no FROM users u WHERE us.user_a = u.id AND us._user_a_no IS NULL;
UPDATE user_similarity us
  SET _user_b_no = u.user_no FROM users u WHERE us.user_b = u.id AND us._user_b_no IS NULL;

-- events.organizer_id (nullable)
ALTER TABLE events ADD COLUMN IF NOT EXISTS _organizer_no BIGINT;
UPDATE events e
  SET _organizer_no = u.user_no FROM users u WHERE e.organizer_id = u.id AND e._organizer_no IS NULL;

-- ============================================================
-- FASE 3 — Drop semua FK ke users(id)
-- ============================================================

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE bookings         DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE tickets          DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE user_behavior    DROP CONSTRAINT IF EXISTS user_behavior_user_id_fkey;
ALTER TABLE saved_events     DROP CONSTRAINT IF EXISTS saved_events_user_id_fkey;
ALTER TABLE user_similarity  DROP CONSTRAINT IF EXISTS user_similarity_user_a_fkey;
ALTER TABLE user_similarity  DROP CONSTRAINT IF EXISTS user_similarity_user_b_fkey;
ALTER TABLE events           DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;

-- ============================================================
-- FASE 4 — Swap users PK: UUID id → BIGSERIAL user_no
-- ============================================================

ALTER TABLE users DROP CONSTRAINT users_pkey;
ALTER TABLE users DROP COLUMN id;          -- drop UUID PK
ALTER TABLE users RENAME COLUMN user_no TO id;
ALTER TABLE users ADD PRIMARY KEY (id);

-- ============================================================
-- FASE 5 — Swap UUID FK columns ke integer di child tables
-- ============================================================

-- ── user_preferences ──────────────────────────────────────────
ALTER TABLE user_preferences DROP CONSTRAINT user_preferences_pkey;
ALTER TABLE user_preferences DROP COLUMN user_id;
ALTER TABLE user_preferences RENAME COLUMN user_no TO user_id;
ALTER TABLE user_preferences ADD PRIMARY KEY (user_id);

-- ── bookings ──────────────────────────────────────────────────
ALTER TABLE bookings DROP COLUMN user_id;
ALTER TABLE bookings RENAME COLUMN _user_no TO user_id;

-- ── tickets ───────────────────────────────────────────────────
ALTER TABLE tickets DROP COLUMN user_id;
ALTER TABLE tickets RENAME COLUMN _user_no TO user_id;

-- ── user_behavior ─────────────────────────────────────────────
ALTER TABLE user_behavior DROP COLUMN user_id;
ALTER TABLE user_behavior RENAME COLUMN _user_no TO user_id;

-- ── saved_events ──────────────────────────────────────────────
ALTER TABLE saved_events DROP CONSTRAINT saved_events_pkey;
ALTER TABLE saved_events DROP COLUMN user_id;
ALTER TABLE saved_events RENAME COLUMN _user_no TO user_id;
ALTER TABLE saved_events ADD PRIMARY KEY (user_id, event_id);

-- ── user_similarity ───────────────────────────────────────────
ALTER TABLE user_similarity DROP CONSTRAINT user_similarity_pkey;
ALTER TABLE user_similarity DROP COLUMN user_a;
ALTER TABLE user_similarity DROP COLUMN user_b;
ALTER TABLE user_similarity RENAME COLUMN _user_a_no TO user_a;
ALTER TABLE user_similarity RENAME COLUMN _user_b_no TO user_b;
ALTER TABLE user_similarity ADD PRIMARY KEY (user_a, user_b);

-- ── events.organizer_id ───────────────────────────────────────
ALTER TABLE events DROP COLUMN organizer_id;
ALTER TABLE events RENAME COLUMN _organizer_no TO organizer_id;

-- ============================================================
-- FASE 6 — Re-add FK constraints (drop-before-add agar idempotent)
-- ============================================================

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE user_behavior DROP CONSTRAINT IF EXISTS user_behavior_user_id_fkey;
ALTER TABLE user_behavior
  ADD CONSTRAINT user_behavior_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE saved_events DROP CONSTRAINT IF EXISTS saved_events_user_id_fkey;
ALTER TABLE saved_events
  ADD CONSTRAINT saved_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_similarity DROP CONSTRAINT IF EXISTS user_similarity_user_a_fkey;
ALTER TABLE user_similarity DROP CONSTRAINT IF EXISTS user_similarity_user_b_fkey;
ALTER TABLE user_similarity
  ADD CONSTRAINT user_similarity_user_a_fkey
    FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_similarity_user_b_fkey
    FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_organizer_id_fkey
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- FASE 7 — Recreate indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_bookings_user        ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user         ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user           ON saved_events(user_id);

-- ============================================================
-- VERIFIKASI
-- ============================================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('id','user_id','organizer_id','user_a','user_b')
  AND table_name IN ('users','bookings','tickets','user_preferences',
                     'user_behavior','saved_events','user_similarity','events')
ORDER BY table_name, column_name;

COMMIT;
