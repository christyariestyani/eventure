import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface Accommodation {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  star_rating: number;
  base_price: number;
  image_urls: string[];
  amenities: string[];
}

export function useAccommodations(city?: string) {
  return useQuery({
    queryKey: ['accommodations', city],
    queryFn: () =>
      api.get('/accommodations', { params: city ? { city } : {} })
        .then(res => res.data.data as Accommodation[]),
    staleTime: 5 * 60 * 1000,
  });
}
