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
  tierId: string,
  quantity: number,
  bookingId: string
): Promise<void> {
  const result = await redis.eval(
    LOCK_SCRIPT,
    [QUOTA_KEY(tierId)],
    [quantity]
  ) as number;

  if (result === -1) throw new AppError('TIER_NOT_CACHED', 500);
  if (result === 0) throw new AppError('QUOTA_INSUFFICIENT', 409);

  await redis.setex(LOCK_KEY(tierId, bookingId), LOCK_TTL_SECONDS, quantity);
}

export async function releaseLock(tierId: string, bookingId: string): Promise<void> {
  const qty = await redis.get<number>(LOCK_KEY(tierId, bookingId));
  if (!qty) return;

  await redis.incrby(QUOTA_KEY(tierId), qty);
  await redis.del(LOCK_KEY(tierId, bookingId));
}

export async function commitLock(tierId: string, bookingId: string): Promise<void> {
  // Tiket terjual — hapus lock tanpa kembalikan quota
  await redis.del(LOCK_KEY(tierId, bookingId));
}

export async function initQuotaCache(tierId: string, quota: number): Promise<void> {
  await redis.set(QUOTA_KEY(tierId), quota);
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
