import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface CreateBookingPayload {
  ticket_tier_id: number;
  quantity: number;
  accommodation_id?: number;
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

export function useEditAddons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      bookingNumber: string;
      hotel_id?: number | null;
      hotel_meta?: Record<string, any>;
      outbound_meta?: Record<string, any>;
      return_meta?: Record<string, any>;
    }) => {
      const { bookingNumber, ...body } = payload;
      return api.patch(`/bookings/${bookingNumber}/edit-addons`, body).then(res => res.data.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.bookingNumber] });
    },
  });
}

export function usePaySupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingNumber: string) =>
      api.post(`/bookings/${bookingNumber}/pay-supplement`).then(res => res.data.data),
    onSuccess: (_data, bookingNumber) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', bookingNumber] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
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
