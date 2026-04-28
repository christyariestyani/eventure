import { supabase } from '../../lib/db';
import { redis, EVENTS_LIST_KEY, EVENT_CACHE_KEY } from '../../lib/redis';
import type { GetEventsQuery } from './events.schema';

const EVENT_LIST_TTL = 120;  // 2 menit
const EVENT_DETAIL_TTL = 300; // 5 menit

export class EventsService {
  async listEvents(query: GetEventsQuery) {
    const cacheKey = EVENTS_LIST_KEY(JSON.stringify(query));
    const cached = await redis.get<string>(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

    const { q, city, category, date_from, date_to, page, limit } = query;
    const offset = (page - 1) * limit;

    let dbQuery = supabase
      .from('events')
      .select(
        `id, title, category, tags, start_at, end_at, banner_url, status,
         venue:venues(id, name, city, latitude, longitude),
         ticket_tiers(id, name, price, available_quota, status)`,
        { count: 'exact' }
      )
      .in('status', ['published', 'sold_out'])
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (city) dbQuery = dbQuery.eq('venues.city', city);
    if (category) dbQuery = dbQuery.eq('category', category);
    if (date_from) dbQuery = dbQuery.gte('start_at', date_from);
    if (date_to) dbQuery = dbQuery.lte('start_at', date_to);
    if (q) dbQuery = dbQuery.textSearch('title', q, { type: 'websearch' });

    const { data, count, error } = await dbQuery;
    if (error) throw error;

    const result = {
      data: (data ?? []).map(this.formatEvent),
      meta: { total: count ?? 0, page, limit },
    };

    await redis.setex(cacheKey, EVENT_LIST_TTL, JSON.stringify(result));
    return result;
  }

  async getEventById(id: string) {
    const cacheKey = EVENT_CACHE_KEY(id);
    const cached = await redis.get<string>(cacheKey);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;

    const { data, error } = await supabase
      .from('events')
      .select(
        `*, venue:venues(*),
         ticket_tiers(id, name, description, price, available_quota, max_per_user, status, benefits)`
      )
      .eq('id', id)
      .in('status', ['published', 'sold_out'])
      .single();

    if (error || !data) return null;

    const formatted = this.formatEvent(data);
    await redis.setex(cacheKey, EVENT_DETAIL_TTL, JSON.stringify(formatted));
    return formatted;
  }

  async invalidateEventCache(eventId: string) {
    await redis.del(EVENT_CACHE_KEY(eventId));
  }

  private formatEvent(event: any) {
    const tiers = event.ticket_tiers ?? [];
    const availableTiers = tiers.filter((t: any) => t.status === 'available');
    const minPrice = availableTiers.length > 0
      ? Math.min(...availableTiers.map((t: any) => t.price))
      : null;

    const hasQuota = availableTiers.some((t: any) => (t.available_quota ?? 0) > 0);
    return {
      ...event,
      min_price: minPrice,
      is_available: event.status !== 'sold_out' && hasQuota,
      ticket_tiers: tiers,
    };
  }
}
