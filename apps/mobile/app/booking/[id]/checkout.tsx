import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  differenceInDays, parseISO, addDays, isAfter, isSameDay, format,
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInitiatePayment } from '../../../hooks/useBooking';
import { api } from '../../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAccommodations, useRoomTypes, RoomType } from '../../../hooks/useAccommodations';
import { usePreferences } from '../../../hooks/usePreferences';
import RoomTypeSheet from '../../../components/RoomTypeSheet';
import {
  getTransportOptions, formatDuration, MODE_LABEL,
  groupByOperator, optionServiceLabel, isOvernightTrip,
  type TransportOption, type OperatorGroup,
} from '../../../data/transportOptions';
import DateRangePickerField from '../../../components/DateRangePickerField';
import CollapsibleInput from '../../../components/CollapsibleInput';

const BLUE = '#1D63ED';
const P    = '#5B8EF0';
const GREEN = '#22C55E';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

function fmtDist(km: number | null) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function inDistance(km: number | null, f: DistanceFilter) {
  if (f === 'all' || km == null) return true;
  return km < parseFloat(f);
}

function inPrice(price: number, r: PriceRange) {
  if (r === 'all') return true;
  const k = price / 1000;
  if (r === '<500') return k < 500;
  if (r === '500-1000') return k >= 500 && k < 1000;
  if (r === '1000-2000') return k >= 1000 && k < 2000;
  return k >= 2000;
}

// Hotel facilities derived from star rating (mock enrichment)
function hotelFacilities(stars: number): string[] {
  const base = ['WiFi', 'AC', 'TV'];
  if (stars >= 3) base.push('Sarapan', 'Parkir');
  if (stars >= 4) base.push('Kolam Renang', 'Gym', 'Room Service');
  if (stars >= 5) base.push('Spa', 'Concierge', 'Butler Service');
  return base;
}

// ─── Types ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { label: 'Terdekat dari Venue', value: 'distance' },
  { label: 'Harga Terendah',      value: 'price_asc' },
  { label: 'Harga Tertinggi',     value: 'price_desc' },
  { label: 'Bintang Tertinggi',   value: 'stars' },
] as const;

const PRICE_RANGES = [
  { label: 'Semua',        value: 'all' },
  { label: '< Rp500K',     value: '<500' },
  { label: 'Rp500K – 1Jt', value: '500-1000' },
  { label: 'Rp1Jt – 2Jt',  value: '1000-2000' },
  { label: '> Rp2Jt',      value: '>2000' },
] as const;

const DISTANCE_FILTERS = [
  { label: 'Semua', value: 'all' },
  { label: '< 1 km', value: '1' },
  { label: '< 3 km', value: '3' },
  { label: '< 5 km', value: '5' },
  { label: '< 10 km', value: '10' },
  { label: '< 20 km', value: '20' },
] as const;

const TRANSPORT_MODES = [
  { label: 'Semua', value: 'all' },
  { label: '🚌 Bus', value: 'bus' },
  { label: '🚂 Kereta', value: 'train' },
  { label: '✈️ Pesawat', value: 'plane' },
  { label: '🚐 Travel', value: 'shuttle' },
] as const;

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS',               icon: '📱', desc: 'GoPay, OVO, Dana, ShopeePay, dll' },
  { id: 'va',   label: 'Transfer Bank',       icon: '🏦', desc: 'BCA, Mandiri, BNI, BRI, Permata' },
  { id: 'card', label: 'Kartu Debit / Kredit',icon: '💳', desc: 'Visa, Mastercard, JCB' },
];

const EARLY_CHECKIN_TIMES  = ['10:00', '11:00', '12:00', '13:00'];
const LATE_CHECKOUT_TIMES  = ['13:00', '14:00', '15:00', '16:00'];

const SEAT_POSITIONS = [
  { value: 'front',  label: '⬆ Depan'    },
  { value: 'middle', label: '↔ Tengah'   },
  { value: 'back',   label: '⬇ Belakang' },
] as const;

const SEAT_SIDES = [
  { value: 'window-left',  label: '🪟 Kiri'    },
  { value: 'aisle',        label: '🚶 Lorong'  },
  { value: 'window-right', label: '🪟 Kanan'   },
] as const;

type SeatPos  = typeof SEAT_POSITIONS[number]['value'];
type SeatSide = typeof SEAT_SIDES[number]['value'];

type SortOption      = typeof SORT_OPTIONS[number]['value'];
type PriceRange      = typeof PRICE_RANGES[number]['value'];
type DistanceFilter  = typeof DISTANCE_FILTERS[number]['value'];
type TransportFilter = typeof TRANSPORT_MODES[number]['value'];

interface Attendee {
  name:      string;
  id_type:   'ktp' | 'paspor';
  id_number: string;
}

