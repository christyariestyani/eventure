import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/db';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function accommodationsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { city, lat, lng } = request.query as { city?: string; lat?: string; lng?: string };

    let query = supabase
      .from('accommodations')
      .select('id, name, type, city, address, latitude, longitude, star_rating, base_price, image_urls, amenities')
      .limit(20);

    if (city) query = query.ilike('city', `%${city}%`);

    const { data, error } = await query;
    if (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Database error' });
    }

    const venueLat = lat ? parseFloat(lat) : null;
    const venueLng = lng ? parseFloat(lng) : null;

    const withDistance = (data ?? []).map(acc => ({
      ...acc,
      distance_km:
        venueLat != null && venueLng != null && acc.latitude && acc.longitude
          ? Math.round(haversineKm(acc.latitude, acc.longitude, venueLat, venueLng) * 10) / 10
          : null,
    }));

    const sorted = venueLat != null
      ? [...withDistance].sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
      : [...withDistance].sort((a, b) => b.star_rating - a.star_rating);

    return { data: sorted };
  });
}
