import { differenceInDays } from 'date-fns';
import { supabase } from '../../lib/db';
import { lockTickets, releaseLock, commitLock, AppError } from '../../lib/ticketLock';
import { createSnapTransaction } from '../../lib/midtrans';
import { generateBookingNumber, generateQRToken, bookingExpiresAt } from '../../utils';
import type { CreateBookingDTO } from './bookings.schema';

const PLATFORM_FEE_RATE = 0.03; // 3%

export class BookingsService {
  async createBooking(userId: string, payload: CreateBookingDTO) {
    const { ticket_tier_id, quantity, accommodation_id, accommodation_meta } = payload;

    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select('*, events(id, title, start_at)')
      .eq('id', ticket_tier_id)
      .single();

    if (tierError || !tier) throw new AppError('TIER_NOT_FOUND', 404);
    if (tier.status !== 'available') throw new AppError('TIER_UNAVAILABLE', 409);
    if (quantity > tier.max_per_user) {
      throw new AppError(`MAX_PER_USER_EXCEEDED`, 400, `Max ${tier.max_per_user} tiket per user`);
    }

    // Atomic lock via Redis
    await lockTickets(ticket_tier_id, quantity, 'temp');

    try {
      const ticketSubtotal = tier.price * quantity;
      const platformFee = Math.round(ticketSubtotal * PLATFORM_FEE_RATE);

      let accommodationSubtotal = 0;
      if (accommodation_id && accommodation_meta) {
        const nights = differenceInDays(
          new Date(accommodation_meta.check_out),
          new Date(accommodation_meta.check_in)
        );
        if (nights < 1) throw new AppError('INVALID_STAY_DATES', 400);

        const { data: hotel } = await supabase
          .from('accommodations')
          .select('base_price')
          .eq('id', accommodation_id)
          .single();

        accommodationSubtotal = (hotel?.base_price ?? 0) * nights;
      }

      const totalAmount = ticketSubtotal + accommodationSubtotal + platformFee;
      const bookingNumber = generateBookingNumber();
      const expiresAt = bookingExpiresAt(15);

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          booking_number: bookingNumber,
          status: 'pending',
          total_amount: totalAmount,
          platform_fee: platformFee,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (bookingError || !booking) {
        await releaseLock(ticket_tier_id, 'temp');
        throw bookingError ?? new AppError('BOOKING_CREATE_FAILED', 500);
      }

      const items: any[] = [
        {
          booking_id: booking.id,
          item_type: 'ticket',
          ticket_tier_id,
          quantity,
          unit_price: tier.price,
          subtotal: ticketSubtotal,
        },
      ];

      if (accommodation_id && accommodation_meta) {
        items.push({
          booking_id: booking.id,
          item_type: 'accommodation',
          accommodation_id,
          quantity: 1,
          unit_price: accommodationSubtotal,
          subtotal: accommodationSubtotal,
          metadata: accommodation_meta,
        });
      }

      await supabase.from('booking_items').insert(items);

      // Rename temp lock ke booking ID
      const { redis } = await import('../../lib/redis');
      const { LOCK_KEY, QUOTA_KEY } = await import('../../lib/redis');
      await redis.rename(LOCK_KEY(ticket_tier_id, 'temp'), LOCK_KEY(ticket_tier_id, booking.id));
      await redis.expire(LOCK_KEY(ticket_tier_id, booking.id), 900);

      // Update reserved quota (non-blocking)
      supabase.rpc('increment_reserved_quota', {
        p_tier_id: ticket_tier_id,
        p_quantity: quantity,
      }).then().catch(console.error);

      return {
        booking_id: booking.id,
        booking_number: bookingNumber,
        total_amount: totalAmount,
        platform_fee: platformFee,
        expires_at: expiresAt,
        items: {
          ticket_subtotal: ticketSubtotal,
          accommodation_subtotal: accommodationSubtotal,
        },
      };
    } catch (err) {
      await releaseLock(ticket_tier_id, 'temp');
      throw err;
    }
  }

  async initiatePayment(bookingId: string, userId: string) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, users(full_name, email, phone)')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .single();

    if (!booking) throw new AppError('BOOKING_NOT_FOUND', 404);
    if (!['pending', 'awaiting_payment'].includes(booking.status)) {
      throw new AppError('BOOKING_NOT_PAYABLE', 400);
    }
    if (new Date(booking.expires_at) < new Date()) {
      throw new AppError('BOOKING_EXPIRED', 410);
    }

    const paymentToken = await createSnapTransaction({
      booking_number: booking.booking_number,
      total_amount: booking.total_amount,
      user: booking.users,
    });

    await supabase
      .from('bookings')
      .update({ status: 'awaiting_payment' })
      .eq('id', bookingId);

    return { payment_token: paymentToken, booking_number: booking.booking_number };
  }

  async getUserBookings(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count, error } = await supabase
      .from('bookings')
      .select(
        `id, booking_number, status, total_amount, created_at,
         booking_items(
           item_type, quantity, subtotal,
           ticket_tiers(name, events(title, start_at, banner_url, venues(name, city))),
           accommodations(name, city)
         )`,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data: data ?? [], meta: { total: count ?? 0, page, limit } };
  }

  async confirmBookingAndIssueTickets(bookingNumber: string) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, booking_items(*, ticket_tiers(*))')
      .eq('booking_number', bookingNumber)
      .single();

    if (!booking) return;

    const ticketItems = (booking.booking_items as any[]).filter(
      i => i.item_type === 'ticket'
    );

    // Generate individual tickets
    const tickets = ticketItems.flatMap((item: any) =>
      Array.from({ length: item.quantity }, () => ({
        booking_item_id: item.id,
        user_id: booking.user_id,
        tier_id: item.ticket_tier_id,
        qr_code: generateQRToken(),
        status: 'issued',
      }))
    );

    if (tickets.length > 0) {
      await supabase.from('tickets').insert(tickets);
    }

    // Update sold quota
    for (const item of ticketItems) {
      await supabase.rpc('confirm_ticket_sale', {
        p_tier_id: item.ticket_tier_id,
        p_quantity: item.quantity,
      });
      await commitLock(item.ticket_tier_id, booking.id);
    }
  }
}
