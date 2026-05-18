import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { useCompleteOnboarding, useUpdatePreferences, UserPreferences } from '../hooks/usePreferences';

const P = '#5B8EF0';

// ─── Step config ───────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'music',    label: 'Musik',    icon: '🎵' },
  { value: 'sports',   label: 'Olahraga', icon: '⚽' },
  { value: 'festival', label: 'Festival', icon: '🎪' },
];

const SUBCATEGORIES: Record<string, Array<{ value: string; label: string }>> = {
  music:    [
    { value: 'pop',         label: 'Pop' },
    { value: 'edm',         label: 'EDM' },
    { value: 'indie',       label: 'Indie' },
    { value: 'jazz',        label: 'Jazz' },
    { value: 'rock',        label: 'Rock' },
    { value: 'kpop',        label: 'K-Pop' },
  ],
  sports:   [
    { value: 'marathon',    label: 'Marathon' },
    { value: 'football',    label: 'Sepak Bola' },
    { value: 'basketball',  label: 'Basket' },
    { value: 'badminton',   label: 'Badminton' },
    { value: 'cycling',     label: 'Bersepeda' },
  ],
  festival: [
    { value: 'food',        label: 'Kuliner' },
    { value: 'art',         label: 'Seni' },
    { value: 'culture',     label: 'Budaya' },
    { value: 'film',        label: 'Film' },
  ],
};

