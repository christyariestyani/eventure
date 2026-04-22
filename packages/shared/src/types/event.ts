export type EventCategory = 'music' | 'sports' | 'festival' | 'conference';
export type EventStatus = 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed';
export type TierStatus = 'available' | 'sold_out' | 'paused';

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  price: number;
  total_quota: number;
  available_quota: number;
  max_per_user: number;
  status: TierStatus;
  benefits?: string[];
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  tags: string[];
  start_at: string;
  end_at: string;
  banner_url?: string;
  status: EventStatus;
  venue: Venue;
  ticket_tiers: TicketTier[];
  min_price?: number;
  is_available?: boolean;
}
