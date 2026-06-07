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

const P = '#5B8EF0';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7' },
  awaiting_payment: { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7' },
  confirmed:        { label: 'Dikonfirmasi',   color: '#059669', bg: '#D1FAE5' },
  completed:        { label: 'Selesai',         color: '#6B7280', bg: '#F3F4F6' },
  cancelled:        { label: 'Dibatalkan',      color: '#DC2626', bg: '#FEE2E2' },
  refunded:         { label: 'Direfund',        color: '#7C3AED', bg: '#EDE9FE' },
};

export default function BookingsScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const { data, isLoading } = useBookings();

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tiket Saya</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎫</Text>
          <Text style={styles.emptyTitle}>Belum Login</Text>
          <Text style={styles.emptyText}>Login untuk melihat tiket kamu</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Login / Daftar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tiket Saya</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={P} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const bookings = data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tiket Saya</Text>
        <Text style={styles.headerSub}>{bookings.length} pemesanan</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
          const ticketItem    = item.booking_items?.find((i: any) => i.item_type === 'ticket');
          const event         = ticketItem?.ticket_tiers?.events;
          const hotelItem     = item.booking_items?.find((i: any) => i.item_type === 'accommodation');
          const outboundItem  = item.booking_items?.find((i: any) => i.item_type === 'outbound_transport');
          const returnItem    = item.booking_items?.find((i: any) => i.item_type === 'return_transport');
          const legacyTransItem = item.booking_items?.find((i: any) => i.item_type === 'transport');

          const ticketSubtotal = ticketItem?.subtotal ?? 0;
          const platformFee    = item.platform_fee ?? Math.round(ticketSubtotal * 0.03);

          const hotelMeta      = hotelItem?.metadata;
          const hotelSubtotal  = (() => {
            const unitPrice = hotelItem?.unit_price;
            if (!unitPrice) return hotelItem?.subtotal ?? 0;
            const nights = hotelMeta?.nights
              ?? (hotelMeta?.check_in && hotelMeta?.check_out
                  ? Math.max(1, differenceInDays(parseISO(hotelMeta.check_out), parseISO(hotelMeta.check_in)))
                  : null)
              ?? (hotelItem?.quantity && hotelItem.quantity > 1 ? hotelItem.quantity : null);
            const roomQty = Math.max(1, hotelMeta?.room_qty);
            if (nights || roomQty) return unitPrice * Math.max(1, nights) * Math.max(1, roomQty) + (hotelMeta?.extra_fees ?? 0);
            return hotelItem?.subtotal ?? 0;
          })();

          const outboundSubtotal   = outboundItem?.subtotal ?? outboundItem?.metadata?.price ?? 0;
          const returnSubtotal     = returnItem?.subtotal   ?? returnItem?.metadata?.price   ?? 0;
          const hasNewTransport    = outboundItem || returnItem || outboundSubtotal > 0 || returnSubtotal > 0;
          const legacyTransSubtotal = (!hasNewTransport && legacyTransItem) ? (legacyTransItem.subtotal ?? 0) : 0;

          const displayTotal = (ticketSubtotal + hotelSubtotal + outboundSubtotal + returnSubtotal + legacyTransSubtotal + platformFee)
            || (item.total_amount ?? 0);

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(`/booking/${item.booking_number}`)}
            >
              {/* Status strip */}
              <View style={[styles.statusStrip, { backgroundColor: status.bg }]}>
                <View style={styles.statusDot}>
                  <View style={[styles.dot, { backgroundColor: status.color }]} />
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
                <Text style={styles.bookingNum}>{item.booking_number}</Text>
              </View>

              <View style={styles.cardBody}>
                {/* Event info */}
                <View style={styles.eventRow}>
                  <View style={styles.eventIcon}>
                    <Text style={styles.eventIconText}>🎫</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {event?.title ?? `Booking #${item.booking_number}`}
                    </Text>
                    {event?.start_at && (
                      <Text style={styles.eventDate}>
                        {format(new Date(event.start_at), 'EEE, d MMM yyyy', { locale: idLocale })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Add-ons */}
                {(hotelItem || outboundItem || returnItem || legacyTransItem) && (
                  <View style={styles.addonRow}>
                    {hotelItem && (
                      <View style={styles.addonChip}>
                        <Text style={styles.addonText}>🏨 Hotel</Text>
                      </View>
                    )}
                    {(outboundItem || returnItem || legacyTransItem) && (
                      <View style={styles.addonChip}>
                        <Text style={styles.addonText}>🚌 Transport</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.totalLabel}>Total Pembayaran</Text>
                    <Text style={styles.totalAmount}>
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
                      }).format(displayTotal)}
                    </Text>
                  </View>
                  <View style={styles.detailBtn}>
                    <Text style={styles.detailBtnText}>Detail →</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={styles.emptyTitle}>Belum ada tiket</Text>
            <Text style={styles.emptyText}>Temukan event seru dan pesan sekarang!</Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.loginBtnText}>Jelajahi Event</Text>
            </TouchableOpacity>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF2F9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  headerSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },

  list: { padding: 16, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  loginBtn: {
    backgroundColor: P, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 12, marginTop: 8,
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#5B8EF0', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  statusStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
  },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  bookingNum: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  cardBody: { padding: 14, gap: 10 },
  eventRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  eventIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center',
  },
  eventIconText: { fontSize: 22 },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', lineHeight: 21 },
  eventDate: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  addonRow: { flexDirection: 'row', gap: 8 },
  addonChip: {
    backgroundColor: '#EEF3FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  addonText: { fontSize: 12, color: P, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  totalLabel: { fontSize: 11, color: '#94A3B8' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginTop: 1 },
  detailBtn: {
    backgroundColor: '#EEF3FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  detailBtnText: { fontSize: 13, color: P, fontWeight: '700' },
});
