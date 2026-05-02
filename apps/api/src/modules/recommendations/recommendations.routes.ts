import { FastifyInstance } from 'fastify';
import { RecommendationsService } from './recommendations.service';
import { optionalAuth } from '../../middleware/auth';

export async function recommendationsRoutes(fastify: FastifyInstance) {
  const svc = new RecommendationsService();

  // GET /api/v1/recommendations — flat list (backward-compat, used by existing hooks)
  fastify.get('/', { preHandler: optionalAuth }, async (request, reply) => {
    const user = (request as any).user as { id?: string } | undefined;
    const { limit } = request.query as { limit?: number };

    const events = user?.id
      ? await svc.getForUser(user.id, limit ?? 10)
      : await svc.getTrending(limit ?? 10);

    return reply.send({ data: events });
  });

  // GET /api/v1/recommendations/feed — sectioned smart feed (For You / Near You / Activity)
  fastify.get('/feed', { preHandler: optionalAuth }, async (request, reply) => {
    const user = (request as any).user as { id?: string } | undefined;
    const { limit } = request.query as { limit?: number };

    if (!user?.id) {
      const trending = await svc.getTrending(limit ?? 10);
      return reply.send({
        data: { forYou: trending, nearYou: [], activity: [] },
      });
    }

    const feed = await svc.getPersonalizedFeed(user.id, limit ?? 10);
    return reply.send({ data: feed });
  });
}
