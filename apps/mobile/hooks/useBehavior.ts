import { useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export type BehaviorAction =
  | 'view'
  | 'save'
  | 'unsave'
  | 'book'
  | 'dismiss'
  | 'share'
  | 'itinerary_view';

// Fire-and-forget — never throws, never blocks UI
async function sendBehavior(
  eventId: string,
  action: BehaviorAction,
  dwellMs?: number,
) {
  try {
    await api.post('/me/behavior', {
      event_id: eventId,
      action,
      dwell_ms: dwellMs,
    });
  } catch {
    // silent
  }
}

export function useTrackBehavior() {
  const user = useAuthStore(s => s.user);

  const track = useCallback(
    (eventId: string, action: BehaviorAction, dwellMs?: number) => {
      if (!user) return;
      sendBehavior(eventId, action, dwellMs);
    },
    [user],
  );

  return track;
}

// Hook for dwell-time tracking on a detail screen.
// Call startDwell() on mount, stopDwell() on unmount.
export function useDwellTracker(eventId: string) {
  const user = useAuthStore(s => s.user);
  const startRef = useRef<number>(0);

  const startDwell = useCallback(() => {
    startRef.current = Date.now();
  }, []);

  const stopDwell = useCallback(() => {
    if (!user || !startRef.current) return;
    const ms = Date.now() - startRef.current;
    if (ms > 2000) {
      // Only track if user spent > 2s on screen
      sendBehavior(eventId, 'view', ms);
    }
    startRef.current = 0;
  }, [user, eventId]);

  return { startDwell, stopDwell };
}
