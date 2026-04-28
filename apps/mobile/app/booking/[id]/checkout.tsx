import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useInitiatePayment } from '../../../hooks/useBooking';
import { api } from '../../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAccommodations } from '../../../hooks/useAccommodations';

const BLUE = '#1D63ED';

const TRANSPORT_OPTIONS = [
  { id: 'bus', label: 'Bus Pariwisata', icon: '🚌', price: 150000 },
  { id: 'train', label: 'Kereta Eksekutif', icon: '🚂', price: 200000 },
  { id: 'flight', label: 'Pesawat', icon: '✈️', price: 500000 },
  { id: 'private', label: 'Travel Privat', icon: '🚐', price: 350000 },
];

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS', icon: '📱', desc: 'GoPay, OVO, Dana, ShopeePay, dll' },
  { id: 'va', label: 'Transfer Bank', icon: '🏦', desc: 'BCA, Mandiri, BNI, BRI, Permata' },
  { id: 'card', label: 'Kartu Debit / Kredit', icon: '💳', desc: 'Visa, Mastercard, JCB' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function CheckoutScreen() {
  const { id, city, baseAmount, eventTitle, tierName, qty } =
    useLocalSearchParams<{
      id: string;
      city?: string;
      baseAmount?: string;
      eventTitle?: string;
      tierName?: string;
      qty?: string;
    }>();
  const router = useRouter();
  const initiatePayment = useInitiatePayment();
  const queryClient = useQueryClient();
  const { data: hotels } = useAccommodations(city);

  const [selectedHotel, setSelectedHotel] = useState<string | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ticketAmount = parseFloat(baseAmount ?? '0');
  const hotelAmount = selectedHotel
    ? (hotels?.find(h => h.id === selectedHotel)?.base_price ?? 0)
    : 0;
  const transportAmount = selectedTransport
    ? (TRANSPORT_OPTIONS.find(t => t.id === selectedTransport)?.price ?? 0)
    : 0;
  const platformFee = Math.round(ticketAmount * 0.03);
  const total = ticketAmount + hotelAmount + transportAmount + platformFee;

  const handlePay = async () => {
    if (!selectedPayment) {
      Alert.alert('Pilih Pembayaran', 'Silakan pilih metode pembayaran terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      if (selectedHotel || selectedTransport) {
        const transportPrice = selectedTransport
          ? TRANSPORT_OPTIONS.find(t => t.id === selectedTransport)?.price
          : undefined;
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

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Checkout',
        headerBackVisible: false,
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
          </View>
          <Text style={styles.sectionDesc}>Tambahkan hotel untuk pengalaman terbaik</Text>
          {(hotels ?? []).map(hotel => {
            const isSelected = selectedHotel === hotel.id;
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
                    <Text style={styles.optionDesc}>
                      {'⭐'.repeat(hotel.star_rating)} · {hotel.city}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.optionPrice, isSelected && styles.optionPriceActive]}>
                  {fmt(hotel.base_price)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {(hotels ?? []).length === 0 && (
            <Text style={styles.emptyHint}>Tidak ada hotel tersedia di kota ini</Text>
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

        {/* Timer */}
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
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.payBtnText}>Bayar Sekarang</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { padding: 20 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  optionalBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  optionalText: { fontSize: 11, color: BLUE, fontWeight: '700' },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  lastRow: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 2, textAlign: 'right' },
  mono: { fontSize: 11, color: '#6B7280' },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  optionCardActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  optionPrice: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  optionPriceActive: { color: BLUE },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },

  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: BLUE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },

  timerBanner: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14,
  },
  timerText: { fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', padding: 20,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 8,
  },
  breakdown: { gap: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 12, color: '#9CA3AF' },
  breakdownVal: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#111827' },
  payBtn: {
    backgroundColor: BLUE, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backChevron: { fontSize: 32, color: '#1D63ED', fontWeight: '300', lineHeight: 36, marginLeft: 4 },
});
