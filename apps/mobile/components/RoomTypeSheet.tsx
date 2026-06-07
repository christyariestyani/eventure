import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { RoomType } from '../hooks/useAccommodations';

const BLUE  = '#1D63ED';
const GREEN = '#059669';

// ── Room image helpers ────────────────────────────────────────────────────────
// Offset per tier agar foto antar tipe kamar berbeda kategori visualnya.
// lock = hash(room.id) % 20 → 20 variasi per tier, unik per hotel.
function idHash(id: number): number {
  return id;
}

const TIER_OFFSET: Record<'standard' | 'deluxe' | 'suite', number> = {
  standard: 0,
  deluxe: 20,
  suite: 40,
};

function roomTier(name: string): 'standard' | 'deluxe' | 'suite' {
  const n = name.toLowerCase();
  if (n.includes('suite')) return 'suite';
  if (n.includes('deluxe')) return 'deluxe';
  return 'standard';
}

// loremflickr: gambar Flickr ber-tag hotel+room, lock = angka konsisten.
// Langsung JPEG tanpa redirect — andal di React Native iOS.
function roomImageUri(room: RoomType): string {
  if (room.image_urls.length > 0) return room.image_urls[0];
  const tier   = roomTier(room.name);
  const lock   = (idHash(room.id) % 20) + 1 + TIER_OFFSET[tier];
  return `https://loremflickr.com/800/500/hotel,room,interior/all?lock=${lock}`;
}

// Sub-komponen agar tiap kartu punya error-state sendiri
function RoomImage({ uri, fallbackEmoji }: { uri: string; fallbackEmoji: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <View style={imgStyles.placeholder}>
        <Text style={imgStyles.emoji}>{fallbackEmoji}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={imgStyles.img}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const imgStyles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  emoji:       { fontSize: 52 },
  img:         { width: '100%', height: '100%' },
});

const AMENITY_ICONS: Record<string, string> = {
  'WiFi Gratis':    '📶',
  'AC':             '❄️',
  'Mini Bar':       '🍷',
  'Sarapan':        'breakfast',
  'Bathtub':        '🛁',
  'TV 32"':         '📺',
  'TV 43"':         '📺',
  'TV 55"':         '📺',
  'Air Panas':      '🚿',
  'Kamar Mandi Dalam': '🚽',
  'Living Room':    '🛋️',
  'Late Check-out': '🕐',
};

function amenityIcon(name: string): string {
  if (name.toLowerCase().includes('sarapan') || name.toLowerCase().includes('breakfast')) return '🍳';
  return AMENITY_ICONS[name] ?? '✓';
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  visible: boolean;
  hotelName: string;
  hotelStars: number;
  rooms: RoomType[];
  isLoading: boolean;
  selectedRoomId: number | null;
  nights: number;
  onSelect: (room: RoomType) => void;
  onClose: () => void;
}

