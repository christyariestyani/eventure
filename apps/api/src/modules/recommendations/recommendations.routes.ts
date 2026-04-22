import { FastifyInstance } from 'fastify';
import { RecommendationsService } from './recommendations.service';
import { optionalAuth } from '../../middleware/auth';

export async function recommendationsRoutes(fastify: FastifyInstance) {
  const service = new RecommendationsService();

  // GET /api/v1/recommendations — personalized if authed, trending otherwise
  fastify.get('/', { preHandler: optionalAuth }, async (request, reply) => {
    const user = (request as any).user as { id?: string } | undefined;
    const { limit } = request.query as { limit?: number };

    const events = user?.id
      ? await service.getForUser(user.id, limit)
      : await service.getTrending(limit);

    return reply.send({ data: events });
  });
}
