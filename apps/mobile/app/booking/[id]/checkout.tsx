import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useInitiatePayment } from '../../../hooks/useBooking';
import { api } from '../../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAccommodations } from '../../../hooks/useAccommodations';

const BLUE = '#1D63ED';
const GREEN = '#22C55E';

// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSPORT_OPTIONS = [
  { id: 'bus', label: 'Bus Pariwisata', icon: '🚌', price: 150000 },
  { id: 'private', label: 'Travel Privat', icon: '🚐', price: 350000 },
  { id: 'train', label: 'Kereta Eksekutif', icon: '🚂', price: 200000 },
  { id: 'flight', label: 'Pesawat', icon: '✈️', price: 500000 },
];

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS', icon: '📱', desc: 'GoPay, OVO, Dana, ShopeePay, dll' },
  { id: 'va', label: 'Transfer Bank', icon: '🏦', desc: 'BCA, Mandiri, BNI, BRI, Permata' },
  { id: 'card', label: 'Kartu Debit / Kredit', icon: '💳', desc: 'Visa, Mastercard, JCB' },
];

const SORT_OPTIONS = [
  { label: 'Terdekat dari Venue', value: 'distance' },
  { label: 'Harga Terendah', value: 'price_asc' },
  { label: 'Harga Tertinggi', value: 'price_desc' },
  { label: 'Bintang Tertinggi', value: 'stars' },
] as const;

const PRICE_RANGES = [
  { label: 'Semua', value: 'all' },
  { label: '< Rp500K', value: '<500' },
  { label: 'Rp500K – 1Jt', value: '500-1000' },
  { label: 'Rp1Jt – 2Jt', value: '1000-2000' },
  { label: '> Rp2Jt', value: '>2000' },
] as const;

const DISTANCE_FILTERS = [
  { label: 'Semua', value: 'all' },
  { label: '< 1 km', value: '1' },
  { label: '< 3 km', value: '3' },
  { label: '< 5 km', value: '5' },
  { label: '< 10 km', value: '10' },
  { label: '< 20 km', value: '20' },
] as const;

