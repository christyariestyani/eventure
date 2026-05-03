export type TransportMode = 'bus' | 'train' | 'plane' | 'shuttle';

export interface TransportOption {
  id: string;
  mode: TransportMode;
  icon: string;
  operator: string;
  classBadge: string;
  originLabel: string;   // e.g. "Terminal Tirtonadi"
  destLabel: string;     // e.g. "Terminal Giwangan"
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  facilities: string[];
  price: number;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
}

export function isOvernightTrip(opt: TransportOption): boolean {
  return opt.arrivalTime.localeCompare(opt.departureTime) < 0;
}

export interface OperatorGroup {
  key: string;
  mode: TransportMode;
  icon: string;
  baseOperator: string;
  options: TransportOption[];
  minPrice: number;
}

function extractBase(operator: string): string {
  return operator.split(' — ')[0].split(' - ')[0].trim();
}

export function groupByOperator(options: TransportOption[]): OperatorGroup[] {
  const map = new Map<string, OperatorGroup>();
  for (const opt of options) {
    const base = extractBase(opt.operator);
    const key  = `${opt.mode}__${base}`;
    if (!map.has(key)) {
      map.set(key, { key, mode: opt.mode, icon: opt.icon, baseOperator: base, options: [], minPrice: Infinity });
    }
    const g = map.get(key)!;
    g.options.push(opt);
    g.minPrice = Math.min(g.minPrice, opt.price);
  }
  return Array.from(map.values());
}

export function optionServiceLabel(opt: TransportOption): string {
  const parts = opt.operator.split(' — ');
  return parts.length > 1 ? parts.slice(1).join(' — ') : opt.classBadge;
}

export const MODE_LABEL: Record<TransportMode, string> = {
  bus: 'Bus',
  train: 'Kereta',
  plane: 'Pesawat',
  shuttle: 'Travel/Shuttle',
};

// Normalize city aliases (DB uses "Surakarta" for Solo, "Denpasar" for Bali, etc.)
function normalizeCity(city: string): string {
  const aliases: Record<string, string> = {
    surakarta: 'solo',
    denpasar:  'bali',
    'kota surakarta': 'solo',
    'kota denpasar':  'bali',
  };
  return aliases[city.toLowerCase()] ?? city.toLowerCase();
}

// Terminal name helpers per city
function busTerminal(city: string): string {
  const map: Record<string, string> = {
    jakarta:    'Terminal Lebak Bulus',
    bekasi:     'Terminal Bekasi',
    bandung:    'Terminal Leuwipanjang',
    yogyakarta: 'Terminal Giwangan',
    semarang:   'Terminal Terboyo',
    surabaya:   'Terminal Bungurasih',
    solo:       'Terminal Tirtonadi',
    malang:     'Terminal Arjosari',
    makassar:   'Terminal Daya',
    bali:       'Terminal Mengwi',
    pekalongan: 'Terminal Wiradesa',
  };
  return map[normalizeCity(city)] ?? `Terminal ${city}`;
}

function trainStation(city: string): string {
  const map: Record<string, string> = {
    jakarta:    'Stasiun Gambir',
    bekasi:     'Stasiun Bekasi',
    bandung:    'Stasiun Bandung',
    yogyakarta: 'Stasiun Tugu',
    semarang:   'Stasiun Tawang',
    surabaya:   'Stasiun Gubeng',
    solo:       'Stasiun Balapan',
    malang:     'Stasiun Malang',
    pekalongan: 'Stasiun Pekalongan',
  };
  return map[normalizeCity(city)] ?? `Stasiun ${city}`;
}

