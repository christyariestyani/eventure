import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface CreateBookingPayload {
  ticket_tier_id: string;
  quantity: number;
  accommodation_id?: string;
  accommodation_meta?: {
    check_in: string;
    check_out: string;
    room_type?: string;
  };
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBookingPayload) =>
      api.post('/bookings', payload).then(res => res.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/bookings/${bookingId}/pay`).then(res => res.data.data),
  });
}

export function useBookingDetail(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () =>
      api.get(`/bookings/${bookingId}`).then(res => res.data.data),
    enabled: !!bookingId,
    staleTime: 0,
  });
}

export function useBookings(page = 1) {
  return useQuery({
    queryKey: ['bookings', page],
    queryFn: () =>
      api.get('/bookings', { params: { page } }).then(res => res.data),
    staleTime: 30 * 1000, // 30 detik
  });
}
