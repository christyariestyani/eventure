import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../../hooks/useEvents';
import EventCard from '../../components/EventCard';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  const { events, isLoading } = useEvents({ q: debouncedQ || undefined });

  const handleChange = (text: string) => {
    setQuery(text);
    clearTimeout((handleChange as any)._t);
    (handleChange as any)._t = setTimeout(() => setDebouncedQ(text), 400);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Cari Event</Text>
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="Nama event, artis, kota..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={handleChange}
          autoFocus
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={events}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        )}
        ListEmptyComponent={
          !isLoading && debouncedQ ? (
            <Text style={styles.empty}>Tidak ada hasil untuk "{debouncedQ}"</Text>
          ) : !debouncedQ ? (
            <Text style={styles.empty}>Ketik untuk mencari event</Text>
          ) : null
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
  inputWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  list: { padding: 16 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 15 },
});
