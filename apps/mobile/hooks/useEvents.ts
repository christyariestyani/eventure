import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface ApiEvent {
  id: string;
  title: string;
  category: string;
  tags: string[];
  start_at: string;
  end_at: string;
  banner_url?: string;
  status: string;
  min_price?: number;
  is_available?: boolean;
  venue: { id: string; name: string; city: string; latitude: number; longitude: number };
  ticket_tiers: ApiTicketTier[];
}

export interface ApiTicketTier {
  id: string;
  name: string;
  description?: string;
  price: number;
  available_quota: number;
  max_per_user: number;
  status: string;
  benefits?: string[];
}

interface UseEventsParams {
  q?: string;
  city?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export function useEvents(params: UseEventsParams = {}) {
  const query = useQuery({
    queryKey: ['events', params],
    queryFn: () =>
      api.get('/events', { params }).then(res => res.data.data as ApiEvent[]),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    error: query.error,
  };
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/events/${id}`).then(res => res.data.data as ApiEvent),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: () =>
      api.get('/recommendations').then(res => res.data.data as ApiEvent[]),
    staleTime: 5 * 60 * 1000,
  });
}
