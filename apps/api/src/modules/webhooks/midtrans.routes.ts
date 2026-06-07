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

    // Supplement payments have order_id like "EVT-XXXXXX-SUPPL"
    const isSupplementPayment = body.order_id.endsWith('-SUPPL');
    const bookingNumber = isSupplementPayment
      ? body.order_id.replace(/-SUPPL$/, '')
      : body.order_id;

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, total_amount')
      .eq('booking_number', bookingNumber)
      .single();

    if (!booking) return reply.status(404).send();

    if (isSupplementPayment) {
      if (!isSuccess) return reply.status(200).send({ ok: true });

      // Recalculate new total from current items and update
      const { data: items } = await supabase
        .from('booking_items')
        .select('item_type, subtotal, metadata')
        .eq('booking_id', booking.id);

      const ticketSubtotal = Number(items?.find((i: any) => i.item_type === 'ticket')?.subtotal ?? 0);
      const addonTotal = (items ?? [])
        .filter((i: any) => ['accommodation', 'outbound_transport', 'return_transport'].includes(i.item_type))
        .reduce((sum: number, i: any) => {
          const base = Number(i.subtotal);
          const extra = i.item_type === 'accommodation' ? Number(i.metadata?.extra_fees ?? 0) : 0;
          return sum + base + extra;
        }, 0);
      const newTotal = ticketSubtotal + addonTotal + Number(parseFloat(body.gross_amount));
      // gross_amount from Midtrans is the supplement amount, not the full total
      // Calculate from items directly instead
      const calculatedTotal = ticketSubtotal + addonTotal;

      await supabase
        .from('bookings')
        .update({ total_amount: calculatedTotal })
        .eq('id', booking.id);

      return reply.status(200).send({ ok: true });
    }

    // Idempotency guard for regular payments
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
      await bookingsService.confirmBookingAndIssueTickets(bookingNumber);
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