type SortOption = typeof SORT_OPTIONS[number]['value'];
type PriceRange = typeof PRICE_RANGES[number]['value'];
type DistanceFilter = typeof DISTANCE_FILTERS[number]['value'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

function fmtDist(km: number | null) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function inDistance(km: number | null, f: DistanceFilter) {
  if (f === 'all' || km == null) return true;
  return km < parseFloat(f);
}

function inPrice(price: number, r: PriceRange) {
  if (r === 'all') return true;
  const k = price / 1000;
  if (r === '<500') return k < 500;
  if (r === '500-1000') return k >= 500 && k < 1000;
  if (r === '1000-2000') return k >= 1000 && k < 2000;
  return k >= 2000;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { id, city, baseAmount, eventTitle, tierName, qty, venueLat, venueLng } =
    useLocalSearchParams<{
      id: string; city?: string; baseAmount?: string; eventTitle?: string;
      tierName?: string; qty?: string; venueLat?: string; venueLng?: string;
    }>();

  const router = useRouter();
  const initiatePayment = useInitiatePayment();
  const queryClient = useQueryClient();

  const parsedLat = venueLat ? parseFloat(venueLat) : undefined;
  const parsedLng = venueLng ? parseFloat(venueLng) : undefined;
  const { data: hotels } = useAccommodations(city, parsedLat, parsedLng);

  // Selection state
  const [selectedHotel, setSelectedHotel] = useState<string | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Applied filter/sort state
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [filterStars, setFilterStars] = useState<number[]>([]);
  const [filterPrice, setFilterPrice] = useState<PriceRange>('all');
  const [filterDist, setFilterDist] = useState<DistanceFilter>('all');

  // Pending (inside modal before Terapkan)
  const [pendingSort, setPendingSort] = useState<SortOption>('distance');
  const [pendingStars, setPendingStars] = useState<number[]>([]);
  const [pendingPrice, setPendingPrice] = useState<PriceRange>('all');
  const [pendingDist, setPendingDist] = useState<DistanceFilter>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'sort' | 'filter'>('sort');

  // Active filter count badge
  const activeFilterCount =
    (filterStars.length > 0 ? 1 : 0) +
    (filterPrice !== 'all' ? 1 : 0) +
    (filterDist !== 'all' ? 1 : 0);

  // Filtered + sorted hotels
  const displayedHotels = useMemo(() => {
    return (hotels ?? [])
      .filter(h => filterStars.length === 0 || filterStars.includes(h.star_rating))
      .filter(h => inPrice(h.base_price, filterPrice))
      .filter(h => inDistance(h.distance_km, filterDist))
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.base_price - b.base_price;
        if (sortBy === 'price_desc') return b.base_price - a.base_price;
        if (sortBy === 'stars') return b.star_rating - a.star_rating;
        return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      });
  }, [hotels, filterStars, filterPrice, filterDist, sortBy]);

  // Amounts
  const ticketAmount = parseFloat(baseAmount ?? '0');
  const hotelAmount = selectedHotel
    ? (hotels?.find(h => h.id === selectedHotel)?.base_price ?? 0) : 0;
  const transportAmount = selectedTransport
    ? (TRANSPORT_OPTIONS.find(t => t.id === selectedTransport)?.price ?? 0) : 0;
  const platformFee = Math.round(ticketAmount * 0.03);
  const total = ticketAmount + hotelAmount + transportAmount + platformFee;

  const openModal = (tab: 'sort' | 'filter') => {
    setPendingSort(sortBy);
    setPendingStars(filterStars);
    setPendingPrice(filterPrice);
    setPendingDist(filterDist);
    setActiveTab(tab);
    setShowModal(true);
  };

  const applyModal = () => {
    setSortBy(pendingSort);
    setFilterStars(pendingStars);
    setFilterPrice(pendingPrice);
    setFilterDist(pendingDist);
    setShowModal(false);
  };

  const resetModal = () => {
    setPendingSort('distance');
    setPendingStars([]);
    setPendingPrice('all');
    setPendingDist('all');
  };

  const togglePendingStar = (star: number) =>
    setPendingStars(prev => prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]);

  const handlePay = async () => {
    if (!selectedPayment) {
      Alert.alert('Pilih Pembayaran', 'Silakan pilih metode pembayaran terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      if (selectedHotel || selectedTransport) {
        const transportPrice = selectedTransport
          ? TRANSPORT_OPTIONS.find(t => t.id === selectedTransport)?.price : undefined;
        await api.patch(`/bookings/${id}/addons`, {
          hotel_id: selectedHotel ?? undefined,
          transport_price: transportPrice,
        });
      }
      await initiatePayment.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert(
        'Pembayaran Berhasil! 🎉',
        'Tiket kamu sedang diproses. Cek di halaman Tiket Saya.',
        [{ text: 'Lihat Tiket', onPress: () => router.replace('/(tabs)/bookings') }]
      );
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'BOOKING_EXPIRED') {
        Alert.alert('Booking Kadaluarsa', 'Waktu pemesanan habis. Silakan pesan ulang.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Gagal', 'Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const sortLabel = SORT_OPTIONS.find(s => s.value === sortBy)?.label ?? '';

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{
        headerShown: true, title: 'Checkout', headerBackVisible: false,
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Ringkasan Pesanan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
          <View style={styles.summaryCard}>
            {eventTitle ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Event</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{eventTitle}</Text>
              </View>
            ) : null}
            {tierName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tiket</Text>
                <Text style={styles.summaryValue}>{tierName} × {qty}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ID Booking</Text>
              <Text style={[styles.summaryValue, styles.mono]} numberOfLines={1}>{id}</Text>
            </View>
            <View style={[styles.summaryRow, styles.lastRow]}>
              <Text style={styles.summaryLabel}>Harga Tiket</Text>
              <Text style={[styles.summaryValue, { color: BLUE, fontWeight: '700' }]}>{fmt(ticketAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Penginapan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Penginapan</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>Opsional</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.iconBtn, sortBy !== 'distance' && styles.iconBtnActive]}
              onPress={() => openModal('sort')}
              activeOpacity={0.8}
            >
              <Text style={[styles.iconBtnText, sortBy !== 'distance' && styles.iconBtnTextActive]}>↕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
              onPress={() => openModal('filter')}
              activeOpacity={0.8}
            >
              <Text style={[styles.iconBtnText, activeFilterCount > 0 && styles.iconBtnTextActive]}>≡</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {displayedHotels.map(hotel => {
            const isSelected = selectedHotel === hotel.id;
            const dist = fmtDist(hotel.distance_km);
            return (
              <TouchableOpacity
                key={hotel.id}
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                onPress={() => setSelectedHotel(isSelected ? null : hotel.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>🏨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel} numberOfLines={1}>{hotel.name}</Text>
                    <View style={styles.hotelMeta}>
                      <Text style={styles.starText}>{'⭐'.repeat(hotel.star_rating)}</Text>
                      {dist && (
                        <View style={[styles.distBadge, isSelected && styles.distBadgeActive]}>
                          <Text style={[styles.distText, isSelected && styles.distTextActive]}>
                            📍 {dist}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <Text style={[styles.optionPrice, isSelected && styles.optionPriceActive]}>
                  {fmt(hotel.base_price)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {displayedHotels.length === 0 && (
            <Text style={styles.emptyHint}>
              {(hotels ?? []).length === 0
                ? 'Tidak ada hotel tersedia di kota ini'
                : 'Tidak ada hotel yang sesuai filter'}
            </Text>
          )}
        </View>

        {/* Transportasi */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transportasi</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>Opsional</Text>
            </View>
          </View>
          <Text style={styles.sectionDesc}>Tambahkan transportasi menuju venue</Text>
          {TRANSPORT_OPTIONS.map(t => {
            const isSelected = selectedTransport === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                onPress={() => setSelectedTransport(isSelected ? null : t.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>{t.icon}</Text>
                  <Text style={styles.optionLabel}>{t.label}</Text>
                </View>
                <Text style={[styles.optionPrice, isSelected && styles.optionPriceActive]}>
                  {fmt(t.price)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Metode Pembayaran */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
          {PAYMENT_METHODS.map(pm => {
            const isSelected = selectedPayment === pm.id;
            return (
              <TouchableOpacity
                key={pm.id}
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                onPress={() => setSelectedPayment(pm.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>{pm.icon}</Text>
                  <View>
                    <Text style={styles.optionLabel}>{pm.label}</Text>
                    <Text style={styles.optionDesc}>{pm.desc}</Text>
                  </View>
                </View>
                <View style={[styles.radio, isSelected && styles.radioActive]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.timerBanner}>
          <Text style={styles.timerText}>⏱ Selesaikan pembayaran dalam 15 menit</Text>
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.breakdown}>
          {hotelAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Penginapan</Text>
              <Text style={styles.breakdownVal}>{fmt(hotelAmount)}</Text>
            </View>
          )}
          {transportAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Transportasi</Text>
              <Text style={styles.breakdownVal}>{fmt(transportAmount)}</Text>
            </View>
          )}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Biaya Platform (3%)</Text>
            <Text style={styles.breakdownVal}>{fmt(platformFee)}</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Pembayaran</Text>
          <Text style={styles.totalAmount}>{fmt(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePay} disabled={loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.payBtnText}>Bayar Sekarang</Text>}
        </TouchableOpacity>
      </View>

      {/* Sort & Filter Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />

            {/* Tabs */}
            <View style={styles.tabBar}>
              {(['sort', 'filter'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'sort' ? 'Urutkan' : `Filter${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {activeTab === 'sort' ? (
                <View style={styles.modalSection}>
                  {SORT_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.sortRow}
                      onPress={() => setPendingSort(opt.value)}
                    >
                      <Text style={[styles.sortLabel, pendingSort === opt.value && styles.sortLabelActive]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.radio, pendingSort === opt.value && styles.radioActive]}>
                        {pendingSort === opt.value && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.modalSection}>
                  {/* Bintang Hotel */}
                  <Text style={styles.filterGroupTitle}>Bintang Hotel</Text>
                  <View style={styles.pillRow}>
                    {[2, 3, 4, 5].map(star => {
                      const active = pendingStars.includes(star);
                      return (
                        <TouchableOpacity
                          key={star}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => togglePendingStar(star)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {'⭐'.repeat(star)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Rentang Harga */}
                  <Text style={styles.filterGroupTitle}>Rentang Harga</Text>
                  <View style={styles.pillRow}>
                    {PRICE_RANGES.map(pr => {
                      const active = pendingPrice === pr.value;
                      return (
                        <TouchableOpacity
                          key={pr.value}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setPendingPrice(pr.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {pr.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Jarak dari Venue */}
                  <Text style={styles.filterGroupTitle}>Jarak dari Venue</Text>
                  <View style={styles.pillRow}>
                    {DISTANCE_FILTERS.map(f => {
                      const active = pendingDist === f.value;
                      return (
                        <TouchableOpacity
                          key={f.value}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setPendingDist(f.value)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetModal} activeOpacity={0.8}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyModal} activeOpacity={0.85}>
                <Text style={styles.applyText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { padding: 20 },
  backChevron: { fontSize: 32, color: BLUE, fontWeight: '300', lineHeight: 36, marginLeft: 4 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  optionalBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  optionalText: { fontSize: 11, color: BLUE, fontWeight: '700' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  lastRow: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 2, textAlign: 'right' },
  mono: { fontSize: 11, color: '#6B7280' },

  // Icon buttons (sort & filter)
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: BLUE },
  iconBtnText: { fontSize: 16, color: '#6B7280', fontWeight: '700', lineHeight: 20 },
  iconBtnTextActive: { color: '#FFFFFF' },
  filterBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: '#EF4444', borderRadius: 7,
    minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 9, color: '#FFFFFF', fontWeight: '800' },

  // Hotel cards
  hotelMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  starText: { fontSize: 12 },
  distBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  distBadgeActive: { backgroundColor: 'rgba(29,99,237,0.15)' },
  distText: { fontSize: 11, color: BLUE, fontWeight: '600' },
  distTextActive: { color: BLUE },

  // Option cards (shared)
  optionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', padding: 14, marginBottom: 10,
  },
  optionCardActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  optionPrice: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  optionPriceActive: { color: BLUE },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: BLUE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },

  timerBanner: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14 },
  timerText: { fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', padding: 20,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8,
  },
  breakdown: { gap: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 12, color: '#9CA3AF' },
  breakdownVal: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#111827' },
  payBtn: { backgroundColor: BLUE, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, paddingBottom: 34,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16,
  },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BLUE },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: BLUE },

  modalSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  sortRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  sortLabel: { fontSize: 14, color: '#374151' },
  sortLabelActive: { fontWeight: '700', color: '#111827' },

  filterGroupTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: GREEN, borderColor: GREEN },
  pillText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },

  modalFooter: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  resetText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  applyBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center' },
  applyText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
