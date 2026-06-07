import { supabase } from '../../lib/db';
import { PreferencesService } from '../preferences/preferences.service';

const prefSvc = new PreferencesService();

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough transport price estimate based on city distance
function estimateTransport(city: string, homeCity: string | null): number {
  if (!homeCity || city === homeCity) return 0;
  // Inter-city flat estimates (IDR) — replace with real API in production
  const INTERCITY: Record<string, number> = {
    'Jakarta-Bandung':   250_000,
    'Bandung-Jakarta':   250_000,
    'Jakarta-Yogyakarta': 400_000,
    'Yogyakarta-Jakarta': 400_000,
    'Jakarta-Surabaya':  500_000,
    'Surabaya-Jakarta':  500_000,
  };
  const key = `${homeCity}-${city}`;
  return INTERCITY[key] ?? 350_000; // fallback estimate
}

export interface ItineraryBundle {
  event: {
    id: string;
    title: string;
    category: string;
    start_at: string;
    end_at: string;
    banner_url: string | null;
    venue: { name: string; city: string; address: string; latitude: number; longitude: number };
  };
  recommended_ticket: {
    id: string;
    name: string;
    price: number;
    available_quota: number;
  } | null;
  accommodation: {
    id: string;
    name: string;
    type: string;
    city: string;
    address: string;
    star_rating: number;
    base_price: number;
    distance_km: number;
    image_urls: string[];
  } | null;
  transport: {
    estimated_price: number;
    note: string;
  };
  cost_summary: {
    ticket:        number;
    accommodation: number;
    transport:     number;
    platform_fee:  number;
    total:         number;
  };
  day_schedule: Array<{ time: string; activity: string; location: string }>;
}

export class ItineraryService {
  async buildForEvent(eventId: number, userId?: number): Promise<ItineraryBundle> {
    // 1. Fetch event + venue + tiers
    const { data: event, error } = await supabase
      .from('events')
      .select(`
        id, title, category, start_at, end_at, banner_url, tags,
        venue:venues(id, name, city, address, latitude, longitude)
      `)
      .eq('id', eventId)
      .in('status', ['published', 'sold_out'])
      .single();

    if (error || !event) throw new Error('EVENT_NOT_FOUND');

    const venue = event.venue as any;

    // 2. Fetch ticket tiers — pick best match for user budget
    const { data: tiers } = await supabase
      .from('ticket_tiers')
      .select('id, name, price, available_quota, status')
      .eq('event_id', eventId)
      .eq('status', 'available')
      .gt('available_quota', 0)
      .order('price', { ascending: true });

    const prefs = userId ? await prefSvc.get(userId) : null;

    let recommendedTier = tiers?.[0] ?? null;
    if (prefs && tiers && tiers.length > 0) {
      const withinBudget = tiers.filter(t => t.price <= prefs.budget_max);
      recommendedTier = withinBudget.length > 0
        ? withinBudget[withinBudget.length - 1]  // best tier within budget
        : tiers[0];
    }

    // 3. Fetch nearest accommodation
    const { data: hotels } = await supabase
      .from('accommodations')
      .select('id, name, type, city, address, latitude, longitude, star_rating, base_price, image_urls')
      .eq('city', venue.city)
      .order('star_rating', { ascending: false })
      .limit(20);

    let bestHotel: any = null;
    if (hotels && hotels.length > 0 && venue.latitude && venue.longitude) {
      const withDistance = hotels.map(h => ({
        ...h,
        distance_km: haversine(h.latitude ?? 0, h.longitude ?? 0, venue.latitude, venue.longitude),
      }));

      // Filter by accommodation preference if set
      const accPref = prefs?.accommodation_pref ?? [];
      const filtered = accPref.length > 0
        ? withDistance.filter(h => {
            if (accPref.includes('near_venue') && h.distance_km > 3) return false;
            if (accPref.includes('budget') && h.base_price > 400_000) return false;
            if (accPref.includes('luxury') && h.star_rating < 4) return false;
            return true;
          })
        : withDistance;

      const sorted = (filtered.length > 0 ? filtered : withDistance)
        .sort((a, b) => a.distance_km - b.distance_km);

      bestHotel = { ...sorted[0], distance_km: Math.round(sorted[0].distance_km * 10) / 10 };
    }

    // 4. Transport estimate
    const transportPrice = estimateTransport(venue.city, prefs?.home_city ?? null);

    // 5. Cost summary
    const ticketPrice = recommendedTier?.price ?? 0;
    const hotelPrice  = bestHotel?.base_price ?? 0;
    const platformFee = Math.round(ticketPrice * 0.03);
    const total = ticketPrice + hotelPrice + transportPrice + platformFee;

    // 6. Day schedule (template-based, enriched by event duration)
    const eventDate = new Date(event.start_at);
    const schedule = this.buildDaySchedule(event, venue, bestHotel);

    return {
      event: {
        id:         event.id,
        title:      event.title,
        category:   event.category,
        start_at:   event.start_at,
        end_at:     event.end_at,
        banner_url: event.banner_url,
        venue,
      },
      recommended_ticket: recommendedTier
        ? {
            id:              recommendedTier.id,
            name:            recommendedTier.name,
            price:           recommendedTier.price,
            available_quota: recommendedTier.available_quota,
          }
        : null,
      accommodation: bestHotel
        ? {
            id:          bestHotel.id,
            name:        bestHotel.name,
            type:        bestHotel.type,
            city:        bestHotel.city,
            address:     bestHotel.address,
            star_rating: bestHotel.star_rating,
            base_price:  bestHotel.base_price,
            distance_km: bestHotel.distance_km,
            image_urls:  bestHotel.image_urls ?? [],
          }
        : null,
      transport: {
        estimated_price: transportPrice,
        note: transportPrice === 0
          ? 'Event di kotamu, tidak perlu perjalanan jauh'
          : `Estimasi perjalanan dari ${prefs?.home_city ?? 'kotamu'} ke ${venue.city}`,
      },
      cost_summary: {
        ticket:        ticketPrice,
        accommodation: hotelPrice,
        transport:     transportPrice,
        platform_fee:  platformFee,
        total,
      },
      day_schedule: schedule,
    };
  }

