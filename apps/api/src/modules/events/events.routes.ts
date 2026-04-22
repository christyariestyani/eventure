import { FastifyInstance } from 'fastify';
import { EventsService } from './events.service';
import { GetEventsQuerySchema } from './events.schema';

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
    const event = await service.getEventById(id);
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return reply.send({ data: event });
  });
}
