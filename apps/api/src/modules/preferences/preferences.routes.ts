import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { PreferencesService } from './preferences.service';

export async function preferencesRoutes(fastify: FastifyInstance) {
  const svc = new PreferencesService();

  // GET /api/v1/me/preferences
  fastify.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = (request as any).user as { id: number };
    return reply.send({ data: await svc.get(id) });
  });

  // PUT /api/v1/me/preferences — partial update
  fastify.put('/', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = (request as any).user as { id: number };
    const data = await svc.upsert(id, request.body as any);
    return reply.send({ data });
  });

  // POST /api/v1/me/onboarding — complete onboarding quiz in one shot
  fastify.post('/onboarding', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = (request as any).user as { id: number };
    const data = await svc.completeOnboarding(id, request.body as any);
    return reply.status(201).send({ data });
  });
}
