import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

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
    ticket: number;
    accommodation: number;
    transport: number;
    platform_fee: number;
    total: number;
  };
  day_schedule: Array<{ time: string; activity: string; location: string }>;
}

export function useItinerary(eventId: string | null) {
  return useQuery<ItineraryBundle>({
    queryKey: ['itinerary', eventId],
    queryFn: () => api.get(`/itinerary/${eventId}`).then(r => r.data.data),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
  });
}
