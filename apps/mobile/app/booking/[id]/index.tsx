import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useBookingDetail } from '../../../hooks/useBooking';

const BLUE = '#1D63ED';

const TRANSPORT_NAMES: Record<number, string> = {
  150000: 'Bus Pariwisata',
  200000: 'Kereta Eksekutif',
  350000: 'Travel Privat',
  500000: 'Pesawat',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:          { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
  awaiting_payment: { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
  confirmed:        { label: 'Dikonfirmasi',   color: '#059669', bg: '#D1FAE5', icon: '✅' },
  completed:        { label: 'Selesai',         color: '#6B7280', bg: '#F3F4F6', icon: '🎉' },
  cancelled:        { label: 'Dibatalkan',      color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  refunded:         { label: 'Direfund',        color: '#7C3AED', bg: '#EDE9FE', icon: '↩️' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: booking, isLoading, error } = useBookingDetail(id);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Booking tidak ditemukan</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBackBtn}>
            <Text style={styles.errorBackBtnText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const items: any[] = booking.booking_items ?? [];
  const ticketItem = items.find((i: any) => i.item_type === 'ticket');
  const hotelItem = items.find((i: any) => i.item_type === 'accommodation');
  const transportItem = items.find((i: any) => i.item_type === 'transport');
  const event = ticketItem?.ticket_tiers?.events;
  const venue = event?.venues;
  const issuedTickets: any[] = ticketItem?.tickets ?? [];

  const ticketSubtotal = ticketItem?.subtotal ?? 0;
  const hotelSubtotal = hotelItem?.subtotal ?? 0;
  const platformFee = booking.platform_fee ?? 0;

  // Transport: coba dari booking_item, lalu dari notes, lalu dari selisih total
  let transportPrice = transportItem?.subtotal ?? 0;
  if (!transportPrice && booking.notes?.startsWith('transport:')) {
    transportPrice = parseInt(booking.notes.split(':')[1], 10) || 0;
  }
  if (!transportPrice) {
    const knownTotal = ticketSubtotal + hotelSubtotal + platformFee;
    const inferred = Math.round(booking.total_amount - knownTotal);
    if (inferred > 0) transportPrice = inferred;
  }
  const transportName = TRANSPORT_NAMES[transportPrice] ?? 'Transportasi';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Tiket</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
          <Text style={styles.statusIcon}>{status.icon}</Text>
          <View>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            <Text style={styles.bookingNum}>#{booking.booking_number}</Text>
          </View>
        </View>

        {/* Event Info */}
        {event ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event</Text>
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📅</Text>
                <Text style={styles.infoText}>
                  {format(new Date(event.start_at), 'EEEE, d MMMM yyyy · HH:mm', { locale: idLocale })}
                </Text>
              </View>
              {venue && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <Text style={styles.infoText}>{venue.name}, {venue.city}</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Tiket */}
        {ticketItem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiket</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.itemLabel}>{ticketItem.ticket_tiers?.name ?? 'Tiket'}</Text>
                <Text style={styles.itemQty}>× {ticketItem.quantity}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.itemSubLabel}>Harga per tiket</Text>
                <Text style={styles.itemValue}>{fmt(ticketItem.unit_price ?? 0)}</Text>
              </View>
              <View style={[styles.row, styles.subtotalRow]}>
                <Text style={styles.subtotalLabel}>Subtotal Tiket</Text>
                <Text style={styles.subtotalValue}>{fmt(ticketSubtotal)}</Text>
              </View>

              {/* QR Codes */}
              {issuedTickets.length > 0 && (
                <View style={styles.qrSection}>
                  <View style={styles.divider} />
                  <Text style={styles.qrTitle}>Kode Tiket</Text>
                  {issuedTickets.map((t: any, idx: number) => (
                    <View key={t.id} style={styles.qrBox}>
                      <View style={styles.qrPlaceholder}>
                        <Text style={styles.qrEmoji}>🎟</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qrLabel}>Tiket {idx + 1}</Text>
                        <Text style={styles.qrCode} numberOfLines={1}>{t.qr_code}</Text>
                        <View style={[styles.ticketStatusBadge,
                          { backgroundColor: t.status === 'issued' ? '#D1FAE5' : '#F3F4F6' }]}>
                          <Text style={[styles.ticketStatusText,
                            { color: t.status === 'issued' ? '#059669' : '#6B7280' }]}>
                            {t.status === 'issued' ? 'Aktif' : t.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Penginapan */}
        {hotelItem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Penginapan</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.infoIcon}>🏨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{hotelItem.accommodations?.name ?? 'Hotel'}</Text>
                  {hotelItem.accommodations?.star_rating ? (
                    <Text style={styles.itemSubLabel}>
                      {'⭐'.repeat(hotelItem.accommodations.star_rating)} · {hotelItem.accommodations.city}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.row, styles.subtotalRow]}>
                <Text style={styles.subtotalLabel}>Subtotal Penginapan</Text>
                <Text style={styles.subtotalValue}>{fmt(hotelSubtotal)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Transportasi */}
        {transportPrice > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transportasi</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.infoIcon}>🚌</Text>
                <Text style={styles.itemLabel}>{transportName}</Text>
              </View>
              <View style={[styles.row, styles.subtotalRow]}>
                <Text style={styles.subtotalLabel}>Subtotal Transportasi</Text>
                <Text style={styles.subtotalValue}>{fmt(transportPrice)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ringkasan Pembayaran */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pembayaran</Text>
          <View style={styles.card}>
            {ticketSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tiket</Text>
                <Text style={styles.breakdownVal}>{fmt(ticketSubtotal)}</Text>
              </View>
            )}
            {hotelSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Penginapan</Text>
                <Text style={styles.breakdownVal}>{fmt(hotelSubtotal)}</Text>
              </View>
            )}
            {transportPrice > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transportasi</Text>
                <Text style={styles.breakdownVal}>{fmt(transportPrice)}</Text>
              </View>
            )}
            {platformFee > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Biaya Platform</Text>
                <Text style={styles.breakdownVal}>{fmt(platformFee)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>Total Dibayar</Text>
              <Text style={styles.totalAmount}>{fmt(booking.total_amount)}</Text>
            </View>
            {booking.paid_at && (
              <Text style={styles.paidAt}>
                Dibayar pada {format(new Date(booking.paid_at), 'd MMM yyyy, HH:mm', { locale: idLocale })}
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 16, color: '#6B7280', marginBottom: 16 },
  errorBackBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: BLUE, borderRadius: 10 },
  errorBackBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 36, color: BLUE, fontWeight: '300', lineHeight: 40 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  container: { padding: 16, gap: 0 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  statusIcon: { fontSize: 28 },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  bookingNum: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, gap: 10,
  },

  eventTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoIcon: { fontSize: 14, marginTop: 1 },
  infoText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 19 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  itemQty: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  itemSubLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  subtotalRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 2 },
  subtotalLabel: { fontSize: 13, color: '#6B7280' },
  subtotalValue: { fontSize: 13, fontWeight: '700', color: '#111827' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  qrSection: { gap: 10 },
  qrTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  qrBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrPlaceholder: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#DBEAFE',
  },
  qrEmoji: { fontSize: 24 },
  qrLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  qrCode: { fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 },
  ticketStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  ticketStatusText: { fontSize: 11, fontWeight: '700' },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, color: '#6B7280' },
  breakdownVal: { fontSize: 13, color: '#374151', fontWeight: '500' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: BLUE },
  paidAt: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
});
