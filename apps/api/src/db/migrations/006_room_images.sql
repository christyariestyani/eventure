-- ============================================================
-- ROOM TYPE IMAGES
-- Tambah gambar untuk setiap tipe kamar
-- Gunakan picsum.photos/seed/{seed}/800/500 untuk gambar konsisten
-- ============================================================

UPDATE room_types
SET image_urls = ARRAY['https://picsum.photos/seed/hotel-standar-room/800/500']
WHERE name = 'Kamar Standar';

UPDATE room_types
SET image_urls = ARRAY['https://picsum.photos/seed/hotel-deluxe-room/800/500']
WHERE name = 'Kamar Deluxe';

UPDATE room_types
SET image_urls = ARRAY['https://picsum.photos/seed/hotel-suite-room/800/500']
WHERE name = 'Suite';
