import { FastifyInstance } from 'fastify';
import { EventsService } from './events.service';
import { GetEventsQuerySchema } from './events.schema';
import { redis } from '../../lib/redis';

export async function eventsRoutes(fastify: FastifyInstance) {
  const service = new EventsService();

  fastify.get('/', async (request, reply) => {
    const parsed = GetEventsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await service.listEvents(parsed.data);
    return reply.send(result);
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return reply.status(400).send({ error: 'Invalid event ID' });
    const event = await service.getEventById(numId);
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return reply.send({ data: event });
  });

  // DELETE /api/v1/events/cache — flush event cache (dev only)
  if (process.env.NODE_ENV !== 'production') {
    fastify.delete('/cache', async (_req, reply) => {
      const keys = await redis.keys('event*');
      if (keys.length > 0) await redis.del(...keys);
      return reply.send({ cleared: keys.length });
    });
  }
}
