import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { differenceInDays, parseISO, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBookingDetail, useEditAddons, usePaySupplement } from '../../../hooks/useBooking';
import { api } from '../../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAccommodations, useRoomTypes, RoomType } from '../../../hooks/useAccommodations';
import { usePreferences } from '../../../hooks/usePreferences';
import RoomTypeSheet from '../../../components/RoomTypeSheet';
import {
  getTransportOptions, formatDuration, MODE_LABEL,
  groupByOperator, optionServiceLabel, isOvernightTrip,
  type TransportOption,
} from '../../../data/transportOptions';
import DateRangePickerField from '../../../components/DateRangePickerField';
import CollapsibleInput from '../../../components/CollapsibleInput';

const BLUE  = '#1D63ED';
const GREEN = '#22C55E';

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

function hotelFacilities(stars: number): string[] {
  const base = ['WiFi', 'AC', 'TV'];
  if (stars >= 3) base.push('Sarapan', 'Parkir');
  if (stars >= 4) base.push('Kolam Renang', 'Gym', 'Room Service');
  if (stars >= 5) base.push('Spa', 'Concierge', 'Butler Service');
  return base;
}

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
  { id: 'qris', label: 'QRIS',                icon: '📱', desc: 'GoPay, OVO, Dana, ShopeePay, dll' },
  { id: 'va',   label: 'Transfer Bank',        icon: '🏦', desc: 'BCA, Mandiri, BNI, BRI, Permata' },
  { id: 'card', label: 'Kartu Debit / Kredit', icon: '💳', desc: 'Visa, Mastercard, JCB' },
];

const EARLY_CHECKIN_TIMES = ['10:00', '11:00', '12:00', '13:00'];
const LATE_CHECKOUT_TIMES = ['13:00', '14:00', '15:00', '16:00'];

const SEAT_POSITIONS = [
  { value: 'front',  label: '⬆ Depan'    },
  { value: 'middle', label: '↔ Tengah'   },
  { value: 'back',   label: '⬇ Belakang' },
] as const;

const SEAT_SIDES = [
  { value: 'window-left',  label: '🪟 Kiri'   },
  { value: 'aisle',        label: '🚶 Lorong' },
  { value: 'window-right', label: '🪟 Kanan'  },
] as const;

type SeatPos        = typeof SEAT_POSITIONS[number]['value'];
type SeatSide       = typeof SEAT_SIDES[number]['value'];
type SortOption     = typeof SORT_OPTIONS[number]['value'];
type PriceRange     = typeof PRICE_RANGES[number]['value'];
type DistanceFilter = typeof DISTANCE_FILTERS[number]['value'];
type TransportFilter = typeof TRANSPORT_MODES[number]['value'];