function airport(city: string): string {
  const map: Record<string, string> = {
    jakarta:    'Soekarno-Hatta (CGK)',
    bekasi:     'Soekarno-Hatta (CGK)',
    bandung:    'Husein Sastranegara (BDO)',
    yogyakarta: 'YIA Kulon Progo (YIA)',
    semarang:   'Ahmad Yani (SRG)',
    surabaya:   'Juanda (SUB)',
    solo:       'Adisumarmo (SOC)',
    malang:     'Abdul Rachman Saleh (MLG)',
    makassar:   'Sultan Hasanuddin (UPG)',
    bali:       'Ngurah Rai (DPS)',
  };
  return map[normalizeCity(city)] ?? `Bandara ${city}`;
}

function poolLocation(city: string): string {
  const map: Record<string, string> = {
    jakarta:    'Pool Jakarta Selatan',
    bekasi:     'Pool Bekasi',
    bandung:    'Pool Bandung Kota',
    yogyakarta: 'Pool Yogyakarta Kota',
    semarang:   'Pool Semarang',
    surabaya:   'Pool Surabaya',
    makassar:   'Pool Makassar',
    solo:       'Pool Solo Kota',
    bali:       'Pool Denpasar',
  };
  return map[normalizeCity(city)] ?? `Pool ${city}`;
}

