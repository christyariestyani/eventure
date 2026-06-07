import { redis, QUOTA_KEY, LOCK_KEY } from './redis';

const LOCK_TTL_SECONDS = 900; // 15 menit

const LOCK_SCRIPT = `
local key = KEYS[1]
local qty = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key))
if current == nil then return -1 end
if current < qty then return 0 end
redis.call('DECRBY', key, qty)
return 1
`;

export async function lockTickets(
  tierId: number,
  quantity: number,
  bookingId: string
): Promise<void> {
  const quotaKey = QUOTA_KEY(String(tierId));

  // Auto-initialize from DB if quota not in Redis (e.g. after cache flush)
  const exists = await redis.exists(quotaKey);
  if (!exists) {
    const { supabase } = await import('./db');
    const { data: tier } = await supabase
      .from('ticket_tiers')
      .select('available_quota')
      .eq('id', tierId)
      .single();

    if (!tier) throw new AppError('TIER_NOT_FOUND', 404);
    // setnx: only sets if key still absent — safe under concurrent requests
    await redis.setnx(quotaKey, tier.available_quota);
  }

  const result = await redis.eval(
    LOCK_SCRIPT,
    [quotaKey],
    [quantity]
  ) as number;

  if (result === -1) throw new AppError('TIER_NOT_CACHED', 500);
  if (result === 0) throw new AppError('QUOTA_INSUFFICIENT', 409);

  await redis.setex(LOCK_KEY(String(tierId), bookingId), LOCK_TTL_SECONDS, quantity);
}

export async function releaseLock(tierId: number, bookingId: string): Promise<void> {
  const qty = await redis.get<number>(LOCK_KEY(String(tierId), bookingId));
  if (!qty) return;

  await redis.incrby(QUOTA_KEY(String(tierId)), qty);
  await redis.del(LOCK_KEY(String(tierId), bookingId));
}

export async function commitLock(tierId: number, bookingId: string): Promise<void> {
  // Tiket terjual — hapus lock tanpa kembalikan quota
  await redis.del(LOCK_KEY(String(tierId), bookingId));
}

export async function initQuotaCache(tierId: number, quota: number): Promise<void> {
  await redis.set(QUOTA_KEY(String(tierId)), quota);
}

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string
  ) {
    super(message ?? code);
  }
}
