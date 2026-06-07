import { differenceInDays } from 'date-fns';
import { supabase } from '../../lib/db';
import { PreferencesService, UserPreferences } from '../preferences/preferences.service';
import { BehaviorService } from '../behavior/behavior.service';

const prefSvc = new PreferencesService();
const behaviorSvc = new BehaviorService();

// ─── Scoring weights per layer ─────────────────────────────────────────────────
const W = {
  // Content-Based Filtering
  CBF_CATEGORY:   35,   // exact event_type preference match
  CBF_SUBCAT:     20,   // subcategory / tag match
  CBF_ARTIST:     25,   // favorite artist in event tags
  CBF_CITY:       20,   // preferred city match

  // Behavioral (implicit signals)
  BEH_CATEGORY:   25,   // strong behavioral affinity for this category
  BEH_TAG:        15,   // behavioral affinity for a tag
  BEH_SAVED:      30,   // event is in the user's saved list

  // Collaborative Filtering
  CF_SIMILAR:     20,   // similar users booked this event

  // Context-Aware
  CTX_TRAVEL_WIN:  15,  // event fits within a 90-day travel window
  CTX_URGENCY:     20,  // event within 7 days
  CTX_SOON:        10,  // event within 30 days
  CTX_BUDGET:      15,  // min ticket price within user budget_max

  // Social proof
  SOCIAL_HOT:      10,  // >70% sold
  SOCIAL_NEW:       5,  // event published in last 7 days
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatEvent(event: any) {
  const tiers = event.ticket_tiers ?? [];
  const available = tiers.filter((t: any) => t.status === 'available');
  const minPrice = available.length > 0
    ? Math.min(...available.map((t: any) => t.price))
    : null;
  const hasQuota = available.some((t: any) => (t.available_quota ?? 0) > 0);
  return {
    ...event,
    min_price: minPrice,
    is_available: event.status !== 'sold_out' && hasQuota,
  };
}

async function fetchCandidateEvents(limit = 100) {
  const { data } = await supabase
    .from('events')
    .select(`
      *, venue:venues(name, city, latitude, longitude),
      ticket_tiers(price, total_quota, reserved_quota, sold_quota, available_quota, status)
    `)
    .in('status', ['published', 'sold_out'])
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit);
  return data ?? [];
}

// ─── Collaborative Filtering helper ────────────────────────────────────────────
async function getCollaborativeEventIds(userId: number): Promise<Set<string>> {
  // Find users who booked from the same categories, then get their other bookings
  const { data: myBookings } = await supabase
    .from('booking_items')
    .select('ticket_tiers(events(id, category))')
    .eq('item_type', 'ticket')
    .in(
      'booking_id',
      (
        await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .limit(20)
      ).data?.map((b: any) => b.id) ?? [],
    );

  const myCategories = new Set<string>(
    (myBookings ?? [])
      .flatMap((b: any) => b.ticket_tiers?.events ?? [])
      .map((e: any) => e?.category)
      .filter(Boolean),
  );

  if (myCategories.size === 0) return new Set();

  // Other users who booked the same categories
  const { data: similarUsers } = await supabase
    .from('bookings')
    .select('user_id, booking_items(ticket_tiers(events(id, category)))')
    .eq('status', 'confirmed')
    .neq('user_id', userId)
    .limit(200);

  const cfEventIds = new Set<string>();

  for (const booking of similarUsers ?? []) {
    for (const item of (booking as any).booking_items ?? []) {
      const event = item.ticket_tiers?.events;
      if (!event) continue;
      if (myCategories.has(event.category)) {
        cfEventIds.add(event.id);
      }
    }
  }

  return cfEventIds;
}

