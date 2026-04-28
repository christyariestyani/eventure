import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { ApiEvent } from '../hooks/useEvents';

interface EventCardProps {
  event: Pick<ApiEvent, 'id' | 'title' | 'category' | 'start_at' | 'banner_url' | 'min_price' | 'is_available' | 'venue'>;
  onPress: () => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const date = format(new Date(event.start_at), 'EEE, d MMM yyyy', { locale: idLocale });
  const price = event.min_price
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(event.min_price)
    : null;

  const soldOut = !event.is_available;

  return (
    <TouchableOpacity
      style={[styles.card, soldOut && styles.cardSoldOut]}
      onPress={onPress}
      activeOpacity={soldOut ? 0.7 : 0.85}
    >
      <View style={styles.bannerWrap}>
        {event.banner_url ? (
          <Image source={{ uri: event.banner_url }} style={styles.banner} resizeMode="cover" />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]} />
        )}
        {soldOut && <View style={styles.bannerOverlay} />}
        {soldOut && (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryLabel}>{event.category.toUpperCase()}</Text>
        </View>

        <Text style={[styles.title, soldOut && styles.titleSoldOut]} numberOfLines={2}>
          {event.title}
        </Text>

        <Text style={styles.venue} numberOfLines={1}>
          {event.venue.name} · {event.venue.city}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.date}>{date}</Text>
          {soldOut ? (
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutPillText}>Tiket Habis</Text>
            </View>
          ) : price ? (
            <Text style={styles.price}>Mulai {price}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSoldOut: { opacity: 0.82 },
  bannerWrap: { position: 'relative' },
  banner: { width: '100%', height: 180 },
  bannerPlaceholder: { backgroundColor: '#E5E7EB' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  soldOutBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  content: { padding: 14 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryLabel: { color: '#1D63ED', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4, lineHeight: 22 },
  titleSoldOut: { color: '#6B7280' },
  venue: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 13, color: '#374151', fontWeight: '500' },
  price: { fontSize: 14, fontWeight: '700', color: '#1D63ED' },
  soldOutPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  soldOutPillText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
});
