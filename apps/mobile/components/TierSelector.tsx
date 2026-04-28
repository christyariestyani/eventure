import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Tier {
  id: string;
  name: string;
  price: number;
  available_quota: number;
  max_per_user: number;
  status: string;
  benefits?: string[];
}

interface Props {
  tiers: Tier[];
  onSelect: (tierId: string, quantity: number) => void;
  soldOut?: boolean;
}

export default function TierSelector({ tiers, onSelect, soldOut = false }: Props) {
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Pilih Tiket</Text>

      {soldOut && (
        <View style={styles.soldOutBanner}>
          <Text style={styles.soldOutIcon}>🎟️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.soldOutTitle}>Tiket Sudah Habis</Text>
            <Text style={styles.soldOutDesc}>Semua tiket untuk event ini sudah terjual</Text>
          </View>
        </View>
      )}

      {tiers.map(tier => {
        const isAvailable = !soldOut && tier.status === 'available' && tier.available_quota > 0;
        const isSelected = tier.id === selectedTierId;

        return (
          <TouchableOpacity
            key={tier.id}
            style={[
              styles.tierCard,
              isSelected && styles.tierCardSelected,
              !isAvailable && styles.tierCardDisabled,
            ]}
            onPress={() => isAvailable && setSelectedTierId(tier.id)}
            disabled={!isAvailable}
            activeOpacity={0.8}
          >
            <View style={styles.tierHeader}>
              <Text style={[styles.tierName, !isAvailable && styles.textMuted]}>
                {tier.name}
              </Text>
              <Text style={[styles.tierPrice, !isAvailable && styles.textMuted]}>
                {formatPrice(tier.price)}
              </Text>
            </View>

            {tier.benefits && tier.benefits.length > 0 && (
              <View style={styles.benefits}>
                {tier.benefits.slice(0, 3).map((b, i) => (
                  <Text key={i} style={styles.benefit}>• {b}</Text>
                ))}
              </View>
            )}

            <Text style={styles.quota}>
              {isAvailable
                ? `Tersisa ${tier.available_quota} tiket`
                : 'Habis'}
            </Text>
          </TouchableOpacity>
        );
      })}

      {!soldOut && selectedTier && (
        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Jumlah Tiket</Text>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityBtn}
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <Text style={styles.quantityBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityBtn}
              onPress={() =>
                setQuantity(q =>
                  Math.min(
                    q + 1,
                    selectedTier.max_per_user,
                    selectedTier.available_quota
                  )
                )
              }
            >
              <Text style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!soldOut && (
        <TouchableOpacity
          style={[styles.ctaButton, !selectedTierId && styles.ctaButtonDisabled]}
          onPress={() => selectedTierId && onSelect(selectedTierId, quantity)}
          disabled={!selectedTierId}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {selectedTier
              ? `Pesan — ${formatPrice(selectedTier.price * quantity)}`
              : 'Pilih Tiket'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  tierCard: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  tierCardSelected: { borderColor: '#6366F1', backgroundColor: '#F5F3FF' },
  tierCardDisabled: { opacity: 0.4 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tierPrice: { fontSize: 15, fontWeight: '700', color: '#6366F1' },
  textMuted: { color: '#9CA3AF' },
  benefits: { gap: 2 },
  benefit: { fontSize: 12, color: '#6B7280' },
  quota: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quantityLabel: { fontSize: 15, color: '#374151', fontWeight: '600' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: { fontSize: 18, color: '#6366F1', fontWeight: '700' },
  quantityValue: { fontSize: 18, fontWeight: '700', color: '#111827', minWidth: 24, textAlign: 'center' },
  ctaButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaButtonDisabled: { backgroundColor: '#C7D2FE' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  soldOutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
  },
  soldOutIcon: { fontSize: 24 },
  soldOutTitle: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  soldOutDesc: { fontSize: 12, color: '#EF4444', marginTop: 2 },
});
