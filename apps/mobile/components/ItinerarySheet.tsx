import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useItinerary } from '../hooks/useItinerary';
import { useTrackBehavior } from '../hooks/useBehavior';
import { useCreateBooking } from '../hooks/useBooking';

const P = '#5B8EF0';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);

interface Props {
  eventId: string | null;
  visible: boolean;
  onClose: () => void;
}

export default function ItinerarySheet({ eventId, visible, onClose }: Props) {
  const router         = useRouter();
  const track          = useTrackBehavior();
  const createBooking  = useCreateBooking();
  const { data: bundle, isLoading } = useItinerary(visible ? eventId : null);

  const handleBookBundle = async () => {
    if (!bundle?.recommended_ticket) return;
    try {
      const booking = await createBooking.mutateAsync({
        ticket_tier_id: bundle.recommended_ticket.id,
        quantity: 1,
      });
      onClose();
      router.push({
        pathname: `/booking/${booking.booking_number}/checkout` as any,
        params: {
          baseAmount:                String(bundle.recommended_ticket.price),
          eventTitle:                bundle.event.title,
          tierName:                  bundle.recommended_ticket.name,
          qty:                       '1',
          city:                      bundle.event.venue.city,
          venueLat:                  String(bundle.event.venue.latitude),
          venueLng:                  String(bundle.event.venue.longitude),
          preselectedHotelId:        bundle.accommodation?.id ?? '',
          preselectedTransportPrice: String(bundle.transport.estimated_price),
          eventStartAt:              bundle.event.start_at,
          eventEndAt:                bundle.event.end_at ?? '',
          venueName:                 bundle.event.venue.name,
          venueAddress:              bundle.event.venue.address,
        },
      });
    } catch (err: any) {
      const code = err?.response?.data?.error;
      Alert.alert(
        'Gagal memesan',
        code === 'QUOTA_INSUFFICIENT'
          ? 'Tiket ini sudah habis.'
          : 'Terjadi kesalahan, coba lagi.',
      );
    }
  };

  React.useEffect(() => {
    if (visible && eventId) track(eventId, 'itinerary_view');
  }, [visible, eventId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Paket Perjalanan</Text>
            <Text style={styles.headerTitle}>
              {bundle?.event.title ?? 'Memuat...'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {isLoading || !bundle ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={P} />
            <Text style={styles.loadingText}>Menyusun itinerary...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Event date */}
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>
                📅 {format(new Date(bundle.event.start_at), 'EEE, d MMMM yyyy', { locale: idLocale })}
              </Text>
              <Text style={styles.cityText}>📍 {bundle.event.venue.city}</Text>
            </View>

            {/* Ticket */}
            <SectionCard title="🎫 Tiket" color="#EEF3FF">
              {bundle.recommended_ticket ? (
                <Row
                  label={bundle.recommended_ticket.name}
                  value={fmt(bundle.recommended_ticket.price)}
                  sub={`${bundle.recommended_ticket.available_quota} tiket tersisa`}
                />
              ) : (
                <Text style={styles.soldOut}>Tiket sudah habis</Text>
              )}
            </SectionCard>

            {/* Accommodation */}
            <SectionCard title="🏨 Penginapan" color="#F0FDF4">
              {bundle.accommodation ? (
                <>
                  <Row
                    label={bundle.accommodation.name}
                    value={fmt(bundle.accommodation.base_price)}
                    sub={`${bundle.accommodation.star_rating}⭐  •  ${bundle.accommodation.distance_km} km dari venue`}
                  />
                </>
              ) : (
                <Text style={styles.naText}>Tidak ada penginapan tersedia</Text>
              )}
            </SectionCard>

            {/* Transport */}
            <SectionCard title="🚌 Transportasi" color="#FFF7ED">
              <Row
                label={bundle.transport.note}
                value={bundle.transport.estimated_price > 0
                  ? fmt(bundle.transport.estimated_price)
                  : 'Gratis'}
              />
            </SectionCard>

            {/* Day schedule */}
            <View style={styles.scheduleCard}>
              <Text style={styles.sectionTitle}>📋 Jadwal Hari H</Text>
              <View style={styles.timeline}>
                {bundle.day_schedule.map((item, i) => (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <Text style={styles.timelineTime}>{item.time}</Text>
                      {i < bundle.day_schedule.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineActivity}>{item.activity}</Text>
                      <Text style={styles.timelineLocation} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Cost summary */}
            <View style={styles.costCard}>
              <Text style={styles.sectionTitle}>💰 Estimasi Total Biaya</Text>
              <View style={styles.costRows}>
                <CostRow label="Tiket"        amount={bundle.cost_summary.ticket} />
                <CostRow label="Penginapan"   amount={bundle.cost_summary.accommodation} />
                <CostRow label="Transportasi" amount={bundle.cost_summary.transport} />
                <CostRow label="Biaya layanan" amount={bundle.cost_summary.platform_fee} small />
                <View style={styles.costDivider} />
                <CostRow label="Total" amount={bundle.cost_summary.total} bold />
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* CTA */}
        {bundle?.recommended_ticket && (
          <View style={styles.ctaWrap}>
            <View style={styles.ctaTotal}>
              <Text style={styles.ctaTotalLabel}>Estimasi total</Text>
              <Text style={styles.ctaTotalAmount}>{fmt(bundle.cost_summary.total)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.ctaBtn, createBooking.isPending && styles.ctaBtnLoading]}
              onPress={handleBookBundle}
              disabled={createBooking.isPending}
              activeOpacity={0.85}
            >
              {createBooking.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.ctaBtnText}>Pesan Sekarang →</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: color }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.rowWrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function CostRow({ label, amount, bold, small }: { label: string; amount: number; bold?: boolean; small?: boolean }) {
  return (
    <View style={styles.costRow}>
      <Text style={[styles.costLabel, bold && styles.costBold, small && styles.costSmall]}>{label}</Text>
      <Text style={[styles.costAmount, bold && styles.costBold, small && styles.costSmall]}>
        {amount > 0 ? fmt(amount) : 'Gratis'}
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFD' },

  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4, backgroundColor: '#FFFFFF' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: '#EFF2F9',
  },
  headerLabel: { fontSize: 12, color: P, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', maxWidth: 260 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 12, color: '#64748B', fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#94A3B8' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  dateBadge: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#EFF2F9',
  },
  dateText: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  cityText: { fontSize: 13, color: '#64748B' },

  sectionCard:  { borderRadius: 14, padding: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 10 },

  rowWrap:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel:  { fontSize: 14, color: '#1E293B', fontWeight: '500', flex: 1 },
  rowSub:    { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowValue:  { fontSize: 15, fontWeight: '800', color: P },
  soldOut:   { fontSize: 13, color: '#DC2626', fontWeight: '600' },
  naText:    { fontSize: 13, color: '#94A3B8' },

  // Timeline
  scheduleCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EFF2F9' },
  timeline:     { gap: 0 },
  timelineRow:  { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 48, alignItems: 'center' },
  timelineTime: { fontSize: 12, fontWeight: '700', color: P, paddingTop: 2 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#EEF3FF', marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineActivity: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  timelineLocation: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Cost summary
  costCard:    { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EFF2F9' },
  costRows:    { gap: 8 },
  costRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel:   { fontSize: 13, color: '#64748B' },
  costAmount:  { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  costBold:    { fontWeight: '800', fontSize: 15, color: '#1E293B' },
  costSmall:   { fontSize: 11, color: '#94A3B8' },
  costDivider: { height: 1, backgroundColor: '#EFF2F9', marginVertical: 4 },

  // CTA
  ctaWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#EFF2F9',
  },
  ctaTotal:       { flex: 1 },
  ctaTotalLabel:  { fontSize: 11, color: '#94A3B8' },
  ctaTotalAmount: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  ctaBtn:         { backgroundColor: P, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, minWidth: 56, alignItems: 'center' },
  ctaBtnLoading:  { opacity: 0.7 },
  ctaBtnText:     { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
