import { FastifyInstance } from 'fastify';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { BehaviorService } from './behavior.service';

export async function behaviorRoutes(fastify: FastifyInstance) {
  const svc = new BehaviorService();

  // POST /api/v1/me/behavior — fire-and-forget behavioral event
  fastify.post('/', { preHandler: optionalAuth }, async (request, reply) => {
    const user = (request as any).user as { id?: string } | undefined;
    if (!user?.id) return reply.status(204).send();

    const { event_id, action, dwell_ms, session_id } = request.body as any;
    if (!event_id || !action) return reply.status(400).send({ error: 'event_id and action required' });

    // Non-blocking — client doesn't need to wait
    svc.track(user.id, event_id, action, dwell_ms, session_id).catch(() => {});
    return reply.status(204).send();
  });

  // GET /api/v1/me/saved — saved/wishlist events
  fastify.get('/saved', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = (request as any).user as { id: string };
    const ids = await svc.getSavedEventIds(id);
    return reply.send({ data: ids });
  });
}
