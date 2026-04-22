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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {event.banner_url ? (
        <Image source={{ uri: event.banner_url }} style={styles.banner} resizeMode="cover" />
      ) : (
        <View style={[styles.banner, styles.bannerPlaceholder]} />
      )}

      {!event.is_available && (
        <View style={styles.soldOutBadge}>
          <Text style={styles.soldOutText}>SOLD OUT</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryLabel}>{event.category.toUpperCase()}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        <Text style={styles.venue} numberOfLines={1}>
          {event.venue.name} · {event.venue.city}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.date}>{date}</Text>
          {price && (
            <Text style={[styles.price, !event.is_available && styles.priceUnavailable]}>
              {event.is_available ? `Mulai ${price}` : 'Habis'}
            </Text>
          )}
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
  banner: { width: '100%', height: 180 },
  bannerPlaceholder: { backgroundColor: '#E5E7EB' },
  soldOutBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soldOutText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  content: { padding: 14 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryLabel: { color: '#6366F1', fontSize: 11, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4, lineHeight: 22 },
  venue: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 13, color: '#374151', fontWeight: '500' },
  price: { fontSize: 14, fontWeight: '700', color: '#6366F1' },
  priceUnavailable: { color: '#9CA3AF' },
});
