import { FastifyInstance } from 'fastify';
import { verifyWebhookSignature } from '../../lib/midtrans';
import { supabase } from '../../lib/db';
import { BookingsService } from '../bookings/bookings.service';

interface MidtransPayload {
  order_id: string;
  transaction_status: string;
  transaction_id: string;
  payment_type: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}

export async function webhookRoutes(fastify: FastifyInstance) {
  const bookingsService = new BookingsService();

  fastify.post('/midtrans', async (request, reply) => {
    const body = request.body as MidtransPayload;

    if (!verifyWebhookSignature(body)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const isSuccess = ['capture', 'settlement'].includes(body.transaction_status);
    const isFailed = ['deny', 'expire', 'cancel'].includes(body.transaction_status);

    if (!isSuccess && !isFailed) {
      return reply.status(200).send({ ok: true }); // pending/challenge — ignore
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('booking_number', body.order_id)
      .single();

    if (!booking) return reply.status(404).send();

    // Idempotency guard
    if (booking.status === 'confirmed' || booking.status === 'cancelled') {
      return reply.status(200).send({ ok: true });
    }

    if (isSuccess) {
      await supabase.from('bookings').update({
        status: 'confirmed',
        payment_method: body.payment_type,
        payment_ref: body.transaction_id,
        paid_at: new Date().toISOString(),
      }).eq('id', booking.id);

      // Issue tickets & update quota
      await bookingsService.confirmBookingAndIssueTickets(body.order_id);
    }

    if (isFailed) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      // Release ticket locks
      const { data: items } = await supabase
        .from('booking_items')
        .select('ticket_tier_id, quantity')
        .eq('booking_id', booking.id)
        .eq('item_type', 'ticket');

      const { releaseLock } = await import('../../lib/ticketLock');
      for (const item of items ?? []) {
        await releaseLock(item.ticket_tier_id, booking.id);
      }
    }

    return reply.status(200).send({ ok: true });
  });
}
