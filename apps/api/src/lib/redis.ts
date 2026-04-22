import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Missing Upstash Redis environment variables');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const QUOTA_KEY = (tierId: string) => `tier:quota:${tierId}`;
export const LOCK_KEY = (tierId: string, bookingId: string) =>
  `lock:${tierId}:${bookingId}`;
export const EVENT_CACHE_KEY = (id: string) => `event:${id}`;
export const EVENTS_LIST_KEY = (params: string) => `events:list:${params}`;
