import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO, addDays, isSameDay, isAfter, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBookingDetail } from '../../../hooks/useBooking';

const BLUE  = '#1D63ED';
const GREEN = '#22C55E';

// ─── City highlights for free days ───────────────────────────────────────────

const CITY_HIGHLIGHTS: Record<string, { wisata: string[]; kuliner: string[] }> = {
  Jakarta: {
    wisata:  ['Monas', 'Kota Tua Jakarta', 'Kepulauan Seribu', 'TMII', 'Ancol Dreamland'],
    kuliner: ['Soto Betawi Hj. Rohani (Cikini)', 'Kerak Telor Monas', 'Nasi Uduk Kebon Kacang', 'Bakso Kumis Lapangan Banteng'],
  },
  Yogyakarta: {
    wisata:  ['Malioboro', 'Candi Prambanan', 'Keraton Yogyakarta', 'Gunung Merapi', 'Pantai Parangtritis'],
    kuliner: ['Gudeg Yu Djum (Wijilan)', 'Bakpia Pathuk 25', 'Sate Klathak Pak Pong', 'Angkringan Lik Man'],
  },
  Bandung: {
    wisata:  ['Kawah Putih', 'Tangkuban Perahu', 'Dago Pakar', 'FO Jl. Riau', 'Gedung Sate'],
    kuliner: ['Batagor Riri', 'Nasi Timbel Bale Padang', 'Surabi Enhaii', 'Mie Koclok Cikutra'],
  },
  Solo: {
    wisata:  ['Keraton Surakarta', 'Pasar Klewer', 'Museum Batik Danar Hadi', 'Taman Sriwedari', 'Pura Mangkunegaran'],
    kuliner: ['Nasi Liwet Yu Sri', 'Timlo Solo Bu Rini', 'Sate Buntel Bu Etik', 'Selat Solo Mbak Lies'],
  },
  Surakarta: {
    wisata:  ['Keraton Surakarta', 'Stadion Manahan', 'Museum Batik Danar Hadi', 'Pasar Klewer', 'Pura Mangkunegaran'],
    kuliner: ['Nasi Liwet Yu Sri', 'Timlo Solo Bu Rini', 'Sate Buntel Bu Etik', 'Selat Solo Mbak Lies'],
  },
  Semarang: {
    wisata:  ['Sam Poo Kong', 'Lawang Sewu', 'Kota Lama Semarang', 'Pantai Marina', 'Gereja Blenduk'],
    kuliner: ['Lumpia Gang Lombok', 'Mie Kopyok Pak Dhuwur', 'Tahu Pong Gajahmada', 'Wingko Babat Cik Me Me'],
  },
  Surabaya: {
    wisata:  ['Jembatan Merah', 'Tugu Pahlawan', 'House of Sampoerna', 'Kenjeran Park', 'Kebun Binatang Surabaya'],
    kuliner: ['Rujak Cingur Ibu Fatimah', 'Soto Lamongan Cak Har', 'Rawon Setan', 'Lontong Balap Pak Gendut'],
  },
  Makassar: {
    wisata:  ['Pantai Losari', 'Fort Rotterdam', 'Pulau Samalona', 'Trans Studio Makassar', 'Tanjung Bayang'],
    kuliner: ['Coto Makassar Daeng Sirua', 'Konro Bakar Karebosi', 'Pallubasa Serigala', 'Pisang Epe Pantai Losari'],
  },
  Bali: {
    wisata:  ['Tanah Lot', 'Ubud Monkey Forest', 'Pantai Kuta', 'Tegalalang Rice Terrace', 'Pura Besakih'],
    kuliner: ['Warung Babi Guling Ibu Oka', 'Nasi Jinggo Renon', 'Lawar Babi Bu Mandri', 'Ayam Betutu Men Tempeh'],
  },
  Denpasar: {
    wisata:  ['Pusat Kebudayaan Bali', 'Museum Bali', 'Pasar Badung', 'Taman Budaya Garuda Wisnu Kencana', 'Pantai Sanur'],
    kuliner: ['Warung Babi Guling Ibu Oka', 'Nasi Jinggo Renon', 'Be Tutu Men Tempeh', 'Sate Lilit Bhineka Jaya'],
  },
  Pekalongan: {
    wisata:  ['Museum Batik Pekalongan', 'Kampung Batik Kauman', 'Pantai Pasir Kencana', 'Taman Hayati'],
    kuliner: ['Tauto Pekalongan H. Taufik', 'Mie Kopyok Pak Dhuwur', 'Garang Asem Bu Bari', 'Megono Bu Tur'],
  },
};