  private buildDaySchedule(event: any, venue: any, hotel: any): ItineraryBundle['day_schedule'] {
    const eventTime = new Date(event.start_at);
    const hour = eventTime.getHours();
    const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;

    // 1 hour before event, minimum 05:00
    const venueHour = Math.max(hour - 1, 5);
    // Check-in 1 hour before heading to venue
    const checkInHour = venueHour - 1;

    const schedule: ItineraryBundle['day_schedule'] = [];

    if (hotel) {
      if (checkInHour < 6) {
        // For very early events, check-in realistically happens the night before
        schedule.push({
          time: 'Malam sebelumnya',
          activity: `Check-in ${hotel.name}`,
          location: hotel.address,
        });
      } else {
        schedule.push({
          time: fmt(checkInHour),
          activity: `Check-in ${hotel.name}`,
          location: hotel.address,
        });
      }
    }

    schedule.push({
      time: fmt(venueHour),
      activity: `Menuju ${venue.name}`,
      location: hotel ? hotel.address : venue.city,
    });

    schedule.push({
      time: fmt(hour),
      activity: `🎟 ${event.title} dimulai`,
      location: `${venue.name}, ${venue.city}`,
    });

    const endHour = event.end_at
      ? new Date(event.end_at).getHours()
      : Math.min(hour + 3, 23);

    schedule.push({
      time: fmt(endHour),
      activity: hotel ? 'Acara selesai — kembali ke hotel' : 'Acara selesai',
      location: hotel ? hotel.address : venue.city,
    });

    if (hotel) {
      schedule.push({
        time: fmt(Math.min(endHour + 1, 23)),
        activity: `Istirahat di ${hotel.name}`,
        location: hotel.address,
      });
    }

    return schedule;
  }
}
