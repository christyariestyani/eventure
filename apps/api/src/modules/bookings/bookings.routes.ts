import { FastifyInstance } from 'fastify';
import { BookingsService } from './bookings.service';
import { CreateBookingSchema } from './bookings.schema';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../lib/ticketLock';

export async function bookingsRoutes(fastify: FastifyInstance) {
  const service = new BookingsService();

  // POST /api/v1/bookings — create booking & lock tickets
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const parsed = CreateBookingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await service.createBooking(user.id, parsed.data);
      return reply.status(201).send({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // PATCH /api/v1/bookings/:id/addons — tambah hotel/transport ke booking
  fastify.patch('/:id/addons', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { id } = request.params as { id: string };
    const body = request.body as { hotel_id?: string; transport_price?: number };

    try {
      const result = await service.addAddons(id, user.id, body);
      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // POST /api/v1/bookings/:id/pay — initiate Midtrans payment
  fastify.post('/:id/pay', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { id } = request.params as { id: string };

    try {
      const result = await service.initiatePayment(id, user.id);
      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // GET /api/v1/bookings/:id — booking detail
  fastify.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { id } = request.params as { id: string };

    try {
      const result = await service.getBookingDetail(id, user.id);
      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // GET /api/v1/bookings — user's booking history
  fastify.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { page, limit } = request.query as { page?: number; limit?: number };
    const result = await service.getUserBookings(user.id, page, limit);
    return reply.send(result);
  });
}