const TRAVEL_STYLES = [
  { value: 'solo',   label: 'Solo',   icon: '🧍', desc: 'Perjalanan sendiri' },
  { value: 'couple', label: 'Couple', icon: '👫', desc: 'Berdua pasangan' },
  { value: 'group',  label: 'Group',  icon: '👥', desc: 'Rombongan teman' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧', desc: 'Bersama keluarga' },
];

const BUDGET_TIERS = [
  { value: 'budget',  label: 'Budget',  icon: '💸', range: '< Rp300rb / tiket' },
  { value: 'mid',     label: 'Mid',     icon: '💳', range: 'Rp300rb – 800rb' },
  { value: 'premium', label: 'Premium', icon: '💎', range: 'Rp800rb – 2jt' },
  { value: 'luxury',  label: 'Luxury',  icon: '👑', range: '> Rp2jt' },
];

const TOTAL_STEPS = 5;

interface Props {
  onDone: () => void;
  onSkip?: () => void;
  initialValues?: Partial<UserPreferences>;
  mode?: 'onboarding' | 'edit';
}

export default function OnboardingQuiz({ onDone, onSkip, initialValues, mode = 'onboarding' }: Props) {
  const complete = useCompleteOnboarding();
  const update   = useUpdatePreferences();

  const [step, setStep]               = useState(0);
  const [eventTypes, setEventTypes]   = useState<string[]>(initialValues?.event_types ?? []);
  const [subcats, setSubcats]         = useState<string[]>(initialValues?.subcategories ?? []);
  const [travelStyle, setTravelStyle] = useState<string>(initialValues?.travel_style ?? 'solo');
  const [budgetTier, setBudgetTier]   = useState<string>(initialValues?.budget_tier ?? 'mid');
  const [homeCity, setHomeCity]       = useState(initialValues?.home_city ?? '');

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const canNext = () => {
    if (step === 0) return eventTypes.length > 0;
    return true;
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    const prefs = {
      event_types:        eventTypes,
      subcategories:      subcats,
      favorite_artists:   initialValues?.favorite_artists ?? [],
      travel_style:       travelStyle as UserPreferences['travel_style'],
      budget_tier:        budgetTier as UserPreferences['budget_tier'],
      budget_min:         0,
      budget_max:         budgetTier === 'budget' ? 300_000 : budgetTier === 'mid' ? 800_000 : budgetTier === 'premium' ? 2_000_000 : 99_999_999,
      accommodation_pref: initialValues?.accommodation_pref ?? [],
      home_city:          homeCity.trim() || null,
      preferred_cities:   homeCity.trim() ? [homeCity.trim()] : [],
    };
    if (mode === 'edit') {
      await update.mutateAsync(prefs);
    } else {
      await complete.mutateAsync(prefs);
    }
    onDone();
  };

  const isPending = complete.isPending || update.isPending;

  // Available subcategories based on chosen event types
  const availableSubcats = eventTypes.flatMap(t => SUBCATEGORIES[t] ?? []);

  const handleSkip = () => {
    if (onSkip) onSkip();
    else onDone();
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar + skip */}
      <View style={styles.progressHeader}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipBtnText}>Lewati</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <StepContainer
            icon="🎯"
            title="Apa yang kamu suka?"
            sub="Pilih minimal satu jenis event"
          >
            <View style={styles.chipGrid}>
              {EVENT_TYPES.map(t => (
                <Chip
                  key={t.value}
                  icon={t.icon}
                  label={t.label}
                  selected={eventTypes.includes(t.value)}
                  onPress={() => setEventTypes(prev => toggleArr(prev, t.value))}
                  large
                />
              ))}
            </View>
          </StepContainer>
        )}

        {step === 1 && (
          <StepContainer
            icon="🎼"
            title="Genre / cabang favoritmu?"
            sub="Pilih sebanyak yang kamu mau"
          >
            {availableSubcats.length === 0 ? (
              <Text style={styles.emptyHint}>Pilih jenis event dulu di langkah sebelumnya</Text>
            ) : (
              <View style={styles.chipGrid}>
                {availableSubcats.map(s => (
                  <Chip
                    key={s.value}
                    label={s.label}
                    selected={subcats.includes(s.value)}
                    onPress={() => setSubcats(prev => toggleArr(prev, s.value))}
                  />
                ))}
              </View>
            )}
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer
            icon="✈️"
            title="Gaya perjalananmu?"
            sub="Pilih satu yang paling cocok"
          >
            <View style={styles.cardGrid}>
              {TRAVEL_STYLES.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.styleCard, travelStyle === s.value && styles.styleCardActive]}
                  onPress={() => setTravelStyle(s.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.styleIcon}>{s.icon}</Text>
                  <Text style={[styles.styleLabel, travelStyle === s.value && styles.styleActive]}>{s.label}</Text>
                  <Text style={styles.styleDesc}>{s.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer
            icon="💰"
            title="Budget per tiket?"
            sub="Ini membantu kami merekomendasikan event yang sesuai"
          >
            <View style={styles.budgetList}>
              {BUDGET_TIERS.map(b => (
                <TouchableOpacity
                  key={b.value}
                  style={[styles.budgetRow, budgetTier === b.value && styles.budgetRowActive]}
                  onPress={() => setBudgetTier(b.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.budgetIcon}>{b.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.budgetLabel, budgetTier === b.value && styles.activeText]}>{b.label}</Text>
                    <Text style={styles.budgetRange}>{b.range}</Text>
                  </View>
                  <View style={[styles.radio, budgetTier === b.value && styles.radioActive]}>
                    {budgetTier === b.value && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer
            icon="📍"
            title="Kamu tinggal di mana?"
            sub="Kami akan tampilkan event terdekat lebih dulu"
          >
            <TextInput
              style={styles.cityInput}
              placeholder="Contoh: Jakarta, Bandung, Surabaya..."
              placeholderTextColor="#94A3B8"
              value={homeCity}
              onChangeText={setHomeCity}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={next}
            />
            <Text style={styles.cityHint}>Tidak wajib diisi — bisa diubah kapanpun</Text>
          </StepContainer>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.nav}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtnText}>← Kembali</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          onPress={next}
          disabled={!canNext() || isPending}
          activeOpacity={0.85}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS - 1
                ? (mode === 'edit' ? 'Simpan Perubahan ✓' : 'Mulai Jelajahi 🚀')
                : 'Lanjut →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StepContainer({
  icon, title, sub, children,
}: {
  icon: string; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepIcon}>{icon}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSub}>{sub}</Text>
      <View style={{ marginTop: 28 }}>{children}</View>
    </View>
  );
}

function Chip({
  icon, label, selected, onPress, large,
}: {
  icon?: string; label: string; selected: boolean; onPress: () => void; large?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive, large && styles.chipLarge]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && <Text style={styles.chipIcon}>{icon}</Text>}
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },

  progressHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressWrap: { flex: 1, height: 4, backgroundColor: '#EEF3FF', borderRadius: 2 },
  progressBar:  { height: 4, backgroundColor: P, borderRadius: 2, minWidth: 8 },
  skipBtn:      { paddingVertical: 6, paddingHorizontal: 4 },
  skipBtnText:  { fontSize: 14, color: '#94A3B8', fontWeight: '600' },

  content: { padding: 24, paddingBottom: 12 },
  stepWrap: { alignItems: 'center' },
  stepIcon:  { fontSize: 56, marginBottom: 16 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  stepSub:   { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },

  // Chip grid
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingVertical: 9, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipActive:       { backgroundColor: '#EEF3FF', borderColor: P },
  chipLarge:        { paddingVertical: 14, paddingHorizontal: 22 },
  chipIcon:         { fontSize: 18 },
  chipLabel:        { fontSize: 14, color: '#64748B', fontWeight: '600' },
  chipLabelActive:  { color: P },

  // Travel style cards
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
  styleCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  styleCardActive: { borderColor: P, backgroundColor: '#EEF3FF' },
  styleIcon:  { fontSize: 30, marginBottom: 4 },
  styleLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  styleActive: { color: P },
  styleDesc:  { fontSize: 11, color: '#94A3B8', textAlign: 'center' },

  // Budget list
  budgetList: { gap: 10, width: '100%' },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  budgetRowActive: { borderColor: P, backgroundColor: '#EEF3FF' },
  budgetIcon:  { fontSize: 26 },
  budgetLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  budgetRange: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  activeText:  { color: P },
  radio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: P },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: P },

  // City input
  cityInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1E293B', borderWidth: 1.5, borderColor: '#E2E8F0', width: '100%',
  },
  cityHint: { fontSize: 12, color: '#94A3B8', marginTop: 10, textAlign: 'center' },

  // Nav
  nav: {
    flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, gap: 12,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFF2F9',
  },
  backBtn: {
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  nextBtn: {
    flex: 1, backgroundColor: P, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#C7D7FD' },
  nextBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
});