export default function RoomTypeSheet({
  visible, hotelName, hotelStars, rooms, isLoading,
  selectedRoomId, nights, onSelect, onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hotelName} numberOfLines={1}>{hotelName}</Text>
              <Text style={styles.stars}>{'⭐'.repeat(hotelStars)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subheader}>Pilih Tipe Kamar</Text>

          {/* Room list */}
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={BLUE} size="large" />
              <Text style={styles.loadingText}>Memuat tipe kamar...</Text>
            </View>
          ) : rooms.length === 0 ? (
            <View style={styles.loading}>
              <Text style={styles.emptyText}>Tidak ada kamar tersedia</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {rooms.map((room, idx) => {
                const isSelected = room.id === selectedRoomId;
                const totalPrice = room.price_per_night * Math.max(1, nights);
                const imageUri   = roomImageUri(room);

                return (
                  <View
                    key={String(room.id)}
                    style={[styles.roomCard, isSelected && styles.roomCardSelected]}
                  >
                    {/* Room image + overlay */}
                    <View style={styles.roomImgWrap}>
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.roomImg}
                        resizeMode="cover"
                      />
                      {/* Dark gradient overlay at bottom */}
                      <View style={styles.imgOverlay}>
                        <View style={styles.imgOverlayRow}>
                          <Text style={styles.imgRoomName} numberOfLines={1}>{room.name}</Text>
                          <View style={styles.imgBedBadge}>
                            <Text style={styles.imgBedBadgeTxt}>{room.bed_type}</Text>
                          </View>
                        </View>
                      </View>
                      {/* Selected badge */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeTxt}>✓ Dipilih</Text>
                        </View>
                      )}
                    </View>

                    {/* Room info */}
                    <View style={styles.roomBody}>
                      {/* Occupancy */}
                      <Text style={styles.occupancy}>
                        👤 Maks. {room.max_occupancy} orang
                      </Text>

                      {/* Description */}
                      {room.description ? (
                        <Text style={styles.roomDesc} numberOfLines={2}>{room.description}</Text>
                      ) : null}

                      {/* Amenities */}
                      <View style={styles.amenitiesWrap}>
                        {room.amenities.slice(0, 5).map(a => (
                          <View key={a} style={[styles.amenityChip, isSelected && styles.amenityChipSelected]}>
                            <Text style={styles.amenityIcon}>{amenityIcon(a)}</Text>
                            <Text style={[styles.amenityTxt, isSelected && styles.amenityTxtSelected]}>{a}</Text>
                          </View>
                        ))}
                        {room.amenities.length > 5 && (
                          <View style={styles.amenityChip}>
                            <Text style={styles.amenityTxt}>+{room.amenities.length - 5} lainnya</Text>
                          </View>
                        )}
                      </View>

                      {/* Price + CTA */}
                      <View style={styles.priceRow}>
                        <View>
                          <Text style={[styles.priceMain, isSelected && styles.priceMainSelected]}>
                            {fmt(room.price_per_night)}
                          </Text>
                          <Text style={styles.priceNight}>/malam</Text>
                          {nights > 1 && (
                            <Text style={styles.priceTotal}>
                              {nights} malam = {fmt(totalPrice)}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.selectBtn, isSelected && styles.selectBtnSelected]}
                          onPress={() => onSelect(room)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.selectBtnTxt, isSelected && styles.selectBtnTxtSelected]}>
                            {isSelected ? '✓ Dipilih' : 'Pilih'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '85%',
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, marginBottom: 4,
  },
  hotelName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  stars:     { fontSize: 13, marginTop: 2 },
  closeBtn:  { padding: 4 },
  closeTxt:  { fontSize: 18, color: '#9CA3AF', fontWeight: '600' },
  subheader: { fontSize: 13, color: '#6B7280', paddingHorizontal: 20, marginBottom: 12 },

  loading:     { alignItems: 'center', padding: 48, gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  emptyText:   { fontSize: 14, color: '#9CA3AF' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },

  roomCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  roomCardSelected: {
    borderColor: BLUE,
    backgroundColor: '#EFF6FF',
  },

  roomImgWrap: {
    height: 160,
    overflow: 'hidden',
    position: 'relative',
  },
  roomImg: {
    width: '100%',
    height: '100%',
  },
  imgOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  imgOverlayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  imgRoomName: {
    flex: 1, fontSize: 15, fontWeight: '800', color: '#FFFFFF',
  },
  imgBedBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  imgBedBadgeTxt: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },

  selectedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: GREEN,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  selectedBadgeTxt: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },

  roomBody: { padding: 14, gap: 8 },

  occupancy: { fontSize: 12, color: '#6B7280' },
  roomDesc:  { fontSize: 13, color: '#4B5563', lineHeight: 18 },

  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  amenityChipSelected: { backgroundColor: '#DBEAFE' },
  amenityIcon: { fontSize: 11 },
  amenityTxt: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  amenityTxtSelected: { color: BLUE },

  priceRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceMain:         { fontSize: 18, fontWeight: '800', color: '#111827' },
  priceMainSelected: { color: BLUE },
  priceNight:        { fontSize: 11, color: '#9CA3AF' },
  priceTotal:        { fontSize: 12, color: '#6B7280', marginTop: 2 },

  selectBtn: {
    backgroundColor: BLUE,
    paddingVertical: 10, paddingHorizontal: 22,
    borderRadius: 12,
  },
  selectBtnSelected: { backgroundColor: GREEN },
  selectBtnTxt: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  selectBtnTxtSelected: { color: '#FFFFFF' },
});
