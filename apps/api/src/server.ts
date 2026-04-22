import Fastify from 'fastify';
import 'dotenv/config';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { eventsRoutes } from './modules/events/events.routes';
import { bookingsRoutes } from './modules/bookings/bookings.routes';
import { webhookRoutes } from './modules/webhooks/midtrans.routes';
import { recommendationsRoutes } from './modules/recommendations/recommendations.routes';

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

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

  // Health check
  server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // API v1 routes
  await server.register(eventsRoutes, { prefix: '/api/v1/events' });
  await server.register(bookingsRoutes, { prefix: '/api/v1/bookings' });
  await server.register(recommendationsRoutes, { prefix: '/api/v1/recommendations' });

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