// Build transport options dynamically based on from/to city
export function getTransportOptions(fromCity: string, toCity: string): TransportOption[] {
  const from = fromCity || 'Jakarta';
  const to = toCity || 'Jakarta';
  const isSameCity = from.toLowerCase() === to.toLowerCase();

  if (isSameCity) {
    return [
      {
        id: 'local-taxi',
        mode: 'shuttle',
        icon: '🚕',
        operator: 'Grab / Gojek',
        classBadge: 'Reguler',
        originLabel: `Lokasi kamu di ${from}`,
        destLabel: `Area venue, ${to}`,
        departureTime: '09:00',
        arrivalTime: '10:00',
        durationMinutes: 45,
        facilities: ['AC', 'Door-to-door', 'Aman'],
        price: 50000,
      },
      {
        id: 'local-commuter',
        mode: 'shuttle',
        icon: '🚆',
        operator: 'KRL Commuter Line',
        classBadge: 'Ekonomi AC',
        originLabel: `Stasiun terdekat, ${from}`,
        destLabel: `Stasiun terdekat venue, ${to}`,
        departureTime: '08:30',
        arrivalTime: '09:15',
        durationMinutes: 45,
        facilities: ['AC', 'On-time', 'Aman'],
        price: 15000,
      },
    ];
  }

  return [
    // ─── BUS ────────────────────────────────────────────────────────────────
    {
      id: 'bus-rosalia-ek',
      mode: 'bus',
      icon: '🚌',
      operator: 'PO Rosalia Indah',
      classBadge: 'Eksekutif',
      originLabel: busTerminal(from),
      destLabel: busTerminal(to),
      departureTime: '19:00',
      arrivalTime: '04:30',
      durationMinutes: 570,
      facilities: ['AC', 'Reclining Seat', 'Toilet', 'USB Charger', 'Selimut'],
      price: 150000,
    },
    {
      id: 'bus-rosalia-sl',
      mode: 'bus',
      icon: '🚌',
      operator: 'PO Rosalia Indah',
      classBadge: 'Sleeper',
      originLabel: busTerminal(from),
      destLabel: busTerminal(to),
      departureTime: '20:00',
      arrivalTime: '05:30',
      durationMinutes: 570,
      facilities: ['AC', 'Full Flat Seat', 'Toilet', 'Makan', 'USB Charger', 'Selimut'],
      price: 280000,
    },
    {
      id: 'bus-pahala-ek',
      mode: 'bus',
      icon: '🚌',
      operator: 'PO Pahala Kencana',
      classBadge: 'Eksekutif',
      originLabel: busTerminal(from),
      destLabel: busTerminal(to),
      departureTime: '18:30',
      arrivalTime: '04:00',
      durationMinutes: 570,
      facilities: ['AC', 'Reclining Seat', 'Toilet', 'WiFi', 'USB Charger'],
      price: 175000,
    },
    // ─── TRAIN ──────────────────────────────────────────────────────────────
    {
      id: 'train-argo-ek',
      mode: 'train',
      icon: '🚂',
      operator: 'KAI — Argo Lawu',
      classBadge: 'Eksekutif',
      originLabel: trainStation(from),
      destLabel: trainStation(to),
      departureTime: '08:00',
      arrivalTime: '15:30',
      durationMinutes: 450,
      facilities: ['AC', 'Kursi Reclining', 'Stop Kontak', 'Restorasi', 'Bagasi 20kg'],
      price: 450000,
    },
    {
      id: 'train-argo-lux',
      mode: 'train',
      icon: '🚂',
      operator: 'KAI — Argo Semeru Priority',
      classBadge: 'Luxury',
      originLabel: trainStation(from),
      destLabel: trainStation(to),
      departureTime: '09:00',
      arrivalTime: '16:30',
      durationMinutes: 450,
      facilities: ['AC', 'Kursi Lux', 'Makan Gratis', 'Stop Kontak', 'WiFi', 'Bagasi 20kg'],
      price: 750000,
    },
    {
      id: 'train-gajah-bis',
      mode: 'train',
      icon: '🚂',
      operator: 'KAI — Gajah Wong',
      classBadge: 'Bisnis',
      originLabel: trainStation(from),
      destLabel: trainStation(to),
      departureTime: '17:00',
      arrivalTime: '00:30',
      durationMinutes: 450,
      facilities: ['AC', 'Kursi Tegak', 'Stop Kontak', 'Bagasi 20kg'],
      price: 225000,
    },
    // ─── PLANE ──────────────────────────────────────────────────────────────
    {
      id: 'plane-garuda-eco',
      mode: 'plane',
      icon: '✈️',
      operator: 'Garuda Indonesia',
      classBadge: 'Economy',
      originLabel: airport(from),
      destLabel: airport(to),
      departureTime: '06:00',
      arrivalTime: '07:10',
      durationMinutes: 70,
      facilities: ['Bagasi 20kg', 'Makan', 'Hiburan', 'Check-in Online'],
      price: 750000,
    },
    {
      id: 'plane-lion-eco',
      mode: 'plane',
      icon: '✈️',
      operator: 'Lion Air',
      classBadge: 'Economy',
      originLabel: airport(from),
      destLabel: airport(to),
      departureTime: '07:30',
      arrivalTime: '08:40',
      durationMinutes: 70,
      facilities: ['Bagasi 20kg', 'Check-in Online'],
      price: 480000,
    },
    {
      id: 'plane-batik-biz',
      mode: 'plane',
      icon: '✈️',
      operator: 'Batik Air',
      classBadge: 'Business',
      originLabel: airport(from),
      destLabel: airport(to),
      departureTime: '10:00',
      arrivalTime: '11:10',
      durationMinutes: 70,
      facilities: ['Bagasi 30kg', 'Makan Premium', 'Priority Boarding', 'Lounge'],
      price: 1400000,
    },
    // ─── SHUTTLE ────────────────────────────────────────────────────────────
    {
      id: 'shuttle-cipaganti',
      mode: 'shuttle',
      icon: '🚐',
      operator: 'Cipaganti Travel',
      classBadge: 'Door-to-door',
      originLabel: poolLocation(from),
      destLabel: poolLocation(to),
      departureTime: '07:00',
      arrivalTime: '15:00',
      durationMinutes: 480,
      facilities: ['AC', 'Door-to-door', 'Maks 8 penumpang', 'USB Charger'],
      price: 350000,
    },
    {
      id: 'shuttle-xtrans',
      mode: 'shuttle',
      icon: '🚐',
      operator: 'X-Trans',
      classBadge: 'Reguler',
      originLabel: poolLocation(from),
      destLabel: poolLocation(to),
      departureTime: '08:00',
      arrivalTime: '14:00',
      durationMinutes: 360,
      facilities: ['AC', 'Penjemputan area tertentu', 'USB Charger'],
      price: 220000,
    },
  ];
}
