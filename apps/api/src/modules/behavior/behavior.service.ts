import { supabase } from '../../lib/db';

export type BehaviorAction =
  | 'view'
  | 'save'
  | 'unsave'
  | 'book'
  | 'dismiss'
  | 'share'
  | 'itinerary_view';

export interface AffinityMap {
  categories: Record<string, number>;   // e.g. { music: 42, sports: 18 }
  tags: Record<string, number>;          // e.g. { 'tag:edm': 20, 'tag:marathon': 15 }
}

// Action weights for affinity scoring
const WEIGHTS: Record<BehaviorAction, number> = {
  book:            10,
  save:             5,
  itinerary_view:   3,
  share:            2,
  view:             1,
  unsave:          -3,
  dismiss:         -1,
};

export class BehaviorService {
  async track(
    userId: string,
    eventId: string,
    action: BehaviorAction,
    dwellMs?: number,
    sessionId?: string,
  ) {
    await supabase.from('user_behavior').insert({
      user_id: userId,
      event_id: eventId,
      action,
      dwell_ms: dwellMs ?? null,
      session_id: sessionId ?? null,
    });

    // Mirror save/unsave to saved_events table
    if (action === 'save') {
      await supabase
        .from('saved_events')
        .upsert({ user_id: userId, event_id: eventId })
        .eq('user_id', userId);
    } else if (action === 'unsave') {
      await supabase
        .from('saved_events')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', eventId);
    }
  }

  async getAffinityMap(userId: string): Promise<AffinityMap> {
    const { data } = await supabase
      .from('user_behavior')
      .select('action, dwell_ms, events(category, tags)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    const categories: Record<string, number> = {};
    const tags: Record<string, number> = {};

    for (const row of data ?? []) {
      const event = row.events as any;
      if (!event) continue;

      const baseWeight = WEIGHTS[row.action as BehaviorAction] ?? 0;
      if (baseWeight === 0) continue;

      // Dwell-time bonus: up to +3 for 30 s+ on screen
      const dwellBonus = row.dwell_ms ? Math.min(row.dwell_ms / 10_000, 3) : 0;
      const weight = baseWeight + (baseWeight > 0 ? dwellBonus : 0);

      categories[event.category] = (categories[event.category] ?? 0) + weight;
      for (const tag of (event.tags ?? [])) {
        tags[`tag:${tag}`] = (tags[`tag:${tag}`] ?? 0) + weight * 0.5;
      }
    }

    return { categories, tags };
  }

  async getSavedEventIds(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', userId);
    return (data ?? []).map(r => r.event_id);
  }

  async getViewedEventIds(userId: string, limit = 50): Promise<string[]> {
    const { data } = await supabase
      .from('user_behavior')
      .select('event_id')
      .eq('user_id', userId)
      .in('action', ['view', 'book', 'save'])
      .order('created_at', { ascending: false })
      .limit(limit);
    return [...new Set((data ?? []).map(r => r.event_id))];
  }
}
