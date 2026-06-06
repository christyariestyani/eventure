import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface RoomType {
  id: number;
  name: string;
  description: string | null;
  bed_type: string;
  max_occupancy: number;
  price_per_night: number;
  amenities: string[];
  image_urls: string[];
  is_available: boolean;
  sort_order: number;
}

export interface Accommodation {
  id: number;
  name: string;
  type: string;
  city: string;
  address: string;
  star_rating: number;
  base_price: number;
  image_urls: string[];
  amenities: string[];
  distance_km: number | null;
}

export function useAccommodations(city?: string, venueLat?: number, venueLng?: number) {
  return useQuery({
    queryKey: ['accommodations', city, venueLat, venueLng],
    queryFn: () => {
      const params: Record<string, any> = {};
      if (city) params.city = city;
      if (venueLat != null) params.lat = venueLat;
      if (venueLng != null) params.lng = venueLng;
      return api.get('/accommodations', { params }).then(res => res.data.data as Accommodation[]);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoomTypes(accommodationId: number | null) {
  return useQuery({
    queryKey: ['room_types', accommodationId],
    queryFn: () =>
      api.get(`/accommodations/${accommodationId}/rooms`)
        .then(res => res.data.data as RoomType[]),
    enabled: accommodationId != null,
    staleTime: 5 * 60 * 1000,
  });
}
