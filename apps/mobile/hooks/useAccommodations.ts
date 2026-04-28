import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface Accommodation {
  id: string;
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