const ID_TYPES = [
  { value: 'ktp'   as const, label: 'KTP'    },
  { value: 'paspor'as const, label: 'Paspor' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const {
    id, city, baseAmount, eventTitle, tierName, qty, venueLat, venueLng,
    preselectedHotelId, preselectedTransportPrice,
    eventStartAt, eventEndAt, venueName, venueAddress,
  } = useLocalSearchParams<{
    id: string; city?: string; baseAmount?: string; eventTitle?: string;
    tierName?: string; qty?: string; venueLat?: string; venueLng?: string;
    preselectedHotelId?: string; preselectedTransportPrice?: string;
    eventStartAt?: string; eventEndAt?: string;
    venueName?: string; venueAddress?: string;
  }>();

  const itineraryTransportPrice = preselectedTransportPrice
    ? parseInt(preselectedTransportPrice, 10) : 0;

  const router        = useRouter();
  const initiatePayment = useInitiatePayment();
  const queryClient   = useQueryClient();
  const { data: prefs } = usePreferences(true);
  const homeCity = prefs?.home_city ?? '';

  const parsedLat = venueLat ? parseFloat(venueLat) : undefined;
  const parsedLng = venueLng ? parseFloat(venueLng) : undefined;
  const { data: hotels } = useAccommodations(city, parsedLat, parsedLng);

  const eventCity   = city ?? '';
  const allTransport = useMemo(
    () => getTransportOptions(homeCity, eventCity),
    [homeCity, eventCity],
  );

  // ── Selection state ────────────────────────────────────────────────────────
  const preselectedHotelNum = preselectedHotelId ? parseInt(preselectedHotelId, 10) : null;
  const [selectedHotel,        setSelectedHotel]        = useState<number | null>(preselectedHotelNum || null);
  const [selectedRoomType,     setSelectedRoomType]     = useState<RoomType | null>(null);
  const [roomSheetHotelId,     setRoomSheetHotelId]     = useState<number | null>(null);

  const { data: roomTypes, isLoading: roomTypesLoading } = useRoomTypes(roomSheetHotelId);

  const [outboundTransportId,  setOutboundTransportId]  = useState<string | null>(null);
  const [returnTransportId,    setReturnTransportId]    = useState<string | null>(null);
  const [expandedOutboundOp,   setExpandedOutboundOp]   = useState<string | null>(null);
  const [expandedReturnOp,     setExpandedReturnOp]     = useState<string | null>(null);
  const [selectedPayment,      setSelectedPayment]      = useState<string | null>(null);
  const [loading,              setLoading]              = useState(false);

  // ── Date state ─────────────────────────────────────────────────────────────
  const [departDate,   setDepartDate]   = useState<string | null>(null);
  const [returnDate,   setReturnDate]   = useState<string | null>(null);
  const [checkInDate,  setCheckInDate]  = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);

  // ── Seat preference ────────────────────────────────────────────────────────
  const [outboundSeatPos,  setOutboundSeatPos]  = useState<SeatPos>('middle');
  const [outboundSeatSide, setOutboundSeatSide] = useState<SeatSide>('window-left');
  const [returnSeatPos,    setReturnSeatPos]    = useState<SeatPos>('middle');
  const [returnSeatSide,   setReturnSeatSide]   = useState<SeatSide>('window-left');

  // ── Hotel addons ───────────────────────────────────────────────────────────
  const [earlyCheckIn,     setEarlyCheckIn]     = useState(false);
  const [earlyCheckInTime, setEarlyCheckInTime] = useState('11:00');
  const [lateCheckOut,     setLateCheckOut]     = useState(false);
  const [lateCheckOutTime, setLateCheckOutTime] = useState('14:00');

  // ── Data pemesan & peserta ────────────────────────────────────────────────
  const [contactName,  setContactName]  = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [attendees,    setAttendees]    = useState<Attendee[]>(() =>
    Array.from({ length: Math.max(1, parseInt(qty ?? '1', 10)) }, () =>
      ({ name: '', id_type: 'ktp', id_number: '' })
    )
  );

  const updateAttendee = (idx: number, field: keyof Attendee, value: string) =>
    setAttendees(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));

  // ── Special requests ───────────────────────────────────────────────────────
  const [outboundNote, setOutboundNote] = useState('');
  const [returnNote,   setReturnNote]   = useState('');
  const [hotelNote,    setHotelNote]    = useState('');

  // ── Hotel filter/sort state ────────────────────────────────────────────────
  const [sortBy,      setSortBy]      = useState<SortOption>('distance');
  const [filterStars, setFilterStars] = useState<number[]>([]);
  const [filterPrice, setFilterPrice] = useState<PriceRange>('all');
  const [filterDist,  setFilterDist]  = useState<DistanceFilter>('all');
  const [pendingSort,  setPendingSort]  = useState<SortOption>('distance');
  const [pendingStars, setPendingStars] = useState<number[]>([]);
  const [pendingPrice, setPendingPrice] = useState<PriceRange>('all');
  const [pendingDist,  setPendingDist]  = useState<DistanceFilter>('all');
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [activeTab,      setActiveTab]      = useState<'sort' | 'filter'>('sort');

  // ── Transport filter ───────────────────────────────────────────────────────
  const [filterModeOut, setFilterModeOut] = useState<TransportFilter>('all');
  const [filterModeRet, setFilterModeRet] = useState<TransportFilter>('all');

  // ─────────────────────────────────────────────────────────────────────────

  const activeFilterCount =
    (filterStars.length > 0 ? 1 : 0) +
    (filterPrice !== 'all' ? 1 : 0) +
    (filterDist !== 'all' ? 1 : 0);

  const displayedHotels = useMemo(() => {
    return (hotels ?? [])
      .filter(h => filterStars.length === 0 || filterStars.includes(h.star_rating))
      .filter(h => inPrice(h.base_price, filterPrice))
      .filter(h => inDistance(h.distance_km, filterDist))
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.base_price - b.base_price;
        if (sortBy === 'price_desc') return b.base_price - a.base_price;
        if (sortBy === 'stars') return b.star_rating - a.star_rating;
        return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      });
  }, [hotels, filterStars, filterPrice, filterDist, sortBy]);

  const allReturnTransport = useMemo(
    () => getTransportOptions(eventCity, homeCity),
    [eventCity, homeCity],
  );

  const outboundOpt = useMemo(
    () => allTransport.find(t => t.id === outboundTransportId) ?? null,
    [allTransport, outboundTransportId],
  );
  const returnOpt = useMemo(
    () => allReturnTransport.find(t => t.id === returnTransportId) ?? null,
    [allReturnTransport, returnTransportId],
  );

  const transportArrivalDate: Date = useMemo(() => {
    if (departDate && outboundOpt) {
      return isOvernightTrip(outboundOpt)
        ? addDays(parseISO(departDate), 1)
        : parseISO(departDate);
    }
    return departDate ? parseISO(departDate) : new Date();
  }, [departDate, outboundOpt]);

  const outboundGroups = useMemo(() => {
    const filtered = filterModeOut === 'all'
      ? allTransport : allTransport.filter(t => t.mode === filterModeOut);
    return groupByOperator(filtered);
  }, [allTransport, filterModeOut]);

  const returnGroups = useMemo(() => {
    const filtered = filterModeRet === 'all'
      ? allReturnTransport : allReturnTransport.filter(t => t.mode === filterModeRet);
    return groupByOperator(filtered);
  }, [allReturnTransport, filterModeRet]);

  // ── Dynamic itinerary ─────────────────────────────────────────────────────

  interface ItinItem { time?: string; icon: string; title: string; subtitle?: string; highlight?: boolean }
  interface ItinDay  { date: string; dateLabel: string; dayNum: number; dayTitle: string; items: ItinItem[] }

  const itineraryDays = useMemo((): ItinDay[] => {
    if (!departDate) return [];

    const transport = outboundOpt;
    const hotel = selectedHotel ? (hotels ?? []).find(h => h.id === selectedHotel) ?? null : null;

    const dStart  = parseISO(departDate);
    const dEnd    = returnDate   ? parseISO(returnDate)
      : checkOutDate ? parseISO(checkOutDate)
      : eventStartAt ? parseISO(eventStartAt.split('T')[0])
      : addDays(dStart, 2);

    // If transport arrives next day (e.g. overnight bus departs 19:00 arrives 04:30)
    const isOvernight = transport
      ? transport.arrivalTime.localeCompare(transport.departureTime) < 0 : false;
    const arrivalDay = isOvernight ? addDays(dStart, 1) : dStart;

    const eventDateStr = eventStartAt ? eventStartAt.split('T')[0] : null;

    const days: ItinDay[] = [];
    let current = dStart;
    let dayNum  = 0;

    while (!isAfter(current, dEnd)) {
      dayNum++;
      const items: ItinItem[] = [];

      const isDepart   = isSameDay(current, dStart);
      const isArrival  = isSameDay(current, arrivalDay);
      const isCheckIn  = checkInDate  ? isSameDay(current, parseISO(checkInDate))  : false;
      const isCheckOut = checkOutDate ? isSameDay(current, parseISO(checkOutDate)) : false;
      const isReturn   = returnDate   ? isSameDay(current, parseISO(returnDate))   : false;
      const isEvent    = eventDateStr ? isSameDay(current, parseISO(eventDateStr)) : false;
      const eventHour  = eventStartAt ? new Date(eventStartAt).getHours() : 9;
      const eventEndHour = eventEndAt ? new Date(eventEndAt).getHours() : eventHour + 3;

      let dayTitle = `Jelajahi ${eventCity}`;
      if (isDepart && !isArrival) dayTitle = `Hari Keberangkatan`;
      else if (isDepart && isArrival) dayTitle = `Berangkat & Tiba di ${eventCity}`;
      else if (isArrival && !isDepart) dayTitle = `Tiba di ${eventCity}`;
      if (isEvent) dayTitle = `Hari Event 🎟`;
      if (isReturn && !isDepart) dayTitle = `Hari Kepulangan`;

      // ── Depart ──
      if (isDepart) {
        if (transport) {
          items.push({ time: transport.departureTime, icon: transport.icon, title: `${transport.operator}`, subtitle: transport.originLabel });
          if (!isOvernight) {
            items.push({ time: transport.arrivalTime, icon: '📍', title: `Tiba di ${eventCity}`, subtitle: transport.destLabel });
          }
        } else {
          items.push({ icon: '🚌', title: `Berangkat dari ${homeCity || 'kota asal'}`, subtitle: `Menuju ${eventCity}` });
        }
      }

      // ── Arrival (overnight — next day) ──
      if (isArrival && !isDepart) {
        if (transport) {
          items.push({ time: transport.arrivalTime, icon: '📍', title: `Tiba di ${eventCity}`, subtitle: transport.destLabel });
        } else {
          items.push({ icon: '📍', title: `Tiba di ${eventCity}` });
        }
        if (hotel) {
          const via = transport?.mode === 'plane' ? 'Airport transfer' : 'Taksi / Ojek';
          items.push({ icon: '🚕', title: `${via} ke ${hotel.name}`, subtitle: `Dari ${transport?.destLabel ?? 'terminal'}` });
        }
      } else if (isArrival && isDepart && hotel) {
        const via = transport?.mode === 'plane' ? 'Airport transfer' : 'Taksi / Ojek';
        items.push({ icon: '🚕', title: `${via} ke ${hotel.name}`, subtitle: `Dari ${transport?.destLabel ?? 'terminal'}` });
      }

      // ── Check-in ──
      if (isCheckIn && hotel) {
        const ciTime = earlyCheckIn ? earlyCheckInTime : '14:00';
        items.push({ time: ciTime, icon: '🏨', title: `Check-in ${hotel.name}`, subtitle: `${'⭐'.repeat(hotel.star_rating)} · ${hotel.city}` });
      }

      // ── Event day ──
      if (isEvent) {
        const goHour  = Math.max(eventHour - 1, 5);
        const fmtH    = (h: number) => `${String(h).padStart(2, '0')}:00`;
        items.push({ time: fmtH(goHour), icon: '🚕', title: `Menuju ${venueName ?? 'Venue'}`, subtitle: hotel ? `Dari ${hotel.name}` : undefined });
        items.push({ time: fmtH(eventHour), icon: '🎟', title: eventTitle ?? 'Event Dimulai', subtitle: venueName ?? eventCity, highlight: true });
        items.push({ time: fmtH(Math.min(eventEndHour, 23)), icon: '✅', title: 'Acara selesai', subtitle: venueAddress ?? eventCity });
        if (hotel) {
          items.push({ icon: '🚕', title: `Kembali ke ${hotel.name}` });
        }
      }

      // ── Free day ──
      const hasActivities = items.length > 0;
      if (!isDepart && !isArrival && !isEvent && !isCheckOut && !isReturn && !hasActivities) {
        items.push({ icon: '🌇', title: `Jelajahi ${eventCity}`, subtitle: 'Waktu bebas & istirahat' });
      }

      // ── Check-out ──
      if (isCheckOut && hotel) {
        let coTime = lateCheckOut ? lateCheckOutTime : '12:00';
        if (!lateCheckOut && isReturn && returnOpt?.departureTime) {
          const [rh, rm] = returnOpt.departureTime.split(':').map(Number);
          const depMin = rh * 60 + (rm ?? 0) - 60;
          const coH = Math.max(Math.floor(depMin / 60), 6);
          const coM = Math.max(depMin % 60, 0);
          coTime = `${String(coH).padStart(2, '0')}:${String(coM).padStart(2, '0')}`;
        }
        items.push({ time: coTime, icon: '🧳', title: `Check-out ${hotel.name}`, subtitle: lateCheckOut ? `Late check-out ${lateCheckOutTime}` : `Batas ${coTime}` });
      }

      // ── Return journey ──
      if (isReturn) {
        if (returnOpt) {
          items.push({ time: returnOpt.departureTime, icon: returnOpt.icon, title: `Perjalanan pulang ke ${homeCity || 'kota asal'}`, subtitle: `${returnOpt.originLabel} → ${returnOpt.destLabel}` });
        } else {
          items.push({ icon: '🏠', title: `Perjalanan pulang ke ${homeCity || 'kota asal'}`, subtitle: `${eventCity} → ${homeCity}` });
        }
      }

      days.push({
        date:      format(current, 'yyyy-MM-dd'),
        dateLabel: format(current, 'EEE, d MMM', { locale: idLocale }),
        dayNum,
        dayTitle,
        items,
      });

      current = addDays(current, 1);
    }

    return days;
  }, [
    departDate, returnDate, checkInDate, checkOutDate,
    outboundOpt, returnOpt, selectedHotel, hotels,
    earlyCheckIn, earlyCheckInTime, lateCheckOut, lateCheckOutTime,
    eventTitle, eventCity, homeCity, eventStartAt, eventEndAt, venueName, venueAddress,
  ]);

  // ── Amount calculations ────────────────────────────────────────────────────

  const quantity        = parseInt(qty ?? '1', 10);
  const ticketAmount    = parseFloat(baseAmount ?? '0');
  const nights          = (checkInDate && checkOutDate)
    ? Math.max(1, differenceInDays(parseISO(checkOutDate), parseISO(checkInDate)))
    : 1;

  const hotelBase = selectedRoomType
    ? selectedRoomType.price_per_night
    : selectedHotel ? (hotels?.find(h => h.id === selectedHotel)?.base_price ?? 0) : 0;
  const hotelAmount = hotelBase * nights;
  const earlyFee    = selectedHotel && earlyCheckIn  ? 150000 : 0;
  const lateFee     = selectedHotel && lateCheckOut  ? 100000 : 0;

  const outboundAmount  = (outboundOpt?.price ?? 0) * quantity;
  const returnAmount    = (returnOpt?.price   ?? 0) * quantity;
  const transportAmount = outboundAmount + returnAmount;

  const platformFee = Math.round(ticketAmount * 0.03);
  const total = ticketAmount + hotelAmount + earlyFee + lateFee + transportAmount + platformFee;

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openHotelModal = (tab: 'sort' | 'filter') => {
    setPendingSort(sortBy);
    setPendingStars(filterStars);
    setPendingPrice(filterPrice);
    setPendingDist(filterDist);
    setActiveTab(tab);
    setShowHotelModal(true);
  };

  const applyHotelModal = () => {
    setSortBy(pendingSort);
    setFilterStars(pendingStars);
    setFilterPrice(pendingPrice);
    setFilterDist(pendingDist);
    setShowHotelModal(false);
  };

  const resetHotelModal = () => {
    setPendingSort('distance');
    setPendingStars([]);
    setPendingPrice('all');
    setPendingDist('all');
  };

  const togglePendingStar = (star: number) =>
    setPendingStars(prev => prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]);

  // ── Pay ────────────────────────────────────────────────────────────────────

  const handlePay = async () => {
    if (!contactName.trim()) {
      Alert.alert('Data Pemesan', 'Nama pemesan wajib diisi.');
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      Alert.alert('Data Pemesan', 'Email pemesan tidak valid.');
      return;
    }
    if (!contactPhone.trim()) {
      Alert.alert('Data Pemesan', 'Nomor HP pemesan wajib diisi.');
      return;
    }
    const emptyAttendee = attendees.findIndex(a => !a.name.trim() || !a.id_number.trim());
    if (emptyAttendee >= 0) {
      Alert.alert('Data Peserta', `Lengkapi nama dan nomor identitas peserta ${emptyAttendee + 1}.`);
      return;
    }
    if (!selectedPayment) {
      Alert.alert('Pilih Pembayaran', 'Silakan pilih metode pembayaran terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      // Selalu patch: simpan data pemesan, peserta, dan addons
      await api.patch(`/bookings/${id}/addons`, {
        contact: { name: contactName, email: contactEmail, phone: contactPhone },
        attendees,
        hotel_id:        selectedHotel ?? undefined,
        transport_price: transportAmount || undefined,
        hotel_meta: selectedHotel ? {
          check_in:            checkInDate,
          check_out:           checkOutDate,
          nights,
          early_check_in:      earlyCheckIn,
          early_check_in_time: earlyCheckIn ? earlyCheckInTime : null,
          late_check_out:      lateCheckOut,
          late_check_out_time: lateCheckOut ? lateCheckOutTime : null,
          extra_fees:          earlyFee + lateFee,
          note:                hotelNote || undefined,
          room_type_id:        selectedRoomType?.id,
          room_type_name:      selectedRoomType?.name,
          room_type_bed:       selectedRoomType?.bed_type,
        } : undefined,
        outbound_meta: outboundOpt ? {
          option_id:        outboundOpt.id,
          operator:         outboundOpt.operator,
          class:            outboundOpt.classBadge,
          mode:             outboundOpt.mode,
          icon:             outboundOpt.icon,
          depart_date:      departDate,
          departure_time:   outboundOpt.departureTime,
          arrival_time:     outboundOpt.arrivalTime,
          duration_minutes: outboundOpt.durationMinutes,
          origin_label:     outboundOpt.originLabel,
          dest_label:       outboundOpt.destLabel,
          is_overnight:     isOvernightTrip(outboundOpt),
          price:            outboundAmount,
          price_per_person: outboundOpt.price,
          quantity,
          seat_pos:         outboundSeatPos,
          seat_side:        outboundSeatSide,
          note:             outboundNote || undefined,
        } : undefined,
        return_meta: returnOpt ? {
          option_id:        returnOpt.id,
          operator:         returnOpt.operator,
          class:            returnOpt.classBadge,
          mode:             returnOpt.mode,
          icon:             returnOpt.icon,
          depart_date:      returnDate,
          departure_time:   returnOpt.departureTime,
          arrival_time:     returnOpt.arrivalTime,
          duration_minutes: returnOpt.durationMinutes,
          origin_label:     returnOpt.originLabel,
          dest_label:       returnOpt.destLabel,
          is_overnight:     isOvernightTrip(returnOpt),
          price:            returnAmount,
          price_per_person: returnOpt.price,
          quantity,
          seat_pos:         returnSeatPos,
          seat_side:        returnSeatSide,
          note:             returnNote || undefined,
        } : undefined,
      });
      await initiatePayment.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      // Save plan locally so booking detail can rebuild itinerary
      // even when server hasn't saved rich metadata yet
      const selectedHotelObj = hotels?.find(h => h.id === selectedHotel) ?? null;
      const plan = {
        departDate,
        returnDate,
        checkInDate,
        checkOutDate,
        outboundMeta: outboundOpt ? {
          option_id:        outboundOpt.id,
          operator:         outboundOpt.operator,
          class:            outboundOpt.classBadge,
          mode:             outboundOpt.mode,
          icon:             outboundOpt.icon,
          depart_date:      departDate,
          departure_time:   outboundOpt.departureTime,
          arrival_time:     outboundOpt.arrivalTime,
          duration_minutes: outboundOpt.durationMinutes,
          origin_label:     outboundOpt.originLabel,
          dest_label:       outboundOpt.destLabel,
          is_overnight:     isOvernightTrip(outboundOpt),
          price:            outboundAmount,
          price_per_person: outboundOpt.price,
          quantity,
          seat_pos:         outboundSeatPos,
          seat_side:        outboundSeatSide,
        } : null,
        returnMeta: returnOpt ? {
          option_id:        returnOpt.id,
          operator:         returnOpt.operator,
          class:            returnOpt.classBadge,
          mode:             returnOpt.mode,
          icon:             returnOpt.icon,
          depart_date:      returnDate,
          departure_time:   returnOpt.departureTime,
          arrival_time:     returnOpt.arrivalTime,
          duration_minutes: returnOpt.durationMinutes,
          origin_label:     returnOpt.originLabel,
          dest_label:       returnOpt.destLabel,
          is_overnight:     isOvernightTrip(returnOpt),
          price:            returnAmount,
          price_per_person: returnOpt.price,
          quantity,
          seat_pos:         returnSeatPos,
          seat_side:        returnSeatSide,
        } : null,
        hotelMeta: selectedHotelObj ? {
          check_in:              checkInDate,
          check_out:             checkOutDate,
          nights,
          early_check_in:        earlyCheckIn,
          early_check_in_time:   earlyCheckIn ? earlyCheckInTime : null,
          late_check_out:        lateCheckOut,
          late_check_out_time:   lateCheckOut ? lateCheckOutTime : null,
        } : null,
        hotel: selectedHotelObj ? {
          name:        selectedHotelObj.name,
          star_rating: selectedHotelObj.star_rating,
          address:     selectedHotelObj.address ?? '',
        } : null,
      };
      await AsyncStorage.setItem(`booking_plan_${id}`, JSON.stringify(plan));

      Alert.alert(
        'Pembayaran Berhasil! 🎉',
        'Tiket kamu sedang diproses. Cek di halaman Tiket Saya.',
        [{ text: 'Lihat Tiket', onPress: () => router.replace('/(tabs)/bookings') }],
      );
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'BOOKING_EXPIRED') {
        Alert.alert('Booking Kadaluarsa', 'Waktu pemesanan habis. Silakan pesan ulang.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Gagal', 'Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{
        headerShown: true, title: 'Checkout', headerBackVisible: false,
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Ringkasan Pesanan ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
          <View style={styles.summaryCard}>
            {eventTitle ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Event</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{eventTitle}</Text>
              </View>
            ) : null}
            {tierName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tiket</Text>
                <Text style={styles.summaryValue}>{tierName} × {qty}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ID Booking</Text>
              <Text style={[styles.summaryValue, styles.mono]} numberOfLines={1}>{id}</Text>
            </View>
            <View style={[styles.summaryRow, styles.lastRow]}>
              <Text style={styles.summaryLabel}>Harga Tiket</Text>
              <Text style={[styles.summaryValue, { color: BLUE, fontWeight: '700' }]}>{fmt(ticketAmount)}</Text>
            </View>
          </View>
        </View>

        {/* ── Data Pemesan ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Pemesan</Text>
          <View style={styles.formCard}>
            <Text style={styles.formHelper}>Konfirmasi booking dikirim ke kontak di bawah</Text>

            <Text style={styles.fieldLabel}>Nama Lengkap <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, !contactName && styles.fieldInputEmpty]}
              placeholder="Sesuai KTP / paspor"
              placeholderTextColor="#9CA3AF"
              value={contactName}
              onChangeText={setContactName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, !contactEmail && styles.fieldInputEmpty]}
              placeholder="contoh@email.com"
              placeholderTextColor="#9CA3AF"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Nomor HP <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.fieldInput, !contactPhone && styles.fieldInputEmpty]}
              placeholder="08xxxxxxxxxx"
              placeholderTextColor="#9CA3AF"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* ── Data Peserta ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Data Peserta</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>{quantity} Tiket</Text>
            </View>
          </View>

          {attendees.map((att, idx) => (
            <View key={idx} style={styles.formCard}>
              <Text style={styles.attendeeTitle}>Peserta {idx + 1}</Text>

              <Text style={styles.fieldLabel}>Nama Lengkap <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, !att.name && styles.fieldInputEmpty]}
                placeholder="Sesuai identitas"
                placeholderTextColor="#9CA3AF"
                value={att.name}
                onChangeText={v => updateAttendee(idx, 'name', v)}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Jenis Identitas <Text style={styles.required}>*</Text></Text>
              <View style={styles.idTypeRow}>
                {ID_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.idTypeBtn, att.id_type === t.value && styles.idTypeBtnActive]}
                    onPress={() => updateAttendee(idx, 'id_type', t.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.idTypeTxt, att.id_type === t.value && styles.idTypeTxtActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nomor {att.id_type === 'ktp' ? 'KTP' : 'Paspor'} <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, !att.id_number && styles.fieldInputEmpty]}
                placeholder={att.id_type === 'ktp' ? '16 digit NIK' : 'Nomor paspor'}
                placeholderTextColor="#9CA3AF"
                value={att.id_number}
                onChangeText={v => updateAttendee(idx, 'id_number', v)}
                keyboardType={att.id_type === 'ktp' ? 'numeric' : 'default'}
              />
            </View>
          ))}
        </View>

        {/* ── Tanggal Perjalanan ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tanggal Perjalanan</Text>
          <DateRangePickerField
            startLabel="Berangkat"
            endLabel="Pulang"
            startValue={departDate}
            endValue={returnDate}
            onChangeStart={d => { setDepartDate(d); setOutboundTransportId(null); setReturnTransportId(null); }}
            onChangeEnd={v => { setReturnDate(v); setReturnTransportId(null); }}
            onReset={() => { setDepartDate(null); setReturnDate(null); setOutboundTransportId(null); setReturnTransportId(null); }}
            minDate={new Date()}
            startMaxDate={eventStartAt ? parseISO(eventStartAt.split('T')[0]) : undefined}
            startPlaceholder="Pilih tanggal"
            endPlaceholder="Opsional"
            endOptional
          />
          {homeCity ? (
            <View style={styles.originRow}>
              <Text style={styles.originIcon}>📍</Text>
              <Text style={styles.originText}>Kota asal: <Text style={styles.originCity}>{homeCity}</Text></Text>
            </View>
          ) : null}
        </View>

        {/* ── Transportasi Pergi ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transportasi Pergi</Text>
            <View style={styles.optionalBadge}><Text style={styles.optionalText}>Opsional</Text></View>
          </View>

          {!departDate ? (
            <View style={styles.gateCard}>
              <Text style={styles.gateText}>📅  Pilih tanggal perjalanan terlebih dahulu</Text>
            </View>
          ) : (
            <>
              {/* Mode filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {TRANSPORT_MODES.map(m => {
                  const active = filterModeOut === m.value;
                  return (
                    <TouchableOpacity key={m.value} style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setFilterModeOut(m.value as TransportFilter)} activeOpacity={0.8}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Operator accordion */}
              {outboundGroups.map(group => {
                const isExpanded = expandedOutboundOp === group.key;
                const selInGroup = group.options.find(o => o.id === outboundTransportId);
                return (
                  <View key={group.key} style={[styles.opCard, !!selInGroup && styles.opCardActive]}>
                    <TouchableOpacity style={styles.opHeader} activeOpacity={0.8}
                      onPress={() => setExpandedOutboundOp(isExpanded ? null : group.key)}>
                      <Text style={styles.opIcon}>{group.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.opName}>{group.baseOperator}</Text>
                        <Text style={styles.opMeta}>
                          {MODE_LABEL[group.mode]} · {group.options.length > 1 ? `${group.options.length} kelas` : group.options[0].classBadge} · dari {fmt(group.minPrice)}
                        </Text>
                      </View>
                      {selInGroup && (
                        <View style={styles.opSelBadge}>
                          <Text style={styles.opSelText}>{selInGroup.classBadge}</Text>
                        </View>
                      )}
                      <Text style={styles.opChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.classesWrap}>
                        {group.options.map(opt => {
                          const isSel = outboundTransportId === opt.id;
                          const arrDate = isOvernightTrip(opt) ? addDays(parseISO(departDate), 1) : parseISO(departDate);
                          const serviceName = optionServiceLabel(opt);
                          return (
                            <TouchableOpacity key={opt.id} activeOpacity={0.8}
                              style={[styles.classCard, isSel && styles.classCardActive]}
                              onPress={() => { setOutboundTransportId(isSel ? null : opt.id); if (!isSel) setExpandedOutboundOp(null); }}>
                              {/* Class header */}
                              <View style={styles.classHead}>
                                <View style={styles.classBadgeWrap}>
                                  <Text style={styles.classBadgeTxt}>{serviceName !== opt.classBadge ? `${serviceName} · ` : ''}{opt.classBadge}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={[styles.classPrice, isSel && styles.classPriceActive]}>{fmt(opt.price * quantity)}</Text>
                                  {quantity > 1 && <Text style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(opt.price)}/orang</Text>}
                                </View>
                                {isSel && <Text style={styles.classCheck}>✓</Text>}
                              </View>
                              {/* Route */}
                              <View style={styles.routeRow}>
                                <View style={styles.routePoint}>
                                  <Text style={styles.routeTime}>{opt.departureTime}</Text>
                                  <Text style={styles.routeTerminal} numberOfLines={1}>{opt.originLabel}</Text>
                                </View>
                                <View style={styles.routeMiddle}>
                                  <Text style={styles.routeDuration}>{formatDuration(opt.durationMinutes)}</Text>
                                  <View style={styles.routeLine} />
                                  <Text style={styles.routeArrow}>›</Text>
                                </View>
                                <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
                                  <Text style={styles.routeTime}>{opt.arrivalTime}</Text>
                                  <Text style={styles.routeTerminal} numberOfLines={1}>{opt.destLabel}</Text>
                                </View>
                              </View>
                              {/* Dates */}
                              <View style={styles.travelDatesRow}>
                                <Text style={styles.travelDate}>🛫 {format(parseISO(departDate), 'd MMM', { locale: idLocale })}</Text>
                                <Text style={styles.travelDateArrow}>——</Text>
                                <Text style={styles.travelDate}>
                                  🛬 {format(arrDate, 'd MMM', { locale: idLocale })}
                                  {isOvernightTrip(opt) ? ' (+1 hari)' : ''}
                                </Text>
                              </View>
                              {/* Facilities */}
                              <View style={styles.facilitiesRow}>
                                {opt.facilities.slice(0, 4).map(f => (
                                  <View key={f} style={[styles.facilityChip, isSel && styles.facilityChipActive]}>
                                    <Text style={[styles.facilityText, isSel && styles.facilityTextActive]}>{f}</Text>
                                  </View>
                                ))}
                                {opt.facilities.length > 4 && (
                                  <View style={[styles.facilityChip, isSel && styles.facilityChipActive]}>
                                    <Text style={[styles.facilityText, isSel && styles.facilityTextActive]}>+{opt.facilities.length - 4}</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Seat preference */}
              {outboundTransportId && (
                <View style={styles.seatCard}>
                  <Text style={styles.seatTitle}>🪑 Preferensi Kursi <Text style={styles.seatNote}>*berdasarkan ketersediaan</Text></Text>
                  <View style={styles.seatRow}>
                    {SEAT_POSITIONS.map(p => (
                      <TouchableOpacity key={p.value} style={[styles.seatPill, outboundSeatPos === p.value && styles.seatPillActive]}
                        onPress={() => setOutboundSeatPos(p.value)}>
                        <Text style={[styles.seatPillTxt, outboundSeatPos === p.value && styles.seatPillTxtActive]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.seatRow}>
                    {SEAT_SIDES.map(s => (
                      <TouchableOpacity key={s.value} style={[styles.seatPill, outboundSeatSide === s.value && styles.seatPillActive]}
                        onPress={() => setOutboundSeatSide(s.value)}>
                        <Text style={[styles.seatPillTxt, outboundSeatSide === s.value && styles.seatPillTxtActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <CollapsibleInput label="Permintaan khusus transportasi pergi" value={outboundNote} onChangeText={setOutboundNote}
                placeholder="cth: kursi roda, bagasi tambahan..." />
            </>
          )}
        </View>

        {/* ── Transportasi Pulang ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transportasi Pulang</Text>
            <View style={styles.optionalBadge}><Text style={styles.optionalText}>Opsional</Text></View>
          </View>

          {!returnDate ? (
            <View style={styles.gateCard}>
              <Text style={styles.gateText}>📅  Pilih tanggal pulang terlebih dahulu</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {TRANSPORT_MODES.map(m => {
                  const active = filterModeRet === m.value;
                  return (
                    <TouchableOpacity key={m.value} style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setFilterModeRet(m.value as TransportFilter)} activeOpacity={0.8}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {returnGroups.map(group => {
                const isExpanded = expandedReturnOp === group.key;
                const selInGroup = group.options.find(o => o.id === returnTransportId);
                return (
                  <View key={group.key} style={[styles.opCard, !!selInGroup && styles.opCardActive]}>
                    <TouchableOpacity style={styles.opHeader} activeOpacity={0.8}
                      onPress={() => setExpandedReturnOp(isExpanded ? null : group.key)}>
                      <Text style={styles.opIcon}>{group.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.opName}>{group.baseOperator}</Text>
                        <Text style={styles.opMeta}>
                          {MODE_LABEL[group.mode]} · {group.options.length > 1 ? `${group.options.length} kelas` : group.options[0].classBadge} · dari {fmt(group.minPrice)}
                        </Text>
                      </View>
                      {selInGroup && (
                        <View style={styles.opSelBadge}>
                          <Text style={styles.opSelText}>{selInGroup.classBadge}</Text>
                        </View>
                      )}
                      <Text style={styles.opChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.classesWrap}>
                        {group.options.map(opt => {
                          const isSel = returnTransportId === opt.id;
                          const retArrDate = isOvernightTrip(opt) ? addDays(parseISO(returnDate), 1) : parseISO(returnDate);
                          const serviceName = optionServiceLabel(opt);
                          return (
                            <TouchableOpacity key={opt.id} activeOpacity={0.8}
                              style={[styles.classCard, isSel && styles.classCardActive]}
                              onPress={() => { setReturnTransportId(isSel ? null : opt.id); if (!isSel) setExpandedReturnOp(null); }}>
                              <View style={styles.classHead}>
                                <View style={styles.classBadgeWrap}>
                                  <Text style={styles.classBadgeTxt}>{serviceName !== opt.classBadge ? `${serviceName} · ` : ''}{opt.classBadge}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={[styles.classPrice, isSel && styles.classPriceActive]}>{fmt(opt.price * quantity)}</Text>
                                  {quantity > 1 && <Text style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(opt.price)}/orang</Text>}
                                </View>
                                {isSel && <Text style={styles.classCheck}>✓</Text>}
                              </View>
                              <View style={styles.routeRow}>
                                <View style={styles.routePoint}>
                                  <Text style={styles.routeTime}>{opt.departureTime}</Text>
                                  <Text style={styles.routeTerminal} numberOfLines={1}>{opt.originLabel}</Text>
                                </View>
                                <View style={styles.routeMiddle}>
                                  <Text style={styles.routeDuration}>{formatDuration(opt.durationMinutes)}</Text>
                                  <View style={styles.routeLine} />
                                  <Text style={styles.routeArrow}>›</Text>
                                </View>
                                <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
                                  <Text style={styles.routeTime}>{opt.arrivalTime}</Text>
                                  <Text style={styles.routeTerminal} numberOfLines={1}>{opt.destLabel}</Text>
                                </View>
                              </View>
                              <View style={styles.travelDatesRow}>
                                <Text style={styles.travelDate}>🛫 {format(parseISO(returnDate), 'd MMM', { locale: idLocale })}</Text>
                                <Text style={styles.travelDateArrow}>——</Text>
                                <Text style={styles.travelDate}>
                                  🛬 {format(retArrDate, 'd MMM', { locale: idLocale })}
                                  {isOvernightTrip(opt) ? ' (+1 hari)' : ''}
                                </Text>
                              </View>
                              <View style={styles.facilitiesRow}>
                                {opt.facilities.slice(0, 4).map(f => (
                                  <View key={f} style={[styles.facilityChip, isSel && styles.facilityChipActive]}>
                                    <Text style={[styles.facilityText, isSel && styles.facilityTextActive]}>{f}</Text>
                                  </View>
                                ))}
                                {opt.facilities.length > 4 && (
                                  <View style={[styles.facilityChip, isSel && styles.facilityChipActive]}>
                                    <Text style={[styles.facilityText, isSel && styles.facilityTextActive]}>+{opt.facilities.length - 4}</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              {returnTransportId && (
                <View style={styles.seatCard}>
                  <Text style={styles.seatTitle}>🪑 Preferensi Kursi <Text style={styles.seatNote}>*berdasarkan ketersediaan</Text></Text>
                  <View style={styles.seatRow}>
                    {SEAT_POSITIONS.map(p => (
                      <TouchableOpacity key={p.value} style={[styles.seatPill, returnSeatPos === p.value && styles.seatPillActive]}
                        onPress={() => setReturnSeatPos(p.value)}>
                        <Text style={[styles.seatPillTxt, returnSeatPos === p.value && styles.seatPillTxtActive]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.seatRow}>
                    {SEAT_SIDES.map(s => (
                      <TouchableOpacity key={s.value} style={[styles.seatPill, returnSeatSide === s.value && styles.seatPillActive]}
                        onPress={() => setReturnSeatSide(s.value)}>
                        <Text style={[styles.seatPillTxt, returnSeatSide === s.value && styles.seatPillTxtActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <CollapsibleInput label="Permintaan khusus transportasi pulang" value={returnNote} onChangeText={setReturnNote}
                placeholder="cth: kursi roda, bagasi tambahan..." />
            </>
          )}
        </View>

        {/* ── Penginapan ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Penginapan</Text>
            <View style={styles.optionalBadge}><Text style={styles.optionalText}>Opsional</Text></View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.iconBtn, sortBy !== 'distance' && styles.iconBtnActive]}
              onPress={() => openHotelModal('sort')} activeOpacity={0.8}
            >
              <Text style={[styles.iconBtnText, sortBy !== 'distance' && styles.iconBtnTextActive]}>↕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, activeFilterCount > 0 && styles.iconBtnActive]}
              onPress={() => openHotelModal('filter')} activeOpacity={0.8}
            >
              <Text style={[styles.iconBtnText, activeFilterCount > 0 && styles.iconBtnTextActive]}>≡</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Hotel date pickers — minDate dari tanggal tiba transportasi */}
          <DateRangePickerField
            startLabel="Check-in"
            endLabel="Check-out"
            startValue={checkInDate}
            endValue={checkOutDate}
            onChangeStart={setCheckInDate}
            onChangeEnd={setCheckOutDate}
            onReset={() => { setCheckInDate(null); setCheckOutDate(null); }}
            minDate={transportArrivalDate}
            startPlaceholder="Pilih tanggal"
            endPlaceholder="Pilih tanggal"
          />
          {checkInDate && checkOutDate && (
            <Text style={styles.nightsLabel}>
              {nights} malam · Check-in 14:00 · Check-out 12:00
            </Text>
          )}

          {/* Hotel list */}
          {displayedHotels.map(hotel => {
            const isSelected = selectedHotel === hotel.id;
            const dist = fmtDist(hotel.distance_km);
            const facilities = hotelFacilities(hotel.star_rating);
            return (
              <TouchableOpacity
                key={hotel.id}
                style={[styles.hotelCard, isSelected && styles.hotelCardActive]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedHotel(null);
                    setSelectedRoomType(null);
                    setRoomSheetHotelId(null);
                  } else {
                    setRoomSheetHotelId(hotel.id);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.hotelTop}>
                  <View style={styles.hotelLeft}>
                    <Text style={styles.hotelIcon}>🏨</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
                        {hotel.id === preselectedHotelNum && (
                          <Text style={styles.itineraryTag}>✨</Text>
                        )}
                      </View>
                      <View style={styles.hotelMeta}>
                        <Text style={styles.starText}>{'⭐'.repeat(hotel.star_rating)}</Text>
                        {dist && (
                          <View style={[styles.distBadge, isSelected && styles.distBadgeActive]}>
                            <Text style={[styles.distText, isSelected && styles.distTextActive]}>📍 {dist}</Text>
                          </View>
                        )}
                      </View>
                      {isSelected && selectedRoomType && (
                        <Text style={styles.roomTypeBadge}>{selectedRoomType.name} · {selectedRoomType.bed_type}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.hotelPrice, isSelected && styles.hotelPriceActive]}>
                      {fmt(isSelected && selectedRoomType ? selectedRoomType.price_per_night : hotel.base_price)}
                    </Text>
                    <Text style={styles.perNight}>/malam</Text>
                    {nights > 1 && (
                      <Text style={styles.totalNights}>
                        {nights} malam = {fmt((isSelected && selectedRoomType ? selectedRoomType.price_per_night : hotel.base_price) * nights)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Facilities */}
                <View style={styles.facilitiesRow}>
                  {facilities.slice(0, 4).map(f => (
                    <View key={f} style={[styles.facilityChip, isSelected && styles.facilityChipActive]}>
                      <Text style={[styles.facilityText, isSelected && styles.facilityTextActive]}>{f}</Text>
                    </View>
                  ))}
                  {facilities.length > 4 && (
                    <View style={[styles.facilityChip, isSelected && styles.facilityChipActive]}>
                      <Text style={[styles.facilityText, isSelected && styles.facilityTextActive]}>+{facilities.length - 4}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {displayedHotels.length === 0 && (
            <Text style={styles.emptyHint}>
              {(hotels ?? []).length === 0
                ? 'Tidak ada hotel tersedia di kota ini'
                : 'Tidak ada hotel yang sesuai filter'}
            </Text>
          )}

          {/* Early / Late check-in section (only when hotel selected) */}
          {selectedHotel && (
            <View style={styles.checkInCard}>
              <Text style={styles.checkInTitle}>⏰ Permintaan Waktu</Text>

              {/* Early check-in */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Early Check-in</Text>
                  <Text style={styles.toggleNote}>*Tergantung ketersediaan · +Rp150.000</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, earlyCheckIn && styles.toggleOn]}
                  onPress={() => setEarlyCheckIn(v => !v)}
                >
                  <View style={[styles.toggleThumb, earlyCheckIn && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {earlyCheckIn && (
                <View style={styles.timePickerRow}>
                  {EARLY_CHECKIN_TIMES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timePill, earlyCheckInTime === t && styles.timePillActive]}
                      onPress={() => setEarlyCheckInTime(t)}
                    >
                      <Text style={[styles.timePillText, earlyCheckInTime === t && styles.timePillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.divider} />

              {/* Late check-out */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Late Check-out</Text>
                  <Text style={styles.toggleNote}>*Tergantung ketersediaan · +Rp100.000</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, lateCheckOut && styles.toggleOn]}
                  onPress={() => setLateCheckOut(v => !v)}
                >
                  <View style={[styles.toggleThumb, lateCheckOut && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {lateCheckOut && (
                <View style={styles.timePickerRow}>
                  {LATE_CHECKOUT_TIMES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timePill, lateCheckOutTime === t && styles.timePillActive]}
                      onPress={() => setLateCheckOutTime(t)}
                    >
                      <Text style={[styles.timePillText, lateCheckOutTime === t && styles.timePillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <CollapsibleInput
            label="Permintaan khusus penginapan"
            value={hotelNote}
            onChangeText={setHotelNote}
            placeholder="cth: lantai tinggi, extra bed, honeymoon setup, kamar bebas rokok..."
          />
        </View>

        {/* ── Itinerary Perjalanan ── */}
        {itineraryDays.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Itinerary Perjalanan</Text>
              <View style={styles.optionalBadge}><Text style={styles.optionalText}>Otomatis</Text></View>
            </View>
            {itineraryDays.map((day, di) => (
              <View key={day.date} style={styles.itinDay}>
                {/* Day header */}
                <View style={styles.itinDayHeader}>
                  <View style={styles.itinDayBadge}>
                    <Text style={styles.itinDayNum}>{day.dayNum}</Text>
                  </View>
                  <View>
                    <Text style={styles.itinDayDate}>{day.dateLabel}</Text>
                    <Text style={styles.itinDayTitle}>{day.dayTitle}</Text>
                  </View>
                </View>

                {/* Timeline items */}
                {day.items.map((item, ii) => (
                  <View key={ii} style={styles.itinRow}>
                    {/* Left: time + line */}
                    <View style={styles.itinLeft}>
                      <Text style={styles.itinTime}>{item.time ?? ''}</Text>
                      {ii < day.items.length - 1 && <View style={styles.itinLine} />}
                    </View>
                    {/* Dot */}
                    <View style={[styles.itinDot, item.highlight && styles.itinDotHighlight]} />
                    {/* Content */}
                    <View style={[styles.itinContent, item.highlight && styles.itinContentHighlight]}>
                      <View style={styles.itinIconTitle}>
                        <Text style={styles.itinIcon}>{item.icon}</Text>
                        <Text style={[styles.itinTitle, item.highlight && styles.itinTitleHighlight]} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>
                      {item.subtitle ? (
                        <Text style={styles.itinSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Metode Pembayaran ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
          {PAYMENT_METHODS.map(pm => {
            const isSelected = selectedPayment === pm.id;
            return (
              <TouchableOpacity
                key={pm.id}
                style={[styles.optionCard, isSelected && styles.optionCardActive]}
                onPress={() => setSelectedPayment(pm.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>{pm.icon}</Text>
                  <View>
                    <Text style={styles.optionLabel}>{pm.label}</Text>
                    <Text style={styles.optionDesc}>{pm.desc}</Text>
                  </View>
                </View>
                <View style={[styles.radio, isSelected && styles.radioActive]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.timerBanner}>
          <Text style={styles.timerText}>⏱ Selesaikan pembayaran dalam 15 menit</Text>
        </View>

        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Tiket</Text>
            <Text style={styles.breakdownVal}>{fmt(ticketAmount)}</Text>
          </View>
          {hotelAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Penginapan{checkInDate && checkOutDate ? ` (${nights} malam)` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(hotelAmount)}</Text>
            </View>
          )}
          {earlyFee > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Early Check-in {earlyCheckInTime}</Text>
              <Text style={styles.breakdownVal}>{fmt(earlyFee)}</Text>
            </View>
          )}
          {lateFee > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Late Check-out {lateCheckOutTime}</Text>
              <Text style={styles.breakdownVal}>{fmt(lateFee)}</Text>
            </View>
          )}
          {outboundAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Transport Pergi ({outboundOpt?.classBadge}){quantity > 1 ? ` × ${quantity} orang` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(outboundAmount)}</Text>
            </View>
          )}
          {returnAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Transport Pulang ({returnOpt?.classBadge}){quantity > 1 ? ` × ${quantity} orang` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(returnAmount)}</Text>
            </View>
          )}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Biaya Layanan (inkl. pajak)</Text>
            <Text style={styles.breakdownVal}>{fmt(platformFee)}</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Pembayaran</Text>
          <Text style={styles.totalAmount}>{fmt(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePay} disabled={loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.payBtnText}>Bayar Sekarang</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Room Type Sheet ── */}
      {roomSheetHotelId && (() => {
        const sheetHotel = (hotels ?? []).find(h => h.id === roomSheetHotelId);
        return (
          <RoomTypeSheet
            visible={!!roomSheetHotelId}
            hotelName={sheetHotel?.name ?? ''}
            hotelStars={sheetHotel?.star_rating ?? 0}
            rooms={roomTypes ?? []}
            isLoading={roomTypesLoading}
            selectedRoomId={selectedRoomType?.id ?? null}
            nights={nights}
            onSelect={room => {
              setSelectedHotel(roomSheetHotelId);
              setSelectedRoomType(room);
              setRoomSheetHotelId(null);
            }}
            onClose={() => setRoomSheetHotelId(null)}
          />
        );
      })()}

      {/* ── Hotel Sort & Filter Modal ── */}
      <Modal visible={showHotelModal} transparent animationType="slide" onRequestClose={() => setShowHotelModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHotelModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.tabBar}>
              {(['sort', 'filter'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'sort' ? 'Urutkan' : `Filter${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {activeTab === 'sort' ? (
                <View style={styles.modalSection}>
                  {SORT_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.value} style={styles.sortRow} onPress={() => setPendingSort(opt.value)}>
                      <Text style={[styles.sortLabel, pendingSort === opt.value && styles.sortLabelActive]}>{opt.label}</Text>
                      <View style={[styles.radio, pendingSort === opt.value && styles.radioActive]}>
                        {pendingSort === opt.value && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.modalSection}>
                  <Text style={styles.filterGroupTitle}>Bintang Hotel</Text>
                  <View style={styles.pillRow}>
                    {[2, 3, 4, 5].map(star => {
                      const active = pendingStars.includes(star);
                      return (
                        <TouchableOpacity key={star} style={[styles.pill, active && styles.pillActive]} onPress={() => togglePendingStar(star)} activeOpacity={0.8}>
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{'⭐'.repeat(star)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.filterGroupTitle}>Rentang Harga</Text>
                  <View style={styles.pillRow}>
                    {PRICE_RANGES.map(pr => {
                      const active = pendingPrice === pr.value;
                      return (
                        <TouchableOpacity key={pr.value} style={[styles.pill, active && styles.pillActive]} onPress={() => setPendingPrice(pr.value)} activeOpacity={0.8}>
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{pr.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.filterGroupTitle}>Jarak dari Venue</Text>
                  <View style={styles.pillRow}>
                    {DISTANCE_FILTERS.map(f => {
                      const active = pendingDist === f.value;
                      return (
                        <TouchableOpacity key={f.value} style={[styles.pill, active && styles.pillActive]} onPress={() => setPendingDist(f.value)} activeOpacity={0.8}>
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetHotelModal} activeOpacity={0.8}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyHotelModal} activeOpacity={0.85}>
                <Text style={styles.applyText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8F9FA' },
  container:   { padding: 20 },
  backChevron: { fontSize: 32, color: BLUE, fontWeight: '300', lineHeight: 36, marginLeft: 4 },

  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  optionalBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  optionalText:  { fontSize: 11, color: BLUE, fontWeight: '700' },

  // Summary card
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  lastRow:      { borderBottomWidth: 0 },
  summaryLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  summaryValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 2, textAlign: 'right' },
  mono:         { fontSize: 11, color: '#6B7280' },

  nightsLabel: { fontSize: 12, color: '#5B8EF0', fontWeight: '600', marginTop: -2, marginBottom: 10 },
  originRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  originIcon: { fontSize: 14 },
  originText: { fontSize: 12, color: '#6B7280' },
  originCity: { fontWeight: '700', color: '#111827' },

  // Transport mode chips
  chipsScroll: { marginBottom: 10 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', marginRight: 8 },
  chipActive:   { backgroundColor: BLUE, borderColor: BLUE },
  chipText:     { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  // Gate card (when dates not yet selected)
  gateCard:  { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, alignItems: 'center' },
  gateText:  { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  // Operator accordion
  opCard:       { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10, overflow: 'hidden' },
  opCardActive: { borderColor: BLUE },
  opHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  opIcon:       { fontSize: 22 },
  opName:       { fontSize: 14, fontWeight: '700', color: '#111827' },
  opMeta:       { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  opSelBadge:   { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  opSelText:    { fontSize: 11, fontWeight: '700', color: BLUE },
  opChevron:    { fontSize: 11, color: '#9CA3AF', marginLeft: 4 },

  // Class cards (inside accordion)
  classesWrap:      { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  classCard:        { padding: 14, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  classCardActive:  { backgroundColor: '#EFF6FF' },
  classHead:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  classBadgeWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  classBadgeTxt:    { fontSize: 13, fontWeight: '700', color: '#374151' },
  classPrice:       { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  classPriceActive: { color: BLUE },
  classCheck:       { fontSize: 16, color: BLUE, fontWeight: '800' },

  // Travel dates row (departure → arrival date)
  travelDatesRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  travelDate:      { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  travelDateArrow: { fontSize: 12, color: '#CBD5E1', flex: 1, textAlign: 'center' },

  // Seat preference
  seatCard:       { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  seatTitle:      { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  seatNote:       { fontSize: 11, color: '#9CA3AF', fontWeight: '400' },
  seatRow:        { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  seatPill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F8FAFD' },
  seatPillActive: { backgroundColor: BLUE, borderColor: BLUE },
  seatPillTxt:        { fontSize: 13, color: '#374151', fontWeight: '600' },
  seatPillTxtActive:  { color: '#FFFFFF' },

  // Transport cards
  transportCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', padding: 14, marginBottom: 10,
  },
  transportCardActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  transportTop:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  transportLeft:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  transportIcon:       { fontSize: 22, marginTop: 2 },
  transportOperator:   { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  transportPrice:      { fontSize: 15, fontWeight: '800', color: '#6B7280' },
  transportPriceActive: { color: BLUE },
  classBadge:     { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  classBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  itineraryTag:   { fontSize: 11, color: P, fontWeight: '600' },

  routeRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routePoint:    { flex: 2 },
  routeMiddle:   { flex: 3, alignItems: 'center' },
  routeTime:     { fontSize: 16, fontWeight: '800', color: '#111827' },
  routeTerminal: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  routeDuration: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 3 },
  routeLine:     { height: 1.5, width: '80%', backgroundColor: '#CBD5E1' },
  routeArrow:    { fontSize: 16, color: '#CBD5E1', fontWeight: '700', marginTop: 3 },

  // Hotel cards
  hotelCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', padding: 14, marginBottom: 10,
  },
  hotelCardActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  hotelTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  hotelLeft:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  hotelIcon:   { fontSize: 22, marginTop: 2 },
  hotelName:   { fontSize: 14, fontWeight: '700', color: '#111827' },
  hotelMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  starText:    { fontSize: 12 },
  hotelPrice:  { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  hotelPriceActive: { color: BLUE },
  perNight:    { fontSize: 11, color: '#9CA3AF' },
  totalNights:    { fontSize: 11, color: BLUE, fontWeight: '700', marginTop: 2 },
  roomTypeBadge:  { fontSize: 11, color: BLUE, fontWeight: '600', marginTop: 3 },

  distBadge:       { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  distBadgeActive: { backgroundColor: 'rgba(29,99,237,0.1)' },
  distText:        { fontSize: 11, color: BLUE, fontWeight: '600' },
  distTextActive:  { color: BLUE },

  // Facilities
  facilitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facilityChip:  { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  facilityChipActive: { backgroundColor: 'rgba(29,99,237,0.1)' },
  facilityText:  { fontSize: 11, color: '#475569', fontWeight: '600' },
  facilityTextActive: { color: BLUE },

  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  // Early/late check-in card
  checkInCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 14, marginBottom: 10,
  },
  checkInTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  toggleNote:  { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  toggle:      { width: 44, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', padding: 2, justifyContent: 'center' },
  toggleOn:    { backgroundColor: BLUE },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  timePickerRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  timePill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F8FAFD' },
  timePillActive:     { backgroundColor: BLUE, borderColor: BLUE },
  timePillText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  timePillTextActive: { color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  // Payment options
  optionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E5E7EB', padding: 14, marginBottom: 10,
  },
  optionCardActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  optionLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionIcon:  { fontSize: 24 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionDesc:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: BLUE },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },

  // Sort/filter icon buttons
  iconBtn:          { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive:    { backgroundColor: BLUE },
  iconBtnText:      { fontSize: 16, color: '#6B7280', fontWeight: '700', lineHeight: 20 },
  iconBtnTextActive: { color: '#FFFFFF' },
  filterBadge:      { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText:  { fontSize: 9, color: '#FFFFFF', fontWeight: '800' },

  // Itinerary
  itinDay: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 14, marginBottom: 10,
  },
  itinDayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  itinDayBadge:  {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center',
  },
  itinDayNum:    { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  itinDayDate:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  itinDayTitle:  { fontSize: 13, fontWeight: '700', color: '#111827' },

  itinRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 36 },
  itinLeft:    { width: 38, alignItems: 'flex-end', gap: 0 },
  itinTime:    { fontSize: 11, fontWeight: '700', color: BLUE, lineHeight: 20, minHeight: 20 },
  itinLine:    { width: 1.5, flex: 1, backgroundColor: '#E5E7EB', marginTop: 2, marginBottom: 2 },
  itinDot:     {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1',
    marginTop: 6, flexShrink: 0,
  },
  itinDotHighlight: { backgroundColor: BLUE, width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  itinContent: { flex: 1, paddingBottom: 12 },
  itinContentHighlight: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
  },
  itinIconTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itinIcon:      { fontSize: 14 },
  itinTitle:     { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  itinTitleHighlight: { color: BLUE, fontWeight: '700' },
  itinSubtitle:  { fontSize: 11, color: '#9CA3AF', marginTop: 2, marginLeft: 20 },

  timerBanner: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14 },
  timerText:   { fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', padding: 20,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8,
  },
  breakdown:      { gap: 4 },
  breakdownRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 12, color: '#9CA3AF' },
  breakdownVal:   { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  totalRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel:     { fontSize: 14, color: '#374151', fontWeight: '600' },
  totalAmount:    { fontSize: 20, fontWeight: '800', color: '#111827' },
  payBtn:         { backgroundColor: BLUE, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // Hotel sort/filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 34 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  tabBar:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4 },
  tab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BLUE },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: BLUE },
  modalSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  sortRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  sortLabel: { fontSize: 14, color: '#374151' },
  sortLabelActive: { fontWeight: '700', color: '#111827' },
  filterGroupTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  pillActive: { backgroundColor: GREEN, borderColor: GREEN },
  pillText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  resetBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  resetText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  applyBtn:  { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center' },
  applyText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Form peserta ────────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, marginBottom: 10,
  },
  formHelper: { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  attendeeTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 12 },

  fieldLabel:    { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  required:      { color: '#EF4444' },
  fieldInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#111827', backgroundColor: '#FAFAFA',
  },
  fieldInputEmpty: { borderColor: '#E5E7EB' },

  idTypeRow: { flexDirection: 'row', gap: 10 },
  idTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', backgroundColor: '#FAFAFA',
  },
  idTypeBtnActive: { borderColor: BLUE, backgroundColor: '#EFF6FF' },
  idTypeTxt:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  idTypeTxtActive: { color: BLUE },
});
