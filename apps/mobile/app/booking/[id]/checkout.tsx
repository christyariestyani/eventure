import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInitiatePayment } from '../../../hooks/useBooking';

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const initiatePayment = useInitiatePayment();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const result = await initiatePayment.mutateAsync(id);
      // Dalam implementasi nyata: buka Midtrans Snap WebView
      // dengan result.payment_token
      Alert.alert(
        'Lanjut ke Pembayaran',
        `Token: ${result.payment_token}\n\nIntegrasi Midtrans Snap akan membuka WebView.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/bookings') }]
      );
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'BOOKING_EXPIRED') {
        Alert.alert('Booking Kadaluarsa', 'Waktu pemesanan habis. Silakan pesan ulang.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Error', 'Gagal membuat pembayaran. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Booking ID: {id}</Text>
            <Text style={styles.infoHint}>
              Detail lengkap booking tersedia di halaman Tiket Saya setelah pembayaran.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
          <View style={styles.paymentOptions}>
            {['GoPay', 'QRIS', 'Transfer Bank', 'Kartu Kredit'].map(method => (
              <View key={method} style={styles.paymentChip}>
                <Text style={styles.paymentChipText}>{method}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.paymentNote}>
            Pilih metode pembayaran di halaman Midtrans
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.timerNote}>
            ⏱ Selesaikan pembayaran dalam 15 menit sebelum booking dibatalkan
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
  container: { padding: 20, gap: 20, paddingBottom: 120 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  infoHint: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  paymentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  paymentChipText: { fontSize: 13, color: '#6366F1', fontWeight: '600' },
  paymentNote: { fontSize: 13, color: '#6B7280' },
  timerNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  payBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
