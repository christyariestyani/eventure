import React from 'react';
import {
  View, Text, Image, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useEvent } from '../../hooks/useEvents';
import TierSelector from '../../components/TierSelector';
import { useCreateBooking } from '../../hooks/useBooking';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: event, isLoading } = useEvent(id);
  const createBooking = useCreateBooking();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Event tidak ditemukan</Text>
      </View>
    );
  }

  const handleSelectTier = async (tierId: string, quantity: number) => {
    try {
      const booking = await createBooking.mutateAsync({ ticket_tier_id: tierId, quantity });
      router.push(`/booking/${booking.booking_id}/checkout`);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'QUOTA_INSUFFICIENT') {
        alert('Maaf, tiket habis. Coba tier lain.');
      } else {
        alert('Terjadi kesalahan. Coba lagi.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {event.banner_url ? (
          <Image source={{ uri: event.banner_url }} style={styles.banner} resizeMode="cover" />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]} />
        )}

        <View style={styles.body}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryLabel}>{event.category.toUpperCase()}</Text>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>
              {format(new Date(event.start_at), 'EEEE, d MMMM yyyy · HH:mm', { locale: idLocale })}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>
              {event.venue.name}, {event.venue.city}
            </Text>
          </View>

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tentang Event</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <TierSelector tiers={event.ticket_tiers} onSelect={handleSelectTier} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#6B7280' },
  banner: { width: '100%', height: 240 },
  bannerPlaceholder: { backgroundColor: '#E5E7EB' },
  body: { padding: 20, gap: 8 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  categoryLabel: { color: '#6366F1', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 30, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoIcon: { fontSize: 16 },
  infoText: { fontSize: 14, color: '#374151', flex: 1 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10 },
  description: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
});
