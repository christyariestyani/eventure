import Fastify from 'fastify';
import 'dotenv/config';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { eventsRoutes } from './modules/events/events.routes';
import { bookingsRoutes } from './modules/bookings/bookings.routes';
import { webhookRoutes } from './modules/webhooks/midtrans.routes';
import { recommendationsRoutes } from './modules/recommendations/recommendations.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { accommodationsRoutes } from './modules/accommodations/accommodations.routes';
import { preferencesRoutes } from './modules/preferences/preferences.routes';
import { behaviorRoutes } from './modules/behavior/behavior.routes';
import { itineraryRoutes } from './modules/itinerary/itinerary.routes';

const isDev = process.env.NODE_ENV !== 'production';

const server = Fastify({
  logger: {
    level: isDev ? 'info' : 'warn',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,reqId,req,res,responseTime',
            messageFormat: '{msg}',
          },
        }
      : undefined,
  },
  // Disable Fastify's default per-request logs — we use custom hooks below
  disableRequestLogging: true,
});

// ─── Skip logging for these paths ──────────────────────────────────────────────
const SILENT_PATHS = new Set(['/health', '/api/v1/me/behavior']);

function shouldLog(url: string) {
  const path = url.split('?')[0];
  return !SILENT_PATHS.has(path);
}

function truncate(obj: unknown, maxLen = 300): string {
  const s = JSON.stringify(obj) ?? '';
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

async function bootstrap() {
  await server.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? true,
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  await server.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      req.headers['x-forwarded-for'] as string ?? req.ip,
  });

  // ── Request / Response logging hooks ────────────────────────────────────────
  server.addHook('onRequest', async (req) => {
    if (!shouldLog(req.url)) return;
    (req as any)._startMs = Date.now();
    server.log.info(`→ ${req.method} ${req.url}`);
  });

  server.addHook('preHandler', async (req) => {
    if (!shouldLog(req.url)) return;
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      server.log.info(`  body: ${truncate(req.body)}`);
    }
  });

  server.addHook('onResponse', async (req, reply) => {
    if (!shouldLog(req.url)) return;
    const ms = Date.now() - ((req as any)._startMs ?? Date.now());
    const status = reply.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    server.log[level](`← ${status} ${req.method} ${req.url.split('?')[0]} (${ms}ms)`);
  });

  server.addHook('onError', async (req, _reply, error) => {
    server.log.error(`✗ ${req.method} ${req.url} — ${error.message}`);
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // API v1 routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(eventsRoutes, { prefix: '/api/v1/events' });
  await server.register(bookingsRoutes, { prefix: '/api/v1/bookings' });
  await server.register(accommodationsRoutes, { prefix: '/api/v1/accommodations' });
  await server.register(recommendationsRoutes, { prefix: '/api/v1/recommendations' });
  await server.register(preferencesRoutes,     { prefix: '/api/v1/me/preferences' });
  await server.register(behaviorRoutes,        { prefix: '/api/v1/me/behavior' });
  await server.register(itineraryRoutes,       { prefix: '/api/v1/itinerary' });

  // Webhooks (no /api/v1 prefix — Midtrans needs stable URL)
  await server.register(webhookRoutes, { prefix: '/webhooks' });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`Eventure API running on port ${port}`);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
