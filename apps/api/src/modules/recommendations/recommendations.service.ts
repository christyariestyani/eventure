import { differenceInDays } from 'date-fns';
import { supabase } from '../../lib/db';

interface UserSignals {
  preferences: { genres?: string[]; sports?: string[]; budget_tier?: string };
  bookedCategories: string[];
  bookedTags: string[];
  location: string;
}

export class RecommendationsService {
  async getForUser(userId: string, limit = 10) {
    const [userResult, bookingsResult, eventsResult] = await Promise.all([
      supabase.from('users').select('preferences').eq('id', userId).single(),
      supabase
        .from('bookings')
        .select('booking_items(ticket_tiers(events(category, tags)))')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .limit(10),
      supabase
        .from('events')
        .select('*, venue:venues(city), ticket_tiers(price, available_quota, status)')
        .eq('status', 'published')
        .gte('start_at', new Date().toISOString())
        .limit(80),
    ]);

    const signals = this.buildSignals(userResult.data, bookingsResult.data);
    const events = eventsResult.data ?? [];

    const scored = events
      .map(event => ({ event, score: this.score(event, signals) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.event);

    return scored;
  }

  async getTrending(limit = 10) {
    const { data } = await supabase
      .from('events')
      .select('*, venue:venues(city), ticket_tiers(price, total_quota, sold_quota, available_quota)')
      .eq('status', 'published')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(50);

    return (data ?? [])
      .map(event => {
        const totalQuota = event.ticket_tiers.reduce((s: number, t: any) => s + t.total_quota, 0);
        const soldQuota = event.ticket_tiers.reduce((s: number, t: any) => s + t.sold_quota, 0);
        const soldPct = totalQuota > 0 ? soldQuota / totalQuota : 0;
        return { event, soldPct };
      })
      .sort((a, b) => b.soldPct - a.soldPct)
      .slice(0, limit)
      .map(s => s.event);
  }

  private buildSignals(user: any, bookings: any): UserSignals {
    const bookedCategories: string[] = [];
    const bookedTags: string[] = [];

    for (const booking of bookings ?? []) {
      for (const item of booking.booking_items ?? []) {
        const event = item.ticket_tiers?.events;
        if (!event) continue;
        bookedCategories.push(event.category);
        bookedTags.push(...(event.tags ?? []));
      }
    }

    return {
      preferences: user?.preferences ?? {},
      bookedCategories: [...new Set(bookedCategories)],
      bookedTags: [...new Set(bookedTags)],
      location: '', // populated from request context if available
    };
  }

  private score(event: any, signals: UserSignals): number {
    let score = 0;

    // Category preference match
    const prefInterests = [
      ...(signals.preferences.genres ?? []),
      ...(signals.preferences.sports ?? []),
    ];
    if (event.tags?.some((tag: string) => prefInterests.includes(tag))) score += 40;

    // Past booking category affinity
    if (signals.bookedCategories.includes(event.category)) score += 15;
    if (event.tags?.some((t: string) => signals.bookedTags.includes(t))) score += 10;

    // Location proximity
    if (signals.location && event.venue?.city === signals.location) score += 25;

    // Recency / urgency
    const days = differenceInDays(new Date(event.start_at), new Date());
    if (days <= 7) score += 20;
    else if (days <= 30) score += 10;

    // Social proof (popularity)
    const tiers = event.ticket_tiers ?? [];
    const total = tiers.reduce((s: number, t: any) => s + (t.total_quota ?? 0), 0);
    const avail = tiers.reduce((s: number, t: any) => s + (t.available_quota ?? 0), 0);
    const soldPct = total > 0 ? 1 - avail / total : 0;
    if (soldPct > 0.7) score += 10;

    // Budget match
    const minPrice = Math.min(...tiers.map((t: any) => t.price).filter(Boolean));
    const tier = signals.preferences.budget_tier;
    if (tier === 'budget' && minPrice < 300_000) score += 10;
    if (tier === 'mid' && minPrice < 800_000) score += 10;

    return score;
  }
}
