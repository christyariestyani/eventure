import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents, useRecommendations } from '../../hooks/useEvents';
import EventCard from '../../components/EventCard';

const CATEGORIES = [
  { label: 'Semua', value: undefined },
  { label: 'Musik', value: 'music' },
  { label: 'Olahraga', value: 'sports' },
  { label: 'Festival', value: 'festival' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [debouncedQ, setDebouncedQ] = useState('');

  const { events, isLoading, refetch } = useEvents({
    q: debouncedQ || undefined,
    category: activeCategory,
  });

  const { data: recommended } = useRecommendations();

  const handleSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => setDebouncedQ(text), 400);
  };

  const showRecommended = !debouncedQ && !activeCategory && (recommended ?? []).length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.logo}>eventure</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari event, artis, kota..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={item => item.label}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chip,
              activeCategory === item.value && styles.chipActive,
            ]}
            onPress={() => setActiveCategory(item.value)}
          >
            <Text style={[styles.chipText, activeCategory === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={events}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          showRecommended ? (
            <>
              <Text style={styles.sectionTitle}>Untukmu</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
              >
                {(recommended ?? []).slice(0, 5).map(item => (
                  <View key={`rec-${item.id}`} style={{ width: 240 }}>
                    <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
                  </View>
                ))}
              </ScrollView>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Event Mendatang</Text>
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>Tidak ada event ditemukan</Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  logo: { fontSize: 22, fontWeight: '800', color: '#6366F1', letterSpacing: -0.5 },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  categoryList: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  list: { padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 15 },
});
