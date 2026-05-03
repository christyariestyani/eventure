import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths, isBefore, startOfDay, parseISO,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const BLUE = '#1D63ED';
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface Props {
  label: string;
  value: string | null;        // ISO date string 'YYYY-MM-DD' or null
  onChange: (iso: string) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
}

export default function DatePickerField({ label, value, onChange, minDate, maxDate, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(
    value ? startOfMonth(parseISO(value)) : startOfMonth(new Date())
  );

  const selected = value ? parseISO(value) : null;
  const today = startOfDay(new Date());

  function isDisabled(day: Date): boolean {
    if (minDate && isBefore(day, startOfDay(minDate))) return true;
    if (maxDate && isBefore(startOfDay(maxDate), day)) return true;
    return false;
  }

  function handleSelect(day: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    if (isDisabled(d)) return;
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  }

  const daysInMonth = getDaysInMonth(viewMonth);
  const firstDow = getDay(startOfMonth(viewMonth)); // 0=Sun

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const displayValue = selected
    ? format(selected, 'd MMM yyyy', { locale: idLocale })
    : null;

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !displayValue && styles.fieldPlaceholder]}>
          {displayValue ?? (placeholder ?? 'Pilih tanggal')}
        </Text>
        <Text style={styles.fieldIcon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setViewMonth(subMonths(viewMonth, 1))} style={styles.navBtn}>
                <Text style={styles.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {format(viewMonth, 'MMMM yyyy', { locale: idLocale })}
              </Text>
              <TouchableOpacity onPress={() => setViewMonth(addMonths(viewMonth, 1))} style={styles.navBtn}>
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
              {DAYS.map(d => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.cell} />;
                const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                const disabled = isDisabled(date);
                const isSelected = selected &&
                  selected.getFullYear() === date.getFullYear() &&
                  selected.getMonth() === date.getMonth() &&
                  selected.getDate() === date.getDate();
                const isToday = !isBefore(date, today) && !isBefore(today, date);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                    onPress={() => handleSelect(day)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.cellText,
                      disabled && styles.cellTextDisabled,
                      isSelected && styles.cellTextSelected,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFD', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  fieldLabel:       { fontSize: 12, color: '#6B7280', width: 80 },
  fieldValue:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  fieldPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  fieldIcon:        { fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  navBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 26, color: BLUE, fontWeight: '300' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },

  dayHeaders: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  dayHeader:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 16 },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: BLUE, borderRadius: 20 },
  cellToday:    { borderWidth: 1, borderColor: BLUE, borderRadius: 20 },
  cellText:         { fontSize: 14, color: '#111827', fontWeight: '500' },
  cellTextDisabled: { color: '#D1D5DB' },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  cancelBtn: { marginHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
