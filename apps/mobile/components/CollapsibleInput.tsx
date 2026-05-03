import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function CollapsibleInput({ label, value, onChangeText, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={styles.icon}>📝</Text>
        <Text style={styles.label}>{label}</Text>
        {value.length > 0 && <View style={styles.dot} />}
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? 'Tulis permintaan khusus di sini...'}
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#FAFAFA', marginBottom: 10, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  icon:    { fontSize: 16 },
  label:   { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1D63ED' },
  chevron: { fontSize: 10, color: '#9CA3AF' },
  input: {
    marginHorizontal: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 12, minHeight: 80, fontSize: 13, color: '#111827',
    backgroundColor: '#FFFFFF',
  },
});
