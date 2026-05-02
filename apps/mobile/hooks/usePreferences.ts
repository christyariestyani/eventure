import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

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

export function usePreferences(enabled = true) {
  return useQuery<UserPreferences>({
    queryKey: ['preferences'],
    queryFn: () => api.get('/me/preferences').then(r => r.data.data),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserPreferences>) =>
      api.put('/me/preferences', patch).then(r => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Omit<UserPreferences, 'onboarding_done'>) =>
      api.post('/me/preferences/onboarding', prefs).then(r => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