function getCityHighlights(city: string) {
  const key = Object.keys(CITY_HIGHLIGHTS).find(k =>
    city.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(city.toLowerCase().split(' ')[0])
  );
  return key ? CITY_HIGHLIGHTS[key] : null;
}

// ─── Booking code helper ──────────────────────────────────────────────────────
// Buat kode unik per layanan dari booking_number
function serviceCode(bookingNumber: string, suffix: 'HTL' | 'OB' | 'RET') {
  return `${bookingNumber}/${suffix}`;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:          { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
  awaiting_payment: { label: 'Menunggu Bayar', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
  confirmed:        { label: 'Dikonfirmasi',   color: '#059669', bg: '#D1FAE5', icon: '✅' },
  completed:        { label: 'Selesai',         color: '#6B7280', bg: '#F3F4F6', icon: '🎉' },
  cancelled:        { label: 'Dibatalkan',      color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  refunded:         { label: 'Direfund',        color: '#7C3AED', bg: '#EDE9FE', icon: '↩️' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

// ─── Itinerary building ───────────────────────────────────────────────────────

interface ItinItem {
  time?: string;
  icon: string;
  title: string;
  subtitle?: string;
  highlight?: boolean;
  isRec?: boolean;
}

interface ItinDay {
  date: string;
  dateLabel: string;
  dayNum: number;
  dayTitle: string;
  items: ItinItem[];
}

function buildItinerary(params: {
  eventTitle: string;
  eventStartAt: string;
  eventEndAt: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  hotel: { name: string; star_rating: number; address: string } | null;
  hotelMeta: Record<string, any> | null;
  outboundMeta: Record<string, any> | null;
  returnMeta: Record<string, any> | null;
}): ItinDay[] {
  const {
    eventTitle, eventStartAt, eventEndAt,
    venueName, venueCity, venueAddress,
    hotel, hotelMeta, outboundMeta, returnMeta,
  } = params;

  const departDate   = outboundMeta?.depart_date ?? null;
  const returnDate   = returnMeta?.depart_date   ?? null;
  const checkInDate  = hotelMeta?.check_in       ?? null;
  const checkOutDate = hotelMeta?.check_out      ?? null;

  // Always show at least the event day — fallback when no travel dates saved
  const eventDateStr0 = eventStartAt ? eventStartAt.split('T')[0] : null;
  if (!departDate && !checkInDate && !eventDateStr0) return [];

  const dStart = departDate   ? parseISO(departDate)
               : checkInDate  ? parseISO(checkInDate)
               : parseISO(eventDateStr0!);

  const dEnd = returnDate    ? parseISO(returnDate)
             : checkOutDate  ? parseISO(checkOutDate)
             : dStart;  // single-day when no range is known

  const eventDateStr = eventDateStr0;
  const eventHour    = eventStartAt ? new Date(eventStartAt).getHours() : 9;
  const eventEndHour = eventEndAt   ? new Date(eventEndAt).getHours()   : Math.min(eventHour + 3, 23);

  const isOvernight = outboundMeta?.is_overnight ?? false;
  const arrivalDay  = isOvernight && departDate ? addDays(parseISO(departDate), 1) : dStart;

  const highlights = getCityHighlights(venueCity);

  const fmtH = (h: number) => `${String(h).padStart(2, '0')}:00`;

  // Resolved early check-in / late check-out times
  const earlyCheckInTime  = hotelMeta?.early_check_in  ? (hotelMeta.early_check_in_time  ?? '11:00') : null;
  const lateCheckOutTime  = hotelMeta?.late_check_out  ? (hotelMeta.late_check_out_time  ?? '14:00') : null;
  const checkInTime  = earlyCheckInTime  ?? '14:00';
  const checkOutTime = lateCheckOutTime  ?? '12:00';

  // True when no travel dates saved — show event day only (legacy bookings)
  const isEventOnlyMode = !departDate && !checkInDate;

  const days: ItinDay[] = [];
  let current = dStart;
  let dayNum  = 0;

  while (!isAfter(current, dEnd)) {
    dayNum++;
    const items: ItinItem[] = [];

    const isDepart   = !isEventOnlyMode && isSameDay(current, dStart);
    const isArrival  = !isEventOnlyMode && isSameDay(current, arrivalDay);
    const isCheckIn  = checkInDate  ? isSameDay(current, parseISO(checkInDate))  : false;
    const isCheckOut = checkOutDate ? isSameDay(current, parseISO(checkOutDate)) : false;
    const isReturn   = !isEventOnlyMode && (returnDate ? isSameDay(current, parseISO(returnDate)) : false);
    const isEvent    = eventDateStr ? isSameDay(current, parseISO(eventDateStr)) : false;

    let dayTitle = `Jelajahi ${venueCity}`;
    if (isDepart && !isArrival)     dayTitle = 'Hari Keberangkatan';
    else if (isDepart && isArrival) dayTitle = `Berangkat & Tiba di ${venueCity}`;
    else if (isArrival && !isDepart) dayTitle = `Tiba di ${venueCity}`;
    if (isEvent)                    dayTitle = 'Hari Event 🎟';
    if (isReturn && !isDepart)      dayTitle = 'Hari Kepulangan';

    // ── Departure day ──
    if (isDepart && outboundMeta) {
      const icon = outboundMeta.icon ?? '🚌';
      items.push({
        time:     outboundMeta.departure_time ?? '',
        icon,
        title:    outboundMeta.operator ?? 'Keberangkatan',
        subtitle: outboundMeta.origin_label,
      });
      if (!isOvernight) {
        items.push({
          time:     outboundMeta.arrival_time ?? '',
          icon:     '📍',
          title:    `Tiba di ${venueCity}`,
          subtitle: outboundMeta.dest_label,
        });
      }
    } else if (isDepart) {
      items.push({ icon: '🚌', title: 'Keberangkatan', subtitle: `Menuju ${venueCity}` });
    }

    // ── Overnight arrival ──
    if (isArrival && !isDepart) {
      if (outboundMeta) {
        items.push({
          time:     outboundMeta.arrival_time ?? '',
          icon:     '📍',
          title:    `Tiba di ${venueCity}`,
          subtitle: outboundMeta.dest_label,
        });
      }
      if (hotel) {
        const via = outboundMeta?.mode === 'plane' ? 'Airport transfer' : 'Taksi / Ojek';
        items.push({
          icon:     '🚕',
          title:    `${via} ke ${hotel.name}`,
          subtitle: outboundMeta?.dest_label,
        });
      }
    } else if (isArrival && isDepart && hotel && !isOvernight) {
      const via = outboundMeta?.mode === 'plane' ? 'Airport transfer' : 'Taksi / Ojek';
      items.push({
        icon:     '🚕',
        title:    `${via} ke ${hotel.name}`,
        subtitle: outboundMeta?.dest_label,
      });
    }

    // ── Check-in ──
    if (isCheckIn && hotel) {
      items.push({
        time:     checkInTime,
        icon:     '🏨',
        title:    `Check-in ${hotel.name}`,
        subtitle: `${'⭐'.repeat(hotel.star_rating)} · ${earlyCheckInTime ? `Early check-in ${earlyCheckInTime}` : 'ab 14:00'}`,
      });
    }

    // ── Event day ──
    if (isEvent) {
      const goHour = Math.max(eventHour - 1, 5);
      items.push({
        time:     fmtH(goHour),
        icon:     '🚕',
        title:    `Menuju ${venueName}`,
        subtitle: hotel ? `Dari ${hotel.name}` : venueCity,
      });
      items.push({
        time:     fmtH(eventHour),
        icon:     '🎟',
        title:    `${eventTitle} dimulai`,
        subtitle: `${venueName}, ${venueCity}`,
        highlight: true,
      });
      items.push({
        time:     fmtH(Math.min(eventEndHour, 23)),
        icon:     '✅',
        title:    'Acara selesai',
        subtitle: venueAddress,
      });
      if (hotel) {
        items.push({ icon: '🚕', title: `Kembali ke ${hotel.name}` });
      }
    }

    // ── Free day — wisata & kuliner recs ──
    const hasActivities = items.length > 0;
    if (!isDepart && !isArrival && !isEvent && !isCheckOut && !isReturn && !hasActivities) {
      if (highlights) {
        const wi = highlights.wisata[dayNum % highlights.wisata.length];
        const ku = highlights.kuliner[dayNum % highlights.kuliner.length];
        items.push({ icon: '🗓', title: 'Waktu bebas', subtitle: 'Jelajahi kota' });
        items.push({ icon: '🗺', title: `Kunjungi ${wi}`, subtitle: venueCity, isRec: true });
        items.push({ icon: '🍽', title: `Kuliner: ${ku}`, subtitle: venueCity, isRec: true });
      } else {
        items.push({ icon: '🌇', title: `Jelajahi ${venueCity}`, subtitle: 'Waktu bebas & istirahat' });
      }
    }

    // Wisata recommendation on arrival day (late afternoon)
    if (isArrival && !isEvent && highlights && items.length < 4) {
      const wi = highlights.wisata[0];
      items.push({
        icon:    '🗺',
        title:   `Jelajahi ${wi}`,
        subtitle: `Rekomendasi wisata di ${venueCity}`,
        isRec:   true,
      });
    }

    // ── Check-out ──
    if (isCheckOut && hotel) {
      // When returning same day, push check-out 1 hour before transport departure
      let effectiveCheckOutTime = checkOutTime;
      if (isReturn && returnMeta?.departure_time && !lateCheckOutTime) {
        const [rh, rm] = (returnMeta.departure_time as string).split(':').map(Number);
        const depMin = rh * 60 + (rm ?? 0) - 60;
        const coH = Math.max(Math.floor(depMin / 60), 6);
        const coM = Math.max(depMin % 60, 0);
        effectiveCheckOutTime = `${String(coH).padStart(2, '0')}:${String(coM).padStart(2, '0')}`;
      }
      items.push({
        time:     effectiveCheckOutTime,
        icon:     '🧳',
        title:    `Check-out ${hotel.name}`,
        subtitle: lateCheckOutTime
          ? `Late check-out ${lateCheckOutTime}`
          : `Batas ${effectiveCheckOutTime}`,
      });
    }

    // ── Return journey ──
    if (isReturn) {
      if (returnMeta) {
        const icon = returnMeta.icon ?? '🚌';
        items.push({
          time:     returnMeta.departure_time ?? '',
          icon,
          title:    `${returnMeta.operator ?? 'Transportasi'} — Perjalanan Pulang`,
          subtitle: returnMeta.origin_label,
        });
        if (returnMeta.arrival_time) {
          const retArrIcon = returnMeta.is_overnight ? '🌙' : '🏠';
          items.push({
            time:     returnMeta.arrival_time,
            icon:     retArrIcon,
            title:    `Tiba di kota asal`,
            subtitle: returnMeta.dest_label,
          });
        }
      } else {
        items.push({ icon: '🏠', title: 'Perjalanan Pulang' });
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: booking, isLoading, error } = useBookingDetail(id);

  // Local plan saved by checkout — used as fallback when server metadata is absent
  const [localPlan, setLocalPlan] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`booking_plan_${id}`).then(raw => {
      if (raw) setLocalPlan(JSON.parse(raw));
    }).catch(() => {});
  }, [id]);

  const items: any[] = booking?.booking_items ?? [];
  const ticketItem    = items.find((i: any) => i.item_type === 'ticket');
  const hotelItem     = items.find((i: any) => i.item_type === 'accommodation');
  const outboundItem  = items.find((i: any) => i.item_type === 'outbound_transport');
  const returnItem    = items.find((i: any) => i.item_type === 'return_transport');
  const legacyTransportItem = items.find((i: any) => i.item_type === 'transport');

  const event = ticketItem?.ticket_tiers?.events;
  const venue = event?.venues;
  const issuedTickets: any[] = ticketItem?.tickets ?? [];

  // Prefer server metadata; fall back to locally saved plan
  const hotelMeta    = hotelItem?.metadata    ?? localPlan?.hotelMeta    ?? null;
  const outboundMeta = outboundItem?.metadata ?? localPlan?.outboundMeta ?? null;
  const returnMeta   = returnItem?.metadata   ?? localPlan?.returnMeta   ?? null;

  // Hotel object: from DB join, or from locally saved plan
  const hotelObj = hotelItem?.accommodations
    ? {
        name:        hotelItem.accommodations.name,
        star_rating: hotelItem.accommodations.star_rating ?? 3,
        address:     hotelItem.accommodations.address ?? '',
      }
    : localPlan?.hotel ?? null;

  const itineraryDays = useMemo((): ItinDay[] => {
    if (!event) return [];
    return buildItinerary({
      eventTitle:   event.title,
      eventStartAt: event.start_at,
      eventEndAt:   event.end_at ?? '',
      venueName:    venue?.name    ?? '',
      venueCity:    venue?.city    ?? '',
      venueAddress: venue?.address ?? '',
      hotel:        hotelObj,
      hotelMeta,
      outboundMeta,
      returnMeta,
    });
  }, [event, venue, hotelObj, hotelMeta, outboundMeta, returnMeta, localPlan]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Booking tidak ditemukan</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBackBtn}>
            <Text style={styles.errorBackBtnText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  // Hotel nights display
  const hotelNights = hotelMeta?.nights
    ?? (hotelMeta?.check_in && hotelMeta?.check_out
      ? Math.max(1, differenceInDays(parseISO(hotelMeta.check_out), parseISO(hotelMeta.check_in)))
      : null);

  // Hotel room quantity display
  const hotelRoomQty = Math.max(1, hotelMeta?.room_qty)

  // ── Subtotal computations ─────────────────────────────────────────────────
  const lp = localPlan?.subtotals ?? null;

  const ticketSubtotal = ticketItem?.subtotal ?? lp?.ticket ?? 0;

  const hotelSubtotal = (() => {
    if (lp?.hotel) return lp.hotel;
    const unitPrice = hotelItem?.unit_price;
    if (!unitPrice) return hotelItem?.subtotal ?? 0;
    const nights = hotelMeta?.nights
      ?? (hotelMeta?.check_in && hotelMeta?.check_out
          ? Math.max(1, differenceInDays(parseISO(hotelMeta.check_out), parseISO(hotelMeta.check_in)))
          : null)
      ?? (hotelItem?.quantity && hotelItem.quantity > 1 ? hotelItem.quantity : null);
    if (nights || hotelRoomQty) return unitPrice * Math.max(1, nights) * Math.max(1, hotelRoomQty) + (hotelMeta?.extra_fees ?? 0);
    return hotelItem?.subtotal ?? 0;
  })();

  const outboundSubtotal   = outboundItem?.subtotal ?? lp?.outbound ?? outboundMeta?.price ?? 0;
  const returnSubtotal     = returnItem?.subtotal   ?? lp?.return   ?? returnMeta?.price   ?? 0;
  const hasNewTransport    = outboundItem || returnItem || outboundSubtotal > 0 || returnSubtotal > 0;
  const legacyTransport    = (!hasNewTransport && legacyTransportItem) ? (legacyTransportItem.subtotal ?? 0) : 0;

  const platformFee = booking.platform_fee ?? Math.round(ticketSubtotal * 0.03);

  const displayTotal =
    (ticketSubtotal + hotelSubtotal + outboundSubtotal + returnSubtotal + legacyTransport + platformFee)
    || (booking.total_amount ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Tiket</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: status.bg }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: status.color }]}>
            <Text style={styles.statusIconText}>{status.icon}</Text>
          </View>
          <View>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            <Text style={styles.bookingNum}>#{booking.booking_number}</Text>
          </View>
        </View>

        {/* Event Info */}
        {event ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event</Text>
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📅</Text>
                <Text style={styles.infoText}>
                  {format(new Date(event.start_at), 'EEEE, d MMMM yyyy · HH:mm', { locale: idLocale })}
                </Text>
              </View>
              {venue && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <Text style={styles.infoText}>{venue.name}, {venue.city}</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* ── Itinerary ── */}
        {itineraryDays.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Itinerary Perjalanan</Text>
              <View style={styles.autoBadge}><Text style={styles.autoBadgeText}>Otomatis</Text></View>
            </View>

            {itineraryDays.map(day => (
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

                {/* Timeline */}
                {day.items.map((item, ii) => (
                  <View key={ii} style={styles.itinRow}>
                    <View style={styles.itinLeft}>
                      <Text style={styles.itinTime}>{item.time ?? ''}</Text>
                      {ii < day.items.length - 1 && <View style={styles.itinLine} />}
                    </View>
                    <View style={[
                      styles.itinDot,
                      item.highlight && styles.itinDotHighlight,
                      item.isRec     && styles.itinDotRec,
                    ]} />
                    <View style={[
                      styles.itinContent,
                      item.highlight && styles.itinContentHighlight,
                      item.isRec     && styles.itinContentRec,
                    ]}>
                      <View style={styles.itinIconTitle}>
                        <Text style={styles.itinIcon}>{item.icon}</Text>
                        <Text style={[
                          styles.itinTitle,
                          item.highlight && styles.itinTitleHighlight,
                          item.isRec     && styles.itinTitleRec,
                        ]} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>
                      {item.subtitle ? (
                        <Text style={styles.itinSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Tiket */}
        {ticketItem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiket</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.itemLabel}>{ticketItem.ticket_tiers?.name ?? 'Tiket'}</Text>
                <Text style={styles.itemQty}>× {ticketItem.quantity}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.itemSubLabel}>Harga per tiket</Text>
                <Text style={styles.itemValue}>{fmt(ticketItem.unit_price ?? 0)}</Text>
              </View>
              <View style={[styles.row, styles.subtotalRow]}>
                <Text style={styles.subtotalLabel}>Subtotal Tiket</Text>
                <Text style={styles.subtotalValue}>{fmt(ticketSubtotal)}</Text>
              </View>

              {/* E-Tickets */}
              {issuedTickets.length > 0 && (
                <View style={styles.qrSection}>
                  <View style={styles.divider} />
                  <Text style={styles.qrTitle}>E-Tiket</Text>
                  {issuedTickets.map((t: any, idx: number) => (
                    <View key={t.id} style={styles.eticketCard}>
                      <View style={styles.eticketHeader}>
                        <Text style={styles.eticketNum}>Tiket #{idx + 1}</Text>
                        <View style={[styles.ticketStatusBadge,
                          { backgroundColor: t.status === 'issued' ? '#D1FAE5' : '#F3F4F6' }]}>
                          <Text style={[styles.ticketStatusText,
                            { color: t.status === 'issued' ? '#059669' : '#6B7280' }]}>
                            {t.status === 'issued' ? '✓ Aktif' : t.status}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.qrWrap}>
                        <QRCode
                          value={t.qr_code}
                          size={180}
                          color="#111827"
                          backgroundColor="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.qrCodeText}>{t.qr_code}</Text>
                      <Text style={styles.qrHint}>Tunjukkan kode ini di pintu masuk</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Penginapan */}
        {hotelItem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Penginapan</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.infoIcon}>🏨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{hotelItem.accommodations?.name ?? hotelMeta?.name ?? 'Hotel'}</Text>
                  {hotelItem.accommodations?.star_rating ? (
                    <Text style={styles.itemSubLabel}>
                      {'⭐'.repeat(hotelItem.accommodations.star_rating)} · {hotelItem.accommodations.city}
                    </Text>
                  ) : null}
                </View>
              </View>
              {hotelMeta?.check_in && hotelMeta?.check_out && (
                <View style={styles.row}>
                  <Text style={styles.itemSubLabel}>
                    Check-in {format(parseISO(hotelMeta.check_in), 'd MMM', { locale: idLocale })}
                    {' → '}
                    Check-out {format(parseISO(hotelMeta.check_out), 'd MMM', { locale: idLocale })}
                    {hotelNights ? ` · ${hotelNights} malam` : ''}
                  </Text>
                </View>
              )}
              {(hotelMeta?.early_check_in || hotelMeta?.late_check_out) && (
                <View style={styles.addonRow}>
                  {hotelMeta.early_check_in && (
                    <View style={styles.addonChip}>
                      <Text style={styles.addonChipText}>⏰ Early check-in {hotelMeta.early_check_in_time}</Text>
                    </View>
                  )}
                  {hotelMeta.late_check_out && (
                    <View style={styles.addonChip}>
                      <Text style={styles.addonChipText}>🌙 Late check-out {hotelMeta.late_check_out_time}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.codeRow}>
                <Text style={styles.codeLabel}>Kode Booking</Text>
                <Text style={styles.codeValue}>{serviceCode(booking.booking_number, 'HTL')}</Text>
              </View>
              <View style={[styles.row, styles.subtotalRow]}>
                <Text style={styles.subtotalLabel}>Subtotal Penginapan</Text>
                <Text style={styles.subtotalValue}>{fmt(hotelSubtotal)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Transportasi */}
        {(outboundItem || returnItem || legacyTransportItem || outboundMeta || returnMeta) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transportasi</Text>

            {(outboundItem || outboundMeta) && (
              <View style={[styles.card, { marginBottom: 8 }]}>
                <View style={styles.transportHeader}>
                  <Text style={styles.transportIconLg}>{outboundMeta?.icon ?? '🚌'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transportDir}>Pergi</Text>
                    <Text style={styles.itemLabel} numberOfLines={1}>{outboundMeta?.operator ?? 'Transportasi'}</Text>
                    <Text style={styles.itemSubLabel}>{outboundMeta?.class ?? ''}</Text>
                  </View>
                  <Text style={styles.transportPrice}>{fmt(outboundSubtotal)}</Text>
                </View>
                {outboundMeta?.depart_date && (
                  <View style={styles.routeRow}>
                    <View style={styles.routePoint}>
                      <Text style={styles.routeTime}>{outboundMeta.departure_time ?? ''}</Text>
                      <Text style={styles.routeTerminal} numberOfLines={1}>{outboundMeta.origin_label ?? ''}</Text>
                      <Text style={styles.routeDate}>{format(parseISO(outboundMeta.depart_date), 'd MMM', { locale: idLocale })}</Text>
                    </View>
                    <View style={styles.routeMiddle}>
                      <View style={styles.routeLine} />
                      <Text style={styles.routeArrow}>›</Text>
                    </View>
                    <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
                      <Text style={styles.routeTime}>{outboundMeta.arrival_time ?? ''}</Text>
                      <Text style={styles.routeTerminal} numberOfLines={1}>{outboundMeta.dest_label ?? ''}</Text>
                      {outboundMeta.is_overnight && (
                        <Text style={styles.routeDate}>+1 hari</Text>
                      )}
                    </View>
                  </View>
                )}
                {(outboundMeta?.seat_pos || outboundMeta?.seat_side) && (
                  <Text style={styles.seatPref}>🪑 {outboundMeta.seat_pos} · {outboundMeta.seat_side}</Text>
                )}
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>Kode Booking</Text>
                  <Text style={styles.codeValue}>{serviceCode(booking.booking_number, 'OB')}</Text>
                </View>
              </View>
            )}

            {(returnItem || returnMeta) && (
              <View style={styles.card}>
                <View style={styles.transportHeader}>
                  <Text style={styles.transportIconLg}>{returnMeta?.icon ?? '🚌'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transportDir}>Pulang</Text>
                    <Text style={styles.itemLabel} numberOfLines={1}>{returnMeta?.operator ?? 'Transportasi'}</Text>
                    <Text style={styles.itemSubLabel}>{returnMeta?.class ?? ''}</Text>
                  </View>
                  <Text style={styles.transportPrice}>{fmt(returnSubtotal)}</Text>
                </View>
                {returnMeta?.depart_date && (
                  <View style={styles.routeRow}>
                    <View style={styles.routePoint}>
                      <Text style={styles.routeTime}>{returnMeta.departure_time ?? ''}</Text>
                      <Text style={styles.routeTerminal} numberOfLines={1}>{returnMeta.origin_label ?? ''}</Text>
                      <Text style={styles.routeDate}>{format(parseISO(returnMeta.depart_date), 'd MMM', { locale: idLocale })}</Text>
                    </View>
                    <View style={styles.routeMiddle}>
                      <View style={styles.routeLine} />
                      <Text style={styles.routeArrow}>›</Text>
                    </View>
                    <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
                      <Text style={styles.routeTime}>{returnMeta.arrival_time ?? ''}</Text>
                      <Text style={styles.routeTerminal} numberOfLines={1}>{returnMeta.dest_label ?? ''}</Text>
                      {returnMeta.is_overnight && (
                        <Text style={styles.routeDate}>+1 hari</Text>
                      )}
                    </View>
                  </View>
                )}
                {(returnMeta?.seat_pos || returnMeta?.seat_side) && (
                  <Text style={styles.seatPref}>🪑 {returnMeta.seat_pos} · {returnMeta.seat_side}</Text>
                )}
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>Kode Booking</Text>
                  <Text style={styles.codeValue}>{serviceCode(booking.booking_number, 'RET')}</Text>
                </View>
              </View>
            )}

            {legacyTransportItem && !outboundItem && !outboundMeta && (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.infoIcon}>🚌</Text>
                  <Text style={styles.itemLabel}>Transportasi</Text>
                </View>
                <View style={[styles.row, styles.subtotalRow]}>
                  <Text style={styles.subtotalLabel}>Subtotal Transportasi</Text>
                  <Text style={styles.subtotalValue}>{fmt(legacyTransport)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Ringkasan Pembayaran */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pembayaran</Text>
          <View style={styles.card}>
            {ticketSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tiket</Text>
                <Text style={styles.breakdownVal}>{fmt(ticketSubtotal)}</Text>
              </View>
            )}
            {hotelSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Penginapan {hotelRoomQty} kamar{hotelNights ? ` (${hotelNights} malam)` : ''}
                </Text>
                <Text style={styles.breakdownVal}>{fmt(hotelSubtotal)}</Text>
              </View>
            )}
            {outboundSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transport Pergi ({outboundMeta?.class})</Text>
                <Text style={styles.breakdownVal}>{fmt(outboundSubtotal)}</Text>
              </View>
            )}
            {returnSubtotal > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transport Pulang ({returnMeta?.class})</Text>
                <Text style={styles.breakdownVal}>{fmt(returnSubtotal)}</Text>
              </View>
            )}
            {legacyTransport > 0 && !outboundItem && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transportasi</Text>
                <Text style={styles.breakdownVal}>{fmt(legacyTransport)}</Text>
              </View>
            )}
            {(hotelMeta?.early_check_in || hotelMeta?.late_check_out) && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {[
                    hotelMeta.early_check_in && `Early check-in`,
                    hotelMeta.late_check_out && `Late check-out`,
                  ].filter(Boolean).join(' + ')}
                </Text>
                <Text style={styles.breakdownVal}>
                  {fmt(
                    hotelMeta.extra_fees ??
                    ((hotelMeta.early_check_in ? 150000 : 0) + (hotelMeta.late_check_out ? 100000 : 0))
                  )}
                </Text>
              </View>
            )}
            {platformFee > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Biaya Layanan (inkl. pajak)</Text>
                <Text style={styles.breakdownVal}>{fmt(platformFee)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>Total Dibayar</Text>
              <Text style={styles.totalAmount}>{fmt(displayTotal)}</Text>
            </View>
            {booking.paid_at && (
              <Text style={styles.paidAt}>
                Dibayar pada {format(new Date(booking.paid_at), 'd MMM yyyy, HH:mm', { locale: idLocale })}
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText:       { fontSize: 16, color: '#6B7280', marginBottom: 16 },
  errorBackBtn:    { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: BLUE, borderRadius: 10 },
  errorBackBtnText: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn:     { width: 44, alignItems: 'center', justifyContent: 'center' },
  backText:    { fontSize: 36, color: BLUE, fontWeight: '300', lineHeight: 40 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  container:  { padding: 16 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  statusIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  statusIconText: { fontSize: 22 },
  statusLabel:    { fontSize: 15, fontWeight: '700' },
  bookingNum:     { fontSize: 12, color: '#6B7280', marginTop: 2 },

  section:      { marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  autoBadge:    { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 8 },
  autoBadgeText: { fontSize: 11, color: BLUE, fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, gap: 10,
  },

  eventTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoIcon:   { fontSize: 14, marginTop: 1 },
  infoText:   { fontSize: 13, color: '#374151', flex: 1, lineHeight: 19 },

  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemLabel:    { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  itemQty:      { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  itemSubLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemValue:    { fontSize: 13, color: '#374151', fontWeight: '500' },
  subtotalRow:  { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 2 },
  subtotalLabel: { fontSize: 13, color: '#6B7280' },
  subtotalValue: { fontSize: 13, fontWeight: '700', color: '#111827' },

  addonRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  addonChip:    { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  addonChipText: { fontSize: 11, color: BLUE, fontWeight: '600' },

  // Transport card
  transportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  transportIconLg: { fontSize: 26, marginTop: 2 },
  transportDir:    { fontSize: 11, fontWeight: '700', color: BLUE, textTransform: 'uppercase', marginBottom: 1 },
  transportPrice:  { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 4 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  routePoint:  { flex: 2 },
  routeMiddle: { flex: 3, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  routeLine:   { height: 1.5, flex: 1, backgroundColor: '#CBD5E1' },
  routeArrow:  { fontSize: 16, color: '#CBD5E1', fontWeight: '700', marginLeft: 4 },
  routeTime:   { fontSize: 15, fontWeight: '800', color: '#111827' },
  routeTerminal: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  routeDate:   { fontSize: 11, color: BLUE, fontWeight: '600', marginTop: 2 },
  seatPref:    { fontSize: 11, color: '#6B7280', marginTop: 4 },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  qrSection: { gap: 12 },
  qrTitle:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  eticketCard: {
    backgroundColor: '#F8FAFD', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  eticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  eticketNum:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  qrWrap: {
    padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  qrCodeText: { fontSize: 11, color: '#6B7280', fontFamily: 'monospace', letterSpacing: 1 },
  qrHint:     { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  qrBox:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrPlaceholder: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#DBEAFE',
  },
  qrEmoji:   { fontSize: 24 },
  qrLabel:   { fontSize: 13, fontWeight: '600', color: '#111827' },
  qrCode:    { fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 },
  ticketStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  ticketStatusText:  { fontSize: 11, fontWeight: '700' },

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
  itinDotRec:       { backgroundColor: GREEN, width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itinContent:  { flex: 1, paddingBottom: 12 },
  itinContentHighlight: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
  },
  itinContentRec: {
    backgroundColor: '#F0FDF4', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
  },
  itinIconTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itinIcon:      { fontSize: 14 },
  itinTitle:     { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  itinTitleHighlight: { color: BLUE, fontWeight: '700' },
  itinTitleRec:       { color: '#16A34A', fontWeight: '600' },
  itinSubtitle:  { fontSize: 11, color: '#9CA3AF', marginTop: 2, marginLeft: 20 },

  breakdownRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, color: '#6B7280' },
  breakdownVal:   { fontSize: 13, color: '#374151', fontWeight: '500' },
  totalLabel:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalAmount:    { fontSize: 18, fontWeight: '800', color: BLUE },
  paidAt:         { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },

  codeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  codeLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  codeValue: { fontSize: 12, color: BLUE, fontWeight: '800', letterSpacing: 0.8, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
});