// ─── Main scoring function ─────────────────────────────────────────────────────
function scoreEvent(
  event: any,
  prefs: UserPreferences,
  affinityMap: ReturnType<typeof behaviorSvc.getAffinityMap> extends Promise<infer T> ? T : never,
  savedIds: Set<string>,
  cfIds: Set<string>,
  viewedIds: Set<string>,
): number {
  let score = 0;
  const tags: string[] = event.tags ?? [];
  const city: string = event.venue?.city ?? '';

  // ── CBF Layer ──────────────────────────────────────────────────────────
  if (prefs.event_types.includes(event.category)) score += W.CBF_CATEGORY;

  const subcatMatch = prefs.subcategories.some(s => tags.includes(s));
  if (subcatMatch) score += W.CBF_SUBCAT;

  const artistMatch = prefs.favorite_artists.some(a =>
    tags.some(t => t.toLowerCase().includes(a.toLowerCase())),
  );
  if (artistMatch) score += W.CBF_ARTIST;

  const cityPref = [...prefs.preferred_cities, prefs.home_city].filter(Boolean);
  if (cityPref.includes(city)) score += W.CBF_CITY;

  // ── Behavioral Layer ───────────────────────────────────────────────────
  const catAffinity = affinityMap.categories[event.category] ?? 0;
  if (catAffinity > 0) score += Math.min(catAffinity * 2, W.BEH_CATEGORY);

  const tagAffinitySum = tags.reduce(
    (acc, t) => acc + (affinityMap.tags[`tag:${t}`] ?? 0),
    0,
  );
  if (tagAffinitySum > 0) score += Math.min(tagAffinitySum, W.BEH_TAG);

  if (savedIds.has(event.id)) score += W.BEH_SAVED;

  // ── Collaborative Filtering Layer ─────────────────────────────────────
  if (cfIds.has(event.id)) score += W.CF_SIMILAR;

  // ── Context-Aware Layer ────────────────────────────────────────────────
  const days = differenceInDays(new Date(event.start_at), new Date());
  if (days <= 7)  score += W.CTX_URGENCY;
  else if (days <= 30) score += W.CTX_SOON;
  if (days <= 90) score += W.CTX_TRAVEL_WIN;

  const tiers = event.ticket_tiers ?? [];
  const minPrice = Math.min(...tiers.map((t: any) => t.price).filter(Boolean));
  if (!isNaN(minPrice) && minPrice <= prefs.budget_max) score += W.CTX_BUDGET;

  // ── Social proof ───────────────────────────────────────────────────────
  const totalQuota = tiers.reduce((s: number, t: any) => s + (t.total_quota ?? 0), 0);
  const soldQuota  = tiers.reduce((s: number, t: any) => s + (t.sold_quota ?? 0), 0);
  const soldPct = totalQuota > 0 ? soldQuota / totalQuota : 0;
  if (soldPct > 0.7) score += W.SOCIAL_HOT;

  // Small freshness penalty for already-viewed events (diversify feed)
  if (viewedIds.has(event.id)) score *= 0.6;

  return score;
}

// ─── Public API ────────────────────────────────────────────────────────────────
export class RecommendationsService {
  /**
   * Personalized feed split into three themed sections:
   *  - forYou:     highest-scoring across all layers
   *  - nearYou:    events in user's home city / preferred cities
   *  - activity:   events similar to recent behavior (category affinity top picks)
   */
  async getPersonalizedFeed(userId: number, limit = 10) {
    const [prefs, affinityMap, savedIds, viewedIds, cfIds, events] = await Promise.all([
      prefSvc.get(userId),
      behaviorSvc.getAffinityMap(userId),
      behaviorSvc.getSavedEventIds(userId).then(ids => new Set(ids)),
      behaviorSvc.getViewedEventIds(userId).then(ids => new Set(ids)),
      getCollaborativeEventIds(userId),
      fetchCandidateEvents(120),
    ]);

    const scored = events.map(event => ({
      event: formatEvent(event),
      score: scoreEvent(event, prefs, affinityMap, savedIds, cfIds, viewedIds),
    }));

    scored.sort((a, b) => b.score - a.score);

    // For You — top-N overall
    const forYou = scored.slice(0, limit).map(s => s.event);

    // Near You — filter by preferred cities / home city, re-sort by date
    const citySet = new Set([...prefs.preferred_cities, prefs.home_city].filter(Boolean));
    const nearYou = events
      .filter(e => citySet.has(e.venue?.city))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, limit)
      .map(formatEvent);

    // Based on Activity — driven by top behavioral category affinity
    const topCategory = Object.entries(affinityMap.categories).sort((a, b) => b[1] - a[1])[0]?.[0];
    const activity = topCategory
      ? scored
          .filter(s => s.event.category === topCategory && !viewedIds.has(s.event.id))
          .slice(0, limit)
          .map(s => s.event)
      : [];

    return { forYou, nearYou, activity };
  }

  async getForUser(userId: number, limit = 10) {
    const { forYou } = await this.getPersonalizedFeed(userId, limit);
    return forYou;
  }

  async getTrending(limit = 10) {
    const { data } = await supabase
      .from('events')
      .select(`
        *, venue:venues(city),
        ticket_tiers(price, total_quota, sold_quota, available_quota, status)
      `)
      .in('status', ['published', 'sold_out'])
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(60);

    return (data ?? [])
      .map(event => {
        const tiers = event.ticket_tiers ?? [];
        const total = tiers.reduce((s: number, t: any) => s + t.total_quota, 0);
        const sold  = tiers.reduce((s: number, t: any) => s + t.sold_quota, 0);
        return { event: formatEvent(event), soldPct: total > 0 ? sold / total : 0 };
      })
      .sort((a, b) => b.soldPct - a.soldPct)
      .slice(0, limit)
      .map(s => s.event);
  }
}
