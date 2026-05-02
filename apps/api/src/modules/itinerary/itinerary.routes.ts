import { FastifyInstance } from 'fastify';
import { optionalAuth } from '../../middleware/auth';
import { ItineraryService } from './itinerary.service';
import { AppError } from '../../lib/ticketLock';

export async function itineraryRoutes(fastify: FastifyInstance) {
  const svc = new ItineraryService();

  // GET /api/v1/itinerary/:eventId
  // Returns a complete travel bundle (ticket + hotel + transport + day schedule)
  fastify.get('/:eventId', { preHandler: optionalAuth }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const user = (request as any).user as { id?: string } | undefined;

    try {
      const bundle = await svc.buildForEvent(eventId, user?.id);
      return reply.send({ data: bundle });
    } catch (err: any) {
      if (err.message === 'EVENT_NOT_FOUND') {
        return reply.status(404).send({ error: 'EVENT_NOT_FOUND' });
      }
      throw err;
    }
  });
}
