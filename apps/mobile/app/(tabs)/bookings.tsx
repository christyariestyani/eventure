import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useBookings } from '../../hooks/useBooking';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7' },
  awaiting_payment: { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7' },
  confirmed: { label: 'Dikonfirmasi', color: '#059669', bg: '#D1FAE5' },
  completed: { label: 'Selesai', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: 'Dibatalkan', color: '#DC2626', bg: '#FEE2E2' },
  refunded: { label: 'Direfund', color: '#7C3AED', bg: '#EDE9FE' },
};

export default function BookingsScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const { data, isLoading } = useBookings();

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Belum Login</Text>
          <Text style={styles.emptyText}>Login untuk melihat tiket kamu</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  const bookings = data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Tiket Saya</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
          const ticketItem = item.booking_items?.find((i: any) => i.item_type === 'ticket');
          const event = ticketItem?.ticket_tiers?.events;

          const hotelItem = item.booking_items?.find((i: any) => i.item_type === 'accommodation');
          const hasAddons = !!hotelItem || !!(item as any).notes?.startsWith('transport:');

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/booking/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.bookingNum}>{item.booking_number}</Text>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              {event ? (
                <>
                  <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventDate}>
                    {format(new Date(event.start_at), 'EEE, d MMM yyyy', { locale: idLocale })}
                  </Text>
                </>
              ) : (
                <Text style={styles.eventTitle}>Booking #{item.booking_number}</Text>
              )}

              {hasAddons && (
                <View style={styles.addonRow}>
                  {hotelItem && <Text style={styles.addonChip}>🏨 Hotel</Text>}
                  {(item as any).notes?.startsWith('transport:') && (
                    <Text style={styles.addonChip}>🚌 Transport</Text>
                  )}
                </View>
              )}

              <View style={styles.cardBottom}>
                <Text style={styles.totalLabel}>Total Bayar</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.totalAmount}>
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
                    }).format(item.total_amount)}
                  </Text>
                  <Text style={styles.tapHint}>Tap untuk detail →</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Belum ada tiket</Text>
            <Text style={styles.emptyText}>Temukan event seru dan pesan sekarang!</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  list: { padding: 16, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  loginBtn: {
    backgroundColor: '#1D63ED',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingNum: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  eventDate: { fontSize: 13, color: '#6B7280' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: { fontSize: 13, color: '#6B7280' },
  totalAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tapHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  addonRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  addonChip: {
    fontSize: 11, color: '#1D63ED', backgroundColor: '#EFF6FF',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontWeight: '600',
  },
});
