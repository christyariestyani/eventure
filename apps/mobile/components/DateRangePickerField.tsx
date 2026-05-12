import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths, isBefore, isAfter, startOfDay, parseISO, isSameDay,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const BLUE       = '#1D63ED';
const BLUE_LIGHT = '#DBEAFE';
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface Props {
  startLabel: string;
  endLabel: string;
  startValue: string | null;
  endValue: string | null;
  onChangeStart: (iso: string) => void;
  onChangeEnd: (iso: string | null) => void;
  onReset?: () => void;
  minDate?: Date;
  startMaxDate?: Date;
  startPlaceholder?: string;
  endPlaceholder?: string;
  endOptional?: boolean;
}

export default function DateRangePickerField({
  startLabel, endLabel,
  startValue, endValue,
  onChangeStart, onChangeEnd, onReset,
  minDate, startMaxDate, startPlaceholder, endPlaceholder, endOptional,
}: Props) {
  const [open, setOpen]           = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd,   setTempEnd]   = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));

  const startDate = tempStart ? parseISO(tempStart) : null;
  const endDate   = tempEnd   ? parseISO(tempEnd)   : null;
  const today     = startOfDay(new Date());

  function openModal() {
    setTempStart(startValue);
    setTempEnd(endValue);
    setSelecting(startValue ? 'end' : 'start');
    setViewMonth(startValue ? startOfMonth(parseISO(startValue)) : startOfMonth(new Date()));
    setOpen(true);
  }

  function handleDone() {
    if (tempStart) {
      onChangeStart(tempStart);
      if (!tempEnd) onChangeEnd(null);
    }
    if (tempEnd) onChangeEnd(tempEnd);
    setOpen(false);
  }

  function isDisabledDay(d: Date): boolean {
    if (minDate && isBefore(d, startOfDay(minDate))) return true;
    if (selecting === 'start' && startMaxDate && isAfter(d, startOfDay(startMaxDate))) return true;
    if (selecting === 'end' && startDate && isBefore(d, startDate)) return true;
    return false;
  }

  function handleTap(dayNum: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum);
    if (isDisabledDay(d)) return;
    const iso = format(d, 'yyyy-MM-dd');

    if (selecting === 'start') {
      // Deselect if tapping the already-selected start
      if (tempStart && isSameDay(d, parseISO(tempStart))) {
        setTempStart(null);
        setTempEnd(null);
        return;
      }
      setTempStart(iso);
      setTempEnd(null);
      setSelecting('end');
    } else {
      // Deselect if tapping the already-selected end
      if (tempEnd && isSameDay(d, parseISO(tempEnd))) {
        setTempEnd(null);
        return;
      }
      // Tapped before start → set as new start
      if (startDate && isBefore(d, startDate)) {
        setTempStart(iso);
        setTempEnd(null);
        return;
      }
      setTempEnd(iso);
      onChangeStart(tempStart ?? iso);
      onChangeEnd(iso);
      setOpen(false);
      setSelecting('start');
    }
  }

  function isInRange(d: Date): boolean {
    if (!startDate || !endDate) return false;
    return !isSameDay(d, startDate) && !isSameDay(d, endDate) &&
      !isBefore(d, startDate) && !isBefore(endDate, d);
  }

  const daysInMonth = getDaysInMonth(viewMonth);
  const firstDow    = getDay(startOfMonth(viewMonth));
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const disp = (iso: string | null) =>
    iso ? format(parseISO(iso), 'd MMM yyyy', { locale: idLocale }) : null;

  const hasAnyDate = !!(startValue || endValue);

  return (
    <>
      <View style={styles.triggerRow}>
        <TouchableOpacity style={styles.trigger} onPress={openModal} activeOpacity={0.8}>
          <View style={styles.triggerHalf}>
            <Text style={styles.triggerSub}>{startLabel}</Text>
            <Text style={[styles.triggerVal, !startValue && styles.triggerPH]}>
              {disp(startValue) ?? (startPlaceholder ?? 'Pilih tanggal')}
            </Text>
          </View>
          <Text style={styles.triggerArrow}>→</Text>
          <View style={styles.triggerHalf}>
            <Text style={styles.triggerSub}>{endLabel}</Text>
            <Text style={[styles.triggerVal, !endValue && styles.triggerPH]}>
              {disp(endValue) ?? (endPlaceholder ?? (endOptional ? 'Opsional' : 'Pilih tanggal'))}
            </Text>
          </View>
          <Text style={styles.triggerIcon}>📅</Text>
        </TouchableOpacity>
        {hasAnyDate && onReset && (
          <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.7}>
            <Text style={styles.resetText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={handleDone}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleDone}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            {/* Header row: tabs + reset */}
            <View style={styles.modalHeader}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, selecting === 'start' && styles.tabActive]}
                  onPress={() => { setSelecting('start'); setTempEnd(null); }}
                >
                  <Text style={styles.tabLabel}>{startLabel}</Text>
                  <Text style={[styles.tabVal, selecting === 'start' && styles.tabValActive]}>
                    {disp(tempStart) ?? '—'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.tabSep} />
                <TouchableOpacity
                  style={[styles.tab, selecting === 'end' && styles.tabActive]}
                  onPress={() => { if (tempStart) setSelecting('end'); }}
              >
                <Text style={styles.tabLabel}>{endLabel}</Text>
                <Text style={[styles.tabVal, selecting === 'end' && styles.tabValActive]}>
                  {disp(tempEnd) ?? (endOptional ? 'Opsional' : '—')}
                </Text>
              </TouchableOpacity>
              </View>
              {(tempStart || tempEnd) && (
                <TouchableOpacity
                  style={styles.modalResetBtn}
                  onPress={() => { setTempStart(null); setTempEnd(null); setSelecting('start'); }}
                >
                  <Text style={styles.modalResetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.hint}>
              {selecting === 'start'
                ? `Pilih tanggal ${startLabel.toLowerCase()}`
                : `Pilih tanggal ${endLabel.toLowerCase()}`}
            </Text>

            {/* Month nav */}
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
              {DAYS.map(d => <Text key={d} style={styles.dayHeader}>{d}</Text>)}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.cell} />;

                const date     = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                const disabled = isDisabledDay(date);
                const isStart  = !!startDate && isSameDay(date, startDate);
                const isEnd    = !!endDate   && isSameDay(date, endDate);
                const inRange  = isInRange(date);
                const selected = isStart || isEnd;
                const isToday  = isSameDay(date, today);

                // Ribbon extends right from start, left from end, full for in-between
                const showRibbon = inRange || (isStart && !!endDate) || (isEnd && !!startDate);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.cell}
                    onPress={() => handleTap(day)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    {showRibbon && (
                      <View style={[
                        styles.ribbon,
                        inRange              && styles.ribbonFull,
                        isStart && !!endDate && styles.ribbonRight,
                        isEnd && !!startDate && styles.ribbonLeft,
                      ]} />
                    )}
                    <View style={[
                      styles.circle,
                      selected && styles.circleSelected,
                      isToday && !selected && styles.circleToday,
                    ]}>
                      <Text style={[
                        styles.dayText,
                        disabled && styles.dayTextDisabled,
                        selected && styles.dayTextSelected,
                        inRange  && styles.dayTextInRange,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnText}>Selesai</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  resetBtn:    {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  resetText:   { fontSize: 14, color: '#EF4444', fontWeight: '700' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, gap: 8 },
  modalResetBtn:  { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  modalResetText: { fontSize: 12, color: '#6B7280', fontWeight: '700' },

  trigger: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFD', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  triggerHalf:  { flex: 1 },
  triggerSub:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  triggerVal:   { fontSize: 14, fontWeight: '700', color: '#111827' },
  triggerPH:    { color: '#9CA3AF', fontWeight: '400', fontSize: 13 },
  triggerArrow: { fontSize: 16, color: '#CBD5E1', marginHorizontal: 8 },
  triggerIcon:  { fontSize: 18, marginLeft: 6 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },

  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4,
  },
  tab:          { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  tabActive:    { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabSep:       { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  tabLabel:     { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  tabVal:       { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  tabValActive: { color: BLUE },

  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 },

  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  navBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navArrow:   { fontSize: 26, color: BLUE, fontWeight: '300' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },

  dayHeaders: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  dayHeader:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 16 },

  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ribbon:      { position: 'absolute', top: '10%', bottom: '10%', backgroundColor: BLUE_LIGHT },
  ribbonFull:  { left: 0, right: 0 },
  ribbonRight: { left: '50%', right: 0 },
  ribbonLeft:  { left: 0, right: '50%' },

  circle:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  circleSelected: { backgroundColor: BLUE },
  circleToday:    { borderWidth: 1.5, borderColor: BLUE },

  dayText:         { fontSize: 14, color: '#111827', fontWeight: '500' },
  dayTextDisabled: { color: '#D1D5DB' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  dayTextInRange:  { color: BLUE, fontWeight: '600' },

  doneBtn:     { marginHorizontal: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