export default function EditAddonsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const editAddons = useEditAddons();
  const paySupplementMutation = usePaySupplement();

  const { data: booking, isLoading: bookingLoading } = useBookingDetail(id);
  const { data: prefs } = usePreferences(true);
  const homeCity = prefs?.home_city ?? '';

  const items: any[] = booking?.booking_items ?? [];
  const ticketItem   = items.find((i: any) => i.item_type === 'ticket');
  const hotelItem    = items.find((i: any) => i.item_type === 'accommodation');
  const outboundItem = items.find((i: any) => i.item_type === 'outbound_transport');
  const returnItem   = items.find((i: any) => i.item_type === 'return_transport');

  const event    = ticketItem?.ticket_tiers?.events;
  const venue    = event?.venues;
  const eventCity = venue?.city ?? '';

  const parsedLat = venue?.latitude  ? parseFloat(venue.latitude)  : undefined;
  const parsedLng = venue?.longitude ? parseFloat(venue.longitude) : undefined;

  const { data: hotels } = useAccommodations(eventCity, parsedLat, parsedLng);

  const allTransport = useMemo(
    () => getTransportOptions(homeCity, eventCity),
    [homeCity, eventCity],
  );
  const allReturnTransport = useMemo(
    () => getTransportOptions(eventCity, homeCity),
    [eventCity, homeCity],
  );

  // ── Selection state (pre-populated from existing booking) ─────────────────

  const [initialized, setInitialized] = useState(false);

  const [selectedHotel,        setSelectedHotel]        = useState<number | null>(null);
  const [selectedRoomType,     setSelectedRoomType]     = useState<RoomType | null>(null);
  const [roomSheetHotelId,     setRoomSheetHotelId]     = useState<number | null>(null);
  const { data: roomTypes, isLoading: roomTypesLoading } = useRoomTypes(roomSheetHotelId);

  const [outboundTransportId,  setOutboundTransportId]  = useState<string | null>(null);
  const [returnTransportId,    setReturnTransportId]    = useState<string | null>(null);
  const [expandedOutboundOp,   setExpandedOutboundOp]   = useState<string | null>(null);
  const [expandedReturnOp,     setExpandedReturnOp]     = useState<string | null>(null);

  const [hotelRoomsQty,        setHotelRoomsQty]        = useState(1);
  const [pendingHotelRooms,    setPendingHotelRooms]    = useState(1);
  const [hotelQtyModal,        setHotelQtyModal]        = useState<{ visible: boolean; hotelId: number | null }>({ visible: false, hotelId: null });

  const [ticketQtyModal, setTicketQtyModal] = useState<{
    visible: boolean; type: 'outbound' | 'return'; opt: TransportOption | null;
  }>({ visible: false, type: 'outbound', opt: null });
  const [pendingTicketQty,     setPendingTicketQty]     = useState(1);
  const [outboundTransportQty, setOutboundTransportQty] = useState(1);
  const [returnTransportQty,   setReturnTransportQty]   = useState(1);

  const [departDate,   setDepartDate]   = useState<string | null>(null);
  const [returnDate,   setReturnDate]   = useState<string | null>(null);
  const [checkInDate,  setCheckInDate]  = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);

  const [outboundSeatPos,  setOutboundSeatPos]  = useState<SeatPos>('middle');
  const [outboundSeatSide, setOutboundSeatSide] = useState<SeatSide>('window-left');
  const [returnSeatPos,    setReturnSeatPos]    = useState<SeatPos>('middle');
  const [returnSeatSide,   setReturnSeatSide]   = useState<SeatSide>('window-left');

  const [earlyCheckIn,     setEarlyCheckIn]     = useState(false);
  const [earlyCheckInTime, setEarlyCheckInTime] = useState('11:00');
  const [lateCheckOut,     setLateCheckOut]     = useState(false);
  const [lateCheckOutTime, setLateCheckOutTime] = useState('14:00');

  const [outboundNote, setOutboundNote] = useState('');
  const [returnNote,   setReturnNote]   = useState('');
  const [hotelNote,    setHotelNote]    = useState('');

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

  const [filterModeOut, setFilterModeOut] = useState<TransportFilter>('all');
  const [filterModeRet, setFilterModeRet] = useState<TransportFilter>('all');

  // Confirm flow state
  const [loading,          setLoading]          = useState(false);
  const [selectedPayment,  setSelectedPayment]  = useState<string | null>(null);
  const [showPaymentStep,  setShowPaymentStep]  = useState(false);
  const [pendingDifference, setPendingDifference] = useState(0);
  const [pendingNewTotal,   setPendingNewTotal]   = useState(0);

  // ── Pre-populate from existing booking once data is available ────────────

  useEffect(() => {
    if (!booking || initialized || !hotels) return;

    const hotelMeta    = hotelItem?.metadata    ?? null;
    const outboundMeta = outboundItem?.metadata ?? null;
    const returnMeta   = returnItem?.metadata   ?? null;

    if (hotelItem?.accommodation_id) {
      const hotelId = hotelItem.accommodation_id;
      const numId = typeof hotelId === 'string'
        ? (hotels.find(h => h.id === hotelId as any)?.id ?? null)
        : hotelId;
      setSelectedHotel(numId as any);
    }
    if (hotelMeta?.check_in)  setCheckInDate(hotelMeta.check_in);
    if (hotelMeta?.check_out) setCheckOutDate(hotelMeta.check_out);
    if (hotelMeta?.rooms)     setHotelRoomsQty(hotelMeta.rooms);
    if (hotelMeta?.early_check_in != null) setEarlyCheckIn(hotelMeta.early_check_in);
    if (hotelMeta?.early_check_in_time)    setEarlyCheckInTime(hotelMeta.early_check_in_time);
    if (hotelMeta?.late_check_out != null) setLateCheckOut(hotelMeta.late_check_out);
    if (hotelMeta?.late_check_out_time)    setLateCheckOutTime(hotelMeta.late_check_out_time);

    if (outboundMeta?.option_id) {
      const found = allTransport.find(t => t.id === outboundMeta.option_id);
      if (found) {
        setOutboundTransportId(found.id);
        setOutboundTransportQty(outboundMeta.quantity ?? 1);
      }
    }
    if (outboundMeta?.depart_date) setDepartDate(outboundMeta.depart_date);
    if (outboundMeta?.seat_pos)    setOutboundSeatPos(outboundMeta.seat_pos);
    if (outboundMeta?.seat_side)   setOutboundSeatSide(outboundMeta.seat_side);
    if (outboundMeta?.note)        setOutboundNote(outboundMeta.note);

    if (returnMeta?.option_id) {
      const found = allReturnTransport.find(t => t.id === returnMeta.option_id);
      if (found) {
        setReturnTransportId(found.id);
        setReturnTransportQty(returnMeta.quantity ?? 1);
      }
    }
    if (returnMeta?.depart_date) setReturnDate(returnMeta.depart_date);
    if (returnMeta?.seat_pos)    setReturnSeatPos(returnMeta.seat_pos);
    if (returnMeta?.seat_side)   setReturnSeatSide(returnMeta.seat_side);
    if (returnMeta?.note)        setReturnNote(returnMeta.note);

    setInitialized(true);
  }, [booking, hotels, initialized]);

  // ── Computed values ───────────────────────────────────────────────────────

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
        if (sortBy === 'price_asc')  return a.base_price - b.base_price;
        if (sortBy === 'price_desc') return b.base_price - a.base_price;
        if (sortBy === 'stars')      return b.star_rating - a.star_rating;
        return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      });
  }, [hotels, filterStars, filterPrice, filterDist, sortBy]);

  const outboundOpt = useMemo(
    () => allTransport.find(t => t.id === outboundTransportId) ?? null,
    [allTransport, outboundTransportId],
  );
  const returnOpt = useMemo(
    () => allReturnTransport.find(t => t.id === returnTransportId) ?? null,
    [allReturnTransport, returnTransportId],
  );

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

  const nights = (checkInDate && checkOutDate)
    ? Math.max(1, differenceInDays(parseISO(checkOutDate), parseISO(checkInDate)))
    : 1;

  const hotelBase = selectedRoomType
    ? selectedRoomType.price_per_night
    : selectedHotel ? (hotels?.find(h => h.id === selectedHotel)?.base_price ?? 0) : 0;
  const hotelAmount  = hotelBase * nights * hotelRoomsQty;
  const earlyFee     = selectedHotel && earlyCheckIn  ? 150000 : 0;
  const lateFee      = selectedHotel && lateCheckOut  ? 100000 : 0;
  const outboundAmount = (outboundOpt?.price ?? 0) * outboundTransportQty;
  const returnAmount   = (returnOpt?.price   ?? 0) * returnTransportQty;

  const ticketSubtotal = Number(ticketItem?.subtotal ?? 0);
  const platformFee    = Number(booking?.platform_fee ?? Math.round(ticketSubtotal * 0.03));
  const originalTotal  = Number(booking?.total_amount ?? 0);

  const newTotal    = ticketSubtotal + hotelAmount + earlyFee + lateFee + outboundAmount + returnAmount + platformFee;
  const difference  = Math.round(newTotal - originalTotal);

  // ── Modal helpers ─────────────────────────────────────────────────────────

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

  const openHotelQtyModal = (hotelId: number) => {
    setPendingHotelRooms(hotelRoomsQty);
    setHotelQtyModal({ visible: true, hotelId });
  };

  const confirmHotelRooms = () => {
    if (hotelQtyModal.hotelId) {
      setHotelRoomsQty(pendingHotelRooms);
      setRoomSheetHotelId(hotelQtyModal.hotelId);
    }
    setHotelQtyModal({ visible: false, hotelId: null });
  };

  const openTicketQtyModal = (type: 'outbound' | 'return', opt: TransportOption) => {
    setPendingTicketQty(type === 'outbound' ? outboundTransportQty : returnTransportQty);
    setTicketQtyModal({ visible: true, type, opt });
  };

  const confirmTicketQty = () => {
    if (ticketQtyModal.type === 'outbound' && ticketQtyModal.opt) {
      setOutboundTransportId(ticketQtyModal.opt.id);
      setOutboundTransportQty(pendingTicketQty);
      setExpandedOutboundOp(null);
    } else if (ticketQtyModal.type === 'return' && ticketQtyModal.opt) {
      setReturnTransportId(ticketQtyModal.opt.id);
      setReturnTransportQty(pendingTicketQty);
      setExpandedReturnOp(null);
    }
    setTicketQtyModal({ visible: false, type: 'outbound', opt: null });
  };

  const togglePendingStar = (star: number) =>
    setPendingStars(prev => prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]);

  // ── Confirm edits ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await editAddons.mutateAsync({
        bookingNumber: id,
        hotel_id: selectedHotel ?? undefined,
        hotel_meta: selectedHotel ? {
          check_in:            checkInDate,
          check_out:           checkOutDate,
          nights,
          rooms:               hotelRoomsQty,
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
          quantity:         outboundTransportQty,
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
          quantity:         returnTransportQty,
          seat_pos:         returnSeatPos,
          seat_side:        returnSeatSide,
          note:             returnNote || undefined,
        } : undefined,
      });

      // Update local plan cache so booking detail screen rebuilds itinerary
      const selectedHotelObj = hotels?.find(h => h.id === selectedHotel) ?? null;
      const plan = {
        departDate, returnDate, checkInDate, checkOutDate,
        outboundMeta: outboundOpt ? {
          option_id: outboundOpt.id, operator: outboundOpt.operator,
          class: outboundOpt.classBadge, mode: outboundOpt.mode, icon: outboundOpt.icon,
          depart_date: departDate, departure_time: outboundOpt.departureTime,
          arrival_time: outboundOpt.arrivalTime, duration_minutes: outboundOpt.durationMinutes,
          origin_label: outboundOpt.originLabel, dest_label: outboundOpt.destLabel,
          is_overnight: isOvernightTrip(outboundOpt), price: outboundAmount,
          price_per_person: outboundOpt.price, quantity: outboundTransportQty,
          seat_pos: outboundSeatPos, seat_side: outboundSeatSide,
        } : null,
        returnMeta: returnOpt ? {
          option_id: returnOpt.id, operator: returnOpt.operator,
          class: returnOpt.classBadge, mode: returnOpt.mode, icon: returnOpt.icon,
          depart_date: returnDate, departure_time: returnOpt.departureTime,
          arrival_time: returnOpt.arrivalTime, duration_minutes: returnOpt.durationMinutes,
          origin_label: returnOpt.originLabel, dest_label: returnOpt.destLabel,
          is_overnight: isOvernightTrip(returnOpt), price: returnAmount,
          price_per_person: returnOpt.price, quantity: returnTransportQty,
          seat_pos: returnSeatPos, seat_side: returnSeatSide,
        } : null,
        hotelMeta: selectedHotelObj ? {
          check_in: checkInDate, check_out: checkOutDate, nights,
          early_check_in: earlyCheckIn, early_check_in_time: earlyCheckIn ? earlyCheckInTime : null,
          late_check_out: lateCheckOut, late_check_out_time: lateCheckOut ? lateCheckOutTime : null,
        } : null,
        hotel: selectedHotelObj ? {
          name: selectedHotelObj.name,
          star_rating: selectedHotelObj.star_rating,
          address: selectedHotelObj.address ?? '',
        } : null,
      };
      await AsyncStorage.setItem(`booking_plan_${id}`, JSON.stringify(plan));

      const diff = result?.difference ?? 0;

      if (diff <= 0) {
        Alert.alert(
          'Perubahan Tersimpan',
          diff < 0
            ? 'Pilihan kamu diperbarui. Tidak ada tambahan biaya.'
            : 'Pilihan kamu berhasil diperbarui.',
          [{ text: 'Lihat Tiket', onPress: () => router.back() }],
        );
      } else {
        setPendingDifference(diff);
        setPendingNewTotal(result?.new_total ?? newTotal);
        setShowPaymentStep(true);
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pay the difference ────────────────────────────────────────────────────

  const handlePayDifference = async () => {
    if (!selectedPayment) {
      Alert.alert('Pilih Pembayaran', 'Silakan pilih metode pembayaran.');
      return;
    }
    setLoading(true);
    try {
      await paySupplementMutation.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert(
        'Pembayaran Berhasil! 🎉',
        'Perubahan tiket kamu sudah diperbarui.',
        [{ text: 'Lihat Tiket', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memproses pembayaran. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (bookingLoading || !booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (showPaymentStep) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{
          headerShown: true, title: 'Bayar Selisih',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => setShowPaymentStep(false)} hitSlop={16}>
              <Text style={styles.backChevron}>‹</Text>
            </TouchableOpacity>
          ),
        }} />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Difference summary */}
          <View style={styles.diffBanner}>
            <Text style={styles.diffBannerTitle}>Selisih Harga</Text>
            <Text style={styles.diffBannerAmount}>{fmt(pendingDifference)}</Text>
            <Text style={styles.diffBannerSub}>
              Total baru: {fmt(pendingNewTotal)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rincian Perubahan</Text>
            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total sebelumnya</Text>
                <Text style={styles.breakdownVal}>{fmt(originalTotal)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total baru</Text>
                <Text style={styles.breakdownVal}>{fmt(pendingNewTotal)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.totalLabel}>Selisih yang perlu dibayar</Text>
                <Text style={[styles.totalAmount, { color: '#DC2626' }]}>{fmt(pendingDifference)}</Text>
              </View>
            </View>
          </View>

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

          <View style={{ height: 140 }} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerTotalRow}>
            <Text style={styles.footerTotalLabel}>Bayar Selisih</Text>
            <Text style={styles.footerTotalAmount}>{fmt(pendingDifference)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, loading && styles.payBtnDisabled]}
            onPress={handlePayDifference}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.payBtnText}>Bayar Selisih Sekarang</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{
        headerShown: true, title: 'Edit Transportasi & Hotel',
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Event info */}
        {event && (
          <View style={styles.section}>
            <View style={styles.eventCard}>
              <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.eventSub}>
                {format(new Date(event.start_at), 'd MMM yyyy', { locale: idLocale })}
                {venue ? ` · ${venue.name}, ${venue.city}` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Tanggal Perjalanan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tanggal Perjalanan</Text>
          <DateRangePickerField
            startLabel="Berangkat"
            endLabel="Pulang"
            startValue={departDate}
            endValue={returnDate}
            onChangeStart={d => { setDepartDate(d); setOutboundTransportId(null); setOutboundTransportQty(1); setReturnTransportId(null); setReturnTransportQty(1); }}
            onChangeEnd={v => { setReturnDate(v); setReturnTransportId(null); setReturnTransportQty(1); }}
            onReset={() => { setDepartDate(null); setReturnDate(null); setOutboundTransportId(null); setOutboundTransportQty(1); setReturnTransportId(null); setReturnTransportQty(1); }}
            minDate={new Date()}
            startMaxDate={event?.start_at ? parseISO(event.start_at.split('T')[0]) : undefined}
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

        {/* Transportasi Pergi */}
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
                              onPress={() => {
                                if (isSel) { setOutboundTransportId(null); setOutboundTransportQty(1); }
                                else { openTicketQtyModal('outbound', opt); }
                              }}>
                              <View style={styles.classHead}>
                                <View style={styles.classBadgeWrap}>
                                  <Text style={styles.classBadgeTxt}>{serviceName !== opt.classBadge ? `${serviceName} · ` : ''}{opt.classBadge}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={[styles.classPrice, isSel && styles.classPriceActive]}>{fmt(opt.price * (isSel ? outboundTransportQty : 1))}</Text>
                                  {isSel && outboundTransportQty > 1 && <Text style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(opt.price)}/orang</Text>}
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
                                <Text style={styles.travelDate}>🛫 {format(parseISO(departDate), 'd MMM', { locale: idLocale })}</Text>
                                <Text style={styles.travelDateArrow}>——</Text>
                                <Text style={styles.travelDate}>
                                  🛬 {format(arrDate, 'd MMM', { locale: idLocale })}
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

        {/* Transportasi Pulang */}
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
                              onPress={() => {
                                if (isSel) { setReturnTransportId(null); setReturnTransportQty(1); }
                                else { openTicketQtyModal('return', opt); }
                              }}>
                              <View style={styles.classHead}>
                                <View style={styles.classBadgeWrap}>
                                  <Text style={styles.classBadgeTxt}>{serviceName !== opt.classBadge ? `${serviceName} · ` : ''}{opt.classBadge}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={[styles.classPrice, isSel && styles.classPriceActive]}>{fmt(opt.price * (isSel ? returnTransportQty : 1))}</Text>
                                  {isSel && returnTransportQty > 1 && <Text style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(opt.price)}/orang</Text>}
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
                                  <View key="more" style={[styles.facilityChip, isSel && styles.facilityChipActive]}>
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

        {/* Penginapan */}
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

          <DateRangePickerField
            startLabel="Check-in"
            endLabel="Check-out"
            startValue={checkInDate}
            endValue={checkOutDate}
            onChangeStart={setCheckInDate}
            onChangeEnd={setCheckOutDate}
            onReset={() => { setCheckInDate(null); setCheckOutDate(null); }}
            minDate={new Date()}
            startPlaceholder="Pilih tanggal"
            endPlaceholder="Pilih tanggal"
          />
          {checkInDate && checkOutDate && (
            <Text style={styles.nightsLabel}>
              {nights} malam · Check-in 14:00 · Check-out 12:00
            </Text>
          )}

          {displayedHotels.map(hotel => {
            const isSelected = selectedHotel === hotel.id;
            const dist = fmtDist(hotel.distance_km);
            const facilities = hotelFacilities(hotel.star_rating);
            return (
              <TouchableOpacity
                key={hotel.id}
                style={[styles.hotelCard, isSelected && styles.hotelCardActive]}
                onPress={() => {
                  if (isSelected) { setSelectedHotel(null); setSelectedRoomType(null); setRoomSheetHotelId(null); setHotelRoomsQty(1); }
                  else { openHotelQtyModal(hotel.id); }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.hotelTop}>
                  <View style={styles.hotelLeft}>
                    <Text style={styles.hotelIcon}>🏨</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
                      <View style={styles.hotelMeta}>
                        <Text style={styles.starText}>{'⭐'.repeat(hotel.star_rating)}</Text>
                        {dist && (
                          <View style={[styles.distBadge, isSelected && styles.distBadgeActive]}>
                            <Text style={[styles.distText, isSelected && styles.distTextActive]}>📍 {dist}</Text>
                          </View>
                        )}
                      </View>
                      {isSelected && selectedRoomType && (
                        <Text style={styles.roomTypeBadge}>
                          {selectedRoomType.name} · {selectedRoomType.bed_type}
                          {hotelRoomsQty > 1 ? ` · ${hotelRoomsQty} kamar` : ''}
                        </Text>
                      )}
                      {isSelected && !selectedRoomType && hotelRoomsQty > 1 && (
                        <Text style={styles.roomTypeBadge}>{hotelRoomsQty} kamar</Text>
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

          {selectedHotel && (
            <View style={styles.checkInCard}>
              <Text style={styles.checkInTitle}>⏰ Permintaan Waktu</Text>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Early Check-in</Text>
                  <Text style={styles.toggleNote}>*Tergantung ketersediaan · +Rp150.000</Text>
                </View>
                <TouchableOpacity style={[styles.toggle, earlyCheckIn && styles.toggleOn]} onPress={() => setEarlyCheckIn(v => !v)}>
                  <View style={[styles.toggleThumb, earlyCheckIn && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {earlyCheckIn && (
                <View style={styles.timePickerRow}>
                  {EARLY_CHECKIN_TIMES.map(t => (
                    <TouchableOpacity key={t} style={[styles.timePill, earlyCheckInTime === t && styles.timePillActive]} onPress={() => setEarlyCheckInTime(t)}>
                      <Text style={[styles.timePillText, earlyCheckInTime === t && styles.timePillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Late Check-out</Text>
                  <Text style={styles.toggleNote}>*Tergantung ketersediaan · +Rp100.000</Text>
                </View>
                <TouchableOpacity style={[styles.toggle, lateCheckOut && styles.toggleOn]} onPress={() => setLateCheckOut(v => !v)}>
                  <View style={[styles.toggleThumb, lateCheckOut && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              {lateCheckOut && (
                <View style={styles.timePickerRow}>
                  {LATE_CHECKOUT_TIMES.map(t => (
                    <TouchableOpacity key={t} style={[styles.timePill, lateCheckOutTime === t && styles.timePillActive]} onPress={() => setLateCheckOutTime(t)}>
                      <Text style={[styles.timePillText, lateCheckOutTime === t && styles.timePillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <CollapsibleInput label="Permintaan khusus penginapan" value={hotelNote} onChangeText={setHotelNote}
            placeholder="cth: lantai tinggi, extra bed, kamar bebas rokok..." />
        </View>

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.breakdown}>
          {ticketSubtotal > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tiket (tetap)</Text>
              <Text style={styles.breakdownVal}>{fmt(ticketSubtotal)}</Text>
            </View>
          )}
          {(hotelAmount + earlyFee + lateFee) > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Penginapan{checkInDate && checkOutDate ? ` (${nights}m)` : ''}{hotelRoomsQty > 1 ? ` × ${hotelRoomsQty}` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(hotelAmount + earlyFee + lateFee)}</Text>
            </View>
          )}
          {outboundAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Transport Pergi{outboundTransportQty > 1 ? ` × ${outboundTransportQty}` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(outboundAmount)}</Text>
            </View>
          )}
          {returnAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Transport Pulang{returnTransportQty > 1 ? ` × ${returnTransportQty}` : ''}
              </Text>
              <Text style={styles.breakdownVal}>{fmt(returnAmount)}</Text>
            </View>
          )}
          {platformFee > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Biaya Layanan</Text>
              <Text style={styles.breakdownVal}>{fmt(platformFee)}</Text>
            </View>
          )}
        </View>

        {/* Difference indicator */}
        <View style={styles.diffRow}>
          <View>
            <Text style={styles.totalLabel}>Total Baru</Text>
            <Text style={styles.breakdownLabel}>Sebelumnya: {fmt(originalTotal)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalAmount}>{fmt(newTotal)}</Text>
            {difference !== 0 && (
              <View style={[styles.diffChip, difference > 0 ? styles.diffChipPlus : styles.diffChipMinus]}>
                <Text style={[styles.diffChipText, difference > 0 ? styles.diffChipTextPlus : styles.diffChipTextMinus]}>
                  {difference > 0 ? `+${fmt(difference)}` : fmt(difference)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.payBtnText}>
                {difference > 0 ? `Konfirmasi & Bayar ${fmt(difference)}` : 'Konfirmasi Perubahan'}
              </Text>}
        </TouchableOpacity>
      </View>

      {/* Room Type Sheet */}
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
            onSelect={room => { setSelectedHotel(roomSheetHotelId); setSelectedRoomType(room); setRoomSheetHotelId(null); }}
            onClose={() => setRoomSheetHotelId(null)}
          />
        );
      })()}

      {/* Hotel Rooms Qty Modal */}
      {(() => {
        const modalHotel = hotelQtyModal.hotelId ? (hotels ?? []).find(h => h.id === hotelQtyModal.hotelId) ?? null : null;
        const pricePreview = (modalHotel?.base_price ?? 0) * Math.max(nights, 1) * pendingHotelRooms;
        return (
          <Modal visible={hotelQtyModal.visible} transparent animationType="slide"
            onRequestClose={() => setHotelQtyModal({ visible: false, hotelId: null })}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
              onPress={() => setHotelQtyModal({ visible: false, hotelId: null })}>
              <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
                <View style={styles.modalHandle} />
                <View style={styles.tqHeader}>
                  <Text style={styles.tqTitle}>Jumlah Kamar</Text>
                  {modalHotel && <Text style={styles.tqSub}>🏨 {modalHotel.name} · {'⭐'.repeat(modalHotel.star_rating)}</Text>}
                </View>
                <View style={styles.tqQtyRow}>
                  <TouchableOpacity style={[styles.tqBtn, pendingHotelRooms <= 1 && styles.tqBtnDisabled]}
                    onPress={() => setPendingHotelRooms(q => Math.max(1, q - 1))} disabled={pendingHotelRooms <= 1}>
                    <Text style={styles.tqBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.tqQtyBox}>
                    <Text style={styles.tqQtyNum}>{pendingHotelRooms}</Text>
                    <Text style={styles.tqQtyLabel}>kamar</Text>
                  </View>
                  <TouchableOpacity style={styles.tqBtn} onPress={() => setPendingHotelRooms(q => q + 1)}>
                    <Text style={styles.tqBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                {modalHotel && (
                  <View style={styles.tqPriceRow}>
                    <Text style={styles.tqPriceLabel}>Estimasi Total</Text>
                    <Text style={styles.tqPriceVal}>{fmt(pricePreview)}</Text>
                  </View>
                )}
                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.resetBtn} onPress={() => setHotelQtyModal({ visible: false, hotelId: null })} activeOpacity={0.8}>
                    <Text style={styles.resetText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={confirmHotelRooms} activeOpacity={0.85}>
                    <Text style={styles.applyText}>Pilih Kamar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        );
      })()}

      {/* Ticket Qty Modal */}
      <Modal visible={ticketQtyModal.visible} transparent animationType="slide"
        onRequestClose={() => setTicketQtyModal({ visible: false, type: 'outbound', opt: null })}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
          onPress={() => setTicketQtyModal({ visible: false, type: 'outbound', opt: null })}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.tqHeader}>
              <Text style={styles.tqTitle}>Jumlah Tiket</Text>
              {ticketQtyModal.opt && <Text style={styles.tqSub}>{ticketQtyModal.opt.icon} {ticketQtyModal.opt.operator} · {ticketQtyModal.opt.classBadge}</Text>}
            </View>
            {ticketQtyModal.opt && (
              <View style={styles.tqRouteRow}>
                <Text style={styles.tqRouteTime}>{ticketQtyModal.opt.departureTime}</Text>
                <Text style={styles.tqRouteSep}>——›</Text>
                <Text style={styles.tqRouteTime}>{ticketQtyModal.opt.arrivalTime}</Text>
                <Text style={styles.tqRouteDur}>  ({formatDuration(ticketQtyModal.opt.durationMinutes)})</Text>
              </View>
            )}
            <View style={styles.tqQtyRow}>
              <TouchableOpacity style={[styles.tqBtn, pendingTicketQty <= 1 && styles.tqBtnDisabled]}
                onPress={() => setPendingTicketQty(q => Math.max(1, q - 1))} disabled={pendingTicketQty <= 1}>
                <Text style={styles.tqBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.tqQtyBox}>
                <Text style={styles.tqQtyNum}>{pendingTicketQty}</Text>
                <Text style={styles.tqQtyLabel}>tiket</Text>
              </View>
              <TouchableOpacity style={styles.tqBtn} onPress={() => setPendingTicketQty(q => q + 1)}>
                <Text style={styles.tqBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {ticketQtyModal.opt && (
              <View style={styles.tqPriceRow}>
                <Text style={styles.tqPriceLabel}>Total</Text>
                <Text style={styles.tqPriceVal}>{fmt(ticketQtyModal.opt.price * pendingTicketQty)}</Text>
              </View>
            )}
            {ticketQtyModal.opt && pendingTicketQty > 1 && (
              <Text style={styles.tqPricePer}>{fmt(ticketQtyModal.opt.price)}/tiket</Text>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={() => setTicketQtyModal({ visible: false, type: 'outbound', opt: null })} activeOpacity={0.8}>
                <Text style={styles.resetText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={confirmTicketQty} activeOpacity={0.85}>
                <Text style={styles.applyText}>Pilih</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hotel Sort/Filter Modal */}
      <Modal visible={showHotelModal} transparent animationType="slide" onRequestClose={() => setShowHotelModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHotelModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.tabBar}>
              {(['sort', 'filter'] as const).map(tab => (
                <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
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

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8F9FA' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container:   { padding: 20 },
  backChevron: { fontSize: 32, color: BLUE, fontWeight: '300', lineHeight: 36, marginLeft: 4 },

  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  optionalBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  optionalText:  { fontSize: 11, color: BLUE, fontWeight: '700' },

  eventCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 14,
  },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  eventSub:   { fontSize: 12, color: '#6B7280' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 10 },

  nightsLabel: { fontSize: 12, color: '#5B8EF0', fontWeight: '600', marginTop: -2, marginBottom: 10 },
  originRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  originIcon:  { fontSize: 14 },
  originText:  { fontSize: 12, color: '#6B7280' },
  originCity:  { fontWeight: '700', color: '#111827' },

  chipsScroll: { marginBottom: 10 },
  chip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', marginRight: 8 },
  chipActive:  { backgroundColor: BLUE, borderColor: BLUE },
  chipText:    { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  gateCard: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, alignItems: 'center' },
  gateText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  opCard:       { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10, overflow: 'hidden' },
  opCardActive: { borderColor: BLUE },
  opHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  opIcon:       { fontSize: 22 },
  opName:       { fontSize: 14, fontWeight: '700', color: '#111827' },
  opMeta:       { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  opSelBadge:   { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  opSelText:    { fontSize: 11, fontWeight: '700', color: BLUE },
  opChevron:    { fontSize: 11, color: '#9CA3AF', marginLeft: 4 },

  classesWrap:      { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  classCard:        { padding: 14, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  classCardActive:  { backgroundColor: '#EFF6FF' },
  classHead:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  classBadgeWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  classBadgeTxt:    { fontSize: 13, fontWeight: '700', color: '#374151' },
  classPrice:       { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  classPriceActive: { color: BLUE },
  classCheck:       { fontSize: 16, color: BLUE, fontWeight: '800' },

  travelDatesRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  travelDate:      { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  travelDateArrow: { fontSize: 12, color: '#CBD5E1', flex: 1, textAlign: 'center' },

  seatCard:       { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  seatTitle:      { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  seatNote:       { fontSize: 11, color: '#9CA3AF', fontWeight: '400' },
  seatRow:        { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  seatPill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F8FAFD' },
  seatPillActive: { backgroundColor: BLUE, borderColor: BLUE },
  seatPillTxt:        { fontSize: 13, color: '#374151', fontWeight: '600' },
  seatPillTxtActive:  { color: '#FFFFFF' },

  routeRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routePoint:    { flex: 2 },
  routeMiddle:   { flex: 3, alignItems: 'center' },
  routeTime:     { fontSize: 16, fontWeight: '800', color: '#111827' },
  routeTerminal: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  routeDuration: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 3 },
  routeLine:     { height: 1.5, width: '80%', backgroundColor: '#CBD5E1' },
  routeArrow:    { fontSize: 16, color: '#CBD5E1', fontWeight: '700', marginTop: 3 },

  hotelCard:       { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
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
  totalNights: { fontSize: 11, color: BLUE, fontWeight: '700', marginTop: 2 },
  roomTypeBadge: { fontSize: 11, color: BLUE, fontWeight: '600', marginTop: 3 },

  distBadge:       { backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  distBadgeActive: { backgroundColor: 'rgba(29,99,237,0.1)' },
  distText:        { fontSize: 11, color: BLUE, fontWeight: '600' },
  distTextActive:  { color: BLUE },

  facilitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facilityChip:  { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  facilityChipActive: { backgroundColor: 'rgba(29,99,237,0.1)' },
  facilityText:  { fontSize: 11, color: '#475569', fontWeight: '600' },
  facilityTextActive: { color: BLUE },

  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },

  checkInCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
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

  // Sort/filter icon buttons
  iconBtn:          { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive:    { backgroundColor: BLUE },
  iconBtnText:      { fontSize: 16, color: '#6B7280', fontWeight: '700', lineHeight: 20 },
  iconBtnTextActive: { color: '#FFFFFF' },
  filterBadge:      { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 7, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText:  { fontSize: 9, color: '#FFFFFF', fontWeight: '800' },

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

  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel:  { fontSize: 14, color: '#374151', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#111827' },

  diffChip:     { alignSelf: 'flex-end', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  diffChipPlus: { backgroundColor: '#FEE2E2' },
  diffChipMinus:{ backgroundColor: '#D1FAE5' },
  diffChipText: { fontSize: 12, fontWeight: '700' },
  diffChipTextPlus:  { color: '#DC2626' },
  diffChipTextMinus: { color: '#059669' },

  payBtn:         { backgroundColor: BLUE, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // Difference summary banner
  diffBanner: {
    backgroundColor: '#FEF3C7', borderRadius: 14, padding: 20,
    alignItems: 'center', marginBottom: 24,
  },
  diffBannerTitle:  { fontSize: 13, color: '#92400E', fontWeight: '700', marginBottom: 6 },
  diffBannerAmount: { fontSize: 32, fontWeight: '800', color: '#DC2626', marginBottom: 4 },
  diffBannerSub:    { fontSize: 13, color: '#92400E' },

  // Payment method options
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

  footerTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  footerTotalLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  footerTotalAmount:{ fontSize: 22, fontWeight: '800', color: '#DC2626' },

  // Modals
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

  tqHeader:    { paddingHorizontal: 20, paddingBottom: 12 },
  tqTitle:     { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  tqSub:       { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tqRouteRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  tqRouteTime: { fontSize: 16, fontWeight: '800', color: '#111827' },
  tqRouteSep:  { fontSize: 14, color: '#CBD5E1', marginHorizontal: 8 },
  tqRouteDur:  { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  tqQtyRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 },
  tqBtn:       { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: BLUE },
  tqBtnDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  tqBtnText:   { fontSize: 24, color: BLUE, fontWeight: '700', lineHeight: 30 },
  tqQtyBox:    { alignItems: 'center', minWidth: 60 },
  tqQtyNum:    { fontSize: 36, fontWeight: '800', color: '#111827' },
  tqQtyLabel:  { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: -2 },
  tqPriceRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  tqPriceLabel:{ fontSize: 14, color: '#374151', fontWeight: '600' },
  tqPriceVal:  { fontSize: 20, fontWeight: '800', color: BLUE },
  tqPricePer:  { fontSize: 12, color: '#9CA3AF', textAlign: 'right', paddingHorizontal: 20, marginBottom: 8 },
});
