import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents, useRecommendations } from '../../hooks/useEvents';
import { useAuthStore } from '../../store/useAuthStore';
import EventCard from '../../components/EventCard';

const P = '#5B8EF0';

const CATEGORIES = [
  { label: 'Semua',    value: undefined,  icon: '🌟', bg: '#FFF7ED', border: '#FED7AA' },
  { label: 'Musik',    value: 'music',    icon: '🎵', bg: '#EEF3FF', border: '#C7D7FD' },
  { label: 'Olahraga', value: 'sports',   icon: '⚽', bg: '#F0FDF4', border: '#BBF7D0' },
  { label: 'Festival', value: 'festival', icon: '🎪', bg: '#FDF4FF', border: '#E9D5FF' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [debouncedQ, setDebouncedQ] = useState('');

  const { events, isLoading, isRefetching, refetch: refetchEvents } = useEvents({
    q: debouncedQ || undefined,
    category: activeCategory,
  });

  const { data: recommended, refetch: refetchRec, isRefetching: isRefetchingRec } = useRecommendations();

  const handleRefresh = () => { refetchEvents(); refetchRec(); };

  const handleSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => setDebouncedQ(text), 400);
  };

  const showRecommended = !debouncedQ && !activeCategory && (recommended ?? []).length > 0;
  const firstName = user?.full_name?.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {firstName ? `Halo, ${firstName} 👋` : 'Selamat datang 👋'}
            </Text>
            <Text style={styles.logo}>eventure</Text>
          </View>
          <View style={styles.bell}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIco}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari event, artis, kota..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedQ(''); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORIES.map(c => {
          const active = activeCategory === c.value;
          return (
            <TouchableOpacity
              key={c.label}
              style={[styles.catItem, active && styles.catItemActive]}
              onPress={() => setActiveCategory(c.value)}
              activeOpacity={0.75}
            >
              <View style={[styles.catBubble, { backgroundColor: c.bg, borderColor: active ? P : c.border }]}>
                <Text style={styles.catEmoji}>{c.icon}</Text>
              </View>
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Event list */}
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isRefetching || isRefetchingRec}
            onRefresh={handleRefresh}
            tintColor={P}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          showRecommended ? (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Untukmu</Text>
                <Text style={styles.sectionLink}>Lihat semua ›</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingRight: 4, paddingBottom: 4 }}
              >
                {(recommended ?? []).slice(0, 5).map(item => (
                  <View key={`rec-${item.id}`} style={{ width: 265 }}>
                    <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
                  </View>
                ))}
              </ScrollView>
              <View style={[styles.sectionRow, { marginTop: 22 }]}>
                <Text style={styles.sectionTitle}>Event Mendatang</Text>
              </View>
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🔎</Text>
              <Text style={styles.emptyTitle}>Tidak ada event</Text>
              <Text style={styles.emptyText}>Coba ubah kata kunci atau kategori</Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF2F9',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  logo: { fontSize: 24, fontWeight: '800', color: P, letterSpacing: -0.5, marginTop: 2 },
  bell: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F4F6FB', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  searchIco: { fontSize: 15, color: '#94A3B8' },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', padding: 0 },
  clearBtn: { fontSize: 13, color: '#94A3B8', paddingHorizontal: 4 },

  catScroll: { backgroundColor: '#FFFFFF', maxHeight: 100 },
  catRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 18 },
  catItem: { alignItems: 'center', gap: 6 },
  catItemActive: {},
  catBubble: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  catEmoji: { fontSize: 24 },
  catLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  catLabelActive: { color: P, fontWeight: '700' },

  list: { padding: 16, paddingTop: 18 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  sectionLink: { fontSize: 13, color: P, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 64 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptyText: { fontSize: 13, color: '#94A3B8', marginTop: 6 },
});
