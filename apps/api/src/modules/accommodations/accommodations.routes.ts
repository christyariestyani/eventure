import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/db';

export async function accommodationsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { city } = request.query as { city?: string };

    let query = supabase
      .from('accommodations')
      .select('id, name, type, city, address, star_rating, base_price, image_urls, amenities')
      .order('star_rating', { ascending: false })
      .limit(20);

    if (city) query = query.ilike('city', `%${city}%`);

    const { data, error } = await query;
    if (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Database error' });
    }

    return { data: data ?? [] };
  });
}
