import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { ApiEvent } from '../hooks/useEvents';

interface EventCardProps {
  event: Pick<ApiEvent, 'id' | 'title' | 'category' | 'start_at' | 'banner_url' | 'min_price' | 'is_available' | 'venue' | 'organizer'>;
  onPress: () => void;
}

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  music:    { bg: '#EDE9FE', text: '#7C3AED' },
  sports:   { bg: '#DCFCE7', text: '#16A34A' },
  festival: { bg: '#FEF3C7', text: '#D97706' },
  default:  { bg: '#DBEAFE', text: '#1D4ED8' },
};

export default function EventCard({ event, onPress }: EventCardProps) {
  const date = format(new Date(event.start_at), 'EEE, d MMM yyyy', { locale: idLocale });
  const price = event.min_price
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
      }).format(event.min_price)
    : null;

  const soldOut = !event.is_available;
  const catStyle = CATEGORY_COLOR[event.category] ?? CATEGORY_COLOR.default;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* Banner */}
      <View style={styles.bannerWrap}>
        {event.banner_url ? (
          <Image source={{ uri: event.banner_url }} style={styles.banner} resizeMode="cover" />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]} />
        )}
        {soldOut && <View style={styles.bannerDim} />}

        <View style={[styles.categoryPill, { backgroundColor: catStyle.bg }]}>
          <Text style={[styles.categoryText, { color: catStyle.text }]}>
            {event.category.toUpperCase()}
          </Text>
        </View>

        {soldOut && (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, soldOut && styles.titleDim]} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📍</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {event.venue.city}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>{date}</Text>
        </View>

        {event.organizer?.full_name && (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🏢</Text>
            <Text style={styles.organizerText} numberOfLines={1}>
              {event.organizer.full_name}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {soldOut ? (
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutPillText}>Tiket Habis</Text>
            </View>
          ) : price ? (
            <View>
              <Text style={styles.priceFrom}>Mulai dari</Text>
              <Text style={styles.price}>{price}</Text>
            </View>
          ) : (
            <Text style={styles.priceFree}>Gratis</Text>
          )}

          {!soldOut && (
            <View style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>Pesan →</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerWrap: { position: 'relative' },
  banner: { width: '100%', height: 170 },
  bannerPlaceholder: { backgroundColor: '#E5E7EB' },
  bannerDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  categoryPill: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  categoryText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  soldOutBadge: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  soldOutText: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 3,
    borderWidth: 2, borderColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4, overflow: 'hidden',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  info: { padding: 14, gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 21 },
  titleDim: { color: '#6B7280' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 12 },
  metaText:      { fontSize: 12, color: '#6B7280', flex: 1 },
  organizerText: { fontSize: 12, color: '#5B8EF0', flex: 1, fontWeight: '600' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  priceFrom: { fontSize: 10, color: '#9CA3AF' },
  price: { fontSize: 15, fontWeight: '800', color: '#5B8EF0' },
  priceFree: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  bookBtn: {
    backgroundColor: '#5B8EF0', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  soldOutPill: {
    backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  soldOutPillText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
});
