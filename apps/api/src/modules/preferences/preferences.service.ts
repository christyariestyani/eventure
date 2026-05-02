import { supabase } from '../../lib/db';

export interface UserPreferences {
  event_types: string[];
  subcategories: string[];
  favorite_artists: string[];
  travel_style: 'solo' | 'couple' | 'group' | 'family';
  budget_tier: 'budget' | 'mid' | 'premium' | 'luxury';
  budget_min: number;
  budget_max: number;
  accommodation_pref: string[];
  home_city: string | null;
  preferred_cities: string[];
  onboarding_done: boolean;
}

const BUDGET_RANGES: Record<UserPreferences['budget_tier'], [number, number]> = {
  budget:  [0,        300_000],
  mid:     [300_000,  800_000],
  premium: [800_000,  2_000_000],
  luxury:  [2_000_000, 99_999_999],
};

export class PreferencesService {
  async get(userId: string): Promise<UserPreferences> {
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return (data as UserPreferences | null) ?? this.defaults();
  }

  async upsert(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.get(userId);
    const merged = { ...existing, ...patch };

    // Keep budget_min/max in sync with budget_tier when tier is set
    if (patch.budget_tier && !patch.budget_min && !patch.budget_max) {
      [merged.budget_min, merged.budget_max] = BUDGET_RANGES[patch.budget_tier];
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data as UserPreferences;
  }

  async completeOnboarding(userId: string, prefs: Omit<UserPreferences, 'onboarding_done'>): Promise<UserPreferences> {
    return this.upsert(userId, { ...prefs, onboarding_done: true });
  }

  private defaults(): UserPreferences {
    return {
      event_types: [],
      subcategories: [],
      favorite_artists: [],
      travel_style: 'solo',
      budget_tier: 'mid',
      budget_min: 300_000,
      budget_max: 800_000,
      accommodation_pref: [],
      home_city: null,
      preferred_cities: [],
      onboarding_done: false,
    };
  }
}
