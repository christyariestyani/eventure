export type BookingStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type ItemType = 'ticket' | 'accommodation' | 'transport';
export type TicketStatus = 'issued' | 'used' | 'cancelled' | 'transferred';

export interface BookingItem {
  id: string;
  booking_id: string;
  item_type: ItemType;
  ticket_tier_id?: string;
  accommodation_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  metadata?: Record<string, unknown>;
}

export interface Booking {
  id: string;
  user_id: string;
  booking_number: string;
  status: BookingStatus;
  total_amount: number;
  platform_fee: number;
  payment_method?: string;
  payment_ref?: string;
  paid_at?: string;
  expires_at: string;
  booking_items: BookingItem[];
  created_at: string;
}

export interface Ticket {
  id: string;
  booking_item_id: string;
  user_id: string;
  tier_id: string;
  qr_code: string;
  status: TicketStatus;
  used_at?: string;
}

export interface CreateBookingRequest {
  ticket_tier_id: string;
  quantity: number;
  accommodation_id?: string;
  accommodation_meta?: {
    check_in: string;
    check_out: string;
    room_type?: string;
  };
}

export interface CreateBookingResponse {
  booking_id: string;
  booking_number: string;
  total_amount: number;
  platform_fee: number;
  expires_at: string;
  items: {
    ticket_subtotal: number;
    accommodation_subtotal: number;
  };
}
