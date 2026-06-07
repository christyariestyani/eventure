import { differenceInDays } from 'date-fns';
import { supabase } from '../../lib/db';
import { lockTickets, releaseLock, commitLock, AppError } from '../../lib/ticketLock';
import { createSnapTransaction } from '../../lib/midtrans';
import { generateBookingNumber, generateQRToken, bookingExpiresAt } from '../../utils';
import type { CreateBookingDTO } from './bookings.schema';

const PLATFORM_FEE_RATE = 0.03;

export class BookingsService {
  async createBooking(userId: number, payload: CreateBookingDTO) {
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

    // Return existing pending booking for the same tier if still valid
    const { data: pendingBookings } = await supabase
      .from('bookings')
      .select('id, booking_number, total_amount, platform_fee, expires_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (pendingBookings && pendingBookings.length > 0) {
      const { data: existingItem } = await supabase
        .from('booking_items')
        .select('booking_id')
        .eq('ticket_tier_id', ticket_tier_id)
        .eq('item_type', 'ticket')
        .in('booking_id', pendingBookings.map(b => b.id))
        .limit(1)
        .maybeSingle();

      if (existingItem) {
        const booking = pendingBookings.find(b => b.id === existingItem.booking_id)!;
        const ticketSubtotal = tier.price * quantity;
        return {
          booking_id: booking.id,
          booking_number: booking.booking_number,
          total_amount: booking.total_amount,
          platform_fee: booking.platform_fee,
          expires_at: new Date(booking.expires_at),
          items: { ticket_subtotal: ticketSubtotal, accommodation_subtotal: 0 },
        };
      }
    }

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

      const { redis } = await import('../../lib/redis');
      const { LOCK_KEY } = await import('../../lib/redis');
      await redis.rename(LOCK_KEY(String(ticket_tier_id), 'temp'), LOCK_KEY(String(ticket_tier_id), String(booking.id)));
      await redis.expire(LOCK_KEY(String(ticket_tier_id), String(booking.id)), 900);

      void Promise.resolve(
        supabase.rpc('increment_reserved_quota', { p_tier_id: ticket_tier_id, p_quantity: quantity })
      ).catch(console.error);

      return {
        booking_id: booking.id,
        booking_number: bookingNumber,
        total_amount: totalAmount,
        platform_fee: platformFee,
        expires_at: expiresAt,
        items: { ticket_subtotal: ticketSubtotal, accommodation_subtotal: accommodationSubtotal },
      };
    } catch (err) {
      await releaseLock(ticket_tier_id, 'temp');
      throw err;
    }
  }

  async addAddons(
    bookingNumber: string,
    userId: number,
    addons: {
      hotel_id?: string;
      room_type_id?: string;
      transport_price?: number;
      hotel_meta?: Record<string, any>;
      outbound_meta?: Record<string, any>;
      return_meta?: Record<string, any>;
    }
  ) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, total_amount, platform_fee')
      .eq('booking_number', bookingNumber)
      .eq('user_id', userId)
      .single();

    if (!booking) throw new AppError('BOOKING_NOT_FOUND', 404);
    if (!['pending', 'awaiting_payment'].includes(booking.status)) {
      throw new AppError('BOOKING_NOT_PAYABLE', 400);
    }

    // Remove stale addon items so re-submitting replaces them
    await supabase
      .from('booking_items')
      .delete()
      .eq('booking_id', booking.id)
      .in('item_type', ['accommodation', 'outbound_transport', 'return_transport']);

    let addonTotal = 0;

    if (addons.hotel_id) {
      const { data: hotel } = await supabase
        .from('accommodations')
        .select('base_price, name')
        .eq('id', addons.hotel_id)
        .single();

      if (!hotel) {
        throw new AppError('HOTEL_NOT_FOUND', 404);
      }

      var basePrice = hotel.base_price;

      if (addons.room_type_id) {
        const { data: roomType } = await supabase
          .from('room_types')
          .select('price_per_night, name')
          .eq('id', addons.room_type_id)
          .eq('accommodation_id', addons.hotel_id)
          .single();

        if (roomType) {
          basePrice = roomType.price_per_night;
          addons.hotel_meta = {
            ...addons.hotel_meta,
            room_type_name: roomType.name,
          };
        }
      }

      if (hotel) {
        const nights        = addons.hotel_meta?.nights ?? 1;
        const roomQty       = addons.hotel_meta?.room_qty ?? 1;
        const extraFees     = addons.hotel_meta?.extra_fees ?? 0;
        const hotelSubtotal = basePrice * Math.max(1, nights) * Math.max(1, roomQty);
        addonTotal += hotelSubtotal + extraFees;
        await supabase.from('booking_items').insert({
          booking_id: booking.id,
          item_type: 'accommodation',
          accommodation_id: addons.hotel_id,
          quantity: nights * roomQty,
          unit_price: basePrice,
          subtotal: hotelSubtotal,   // base cost only; extra_fees live in metadata
          metadata: {
            name: hotel.name,
            ...addons.hotel_meta,
          },
        });
      }
    }

    if (addons.outbound_meta) {
      const price = addons.outbound_meta.price ?? 0;
      addonTotal += price;
      await supabase.from('booking_items').insert({
        booking_id: booking.id,
        item_type: 'outbound_transport',
        quantity: 1,
        unit_price: price,
        subtotal: price,
        metadata: addons.outbound_meta,
      });
    } else if (addons.transport_price && addons.transport_price > 0) {
      // Fallback for old clients that only send transport_price
      addonTotal += addons.transport_price;
      await supabase.from('booking_items').insert({
        booking_id: booking.id,
        item_type: 'outbound_transport',
        quantity: 1,
        unit_price: addons.transport_price,
        subtotal: addons.transport_price,
        metadata: { price: addons.transport_price },
      });
    }

    if (addons.return_meta) {
      const price = addons.return_meta.price ?? 0;
      addonTotal += price;
      await supabase.from('booking_items').insert({
        booking_id: booking.id,
        item_type: 'return_transport',
        quantity: 1,
        unit_price: price,
        subtotal: price,
        metadata: addons.return_meta,
      });
    }

    // Recalculate total from ticket subtotal + new addons + platform fee
    const { data: ticketItem } = await supabase
      .from('booking_items')
      .select('subtotal')
      .eq('booking_id', booking.id)
      .eq('item_type', 'ticket')
      .single();

    const ticketSubtotal = ticketItem?.subtotal ?? 0;
    const platformFee = booking.platform_fee ?? Math.round(ticketSubtotal * 0.03);
    const newTotal = ticketSubtotal + addonTotal + platformFee;

    await supabase
      .from('bookings')
      .update({ total_amount: newTotal })
      .eq('id', booking.id);

    return { ok: true };
  }

  async initiatePayment(bookingNumber: string, userId: number) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, users(full_name, email, phone)')
      .eq('booking_number', bookingNumber)
      .eq('user_id', userId)
      .single();

    if (!booking) throw new AppError('BOOKING_NOT_FOUND', 404);
    if (!['pending', 'awaiting_payment'].includes(booking.status)) {
      throw new AppError('BOOKING_NOT_PAYABLE', 400);
    }
    if (new Date(booking.expires_at) < new Date()) {
      throw new AppError('BOOKING_EXPIRED', 410);
    }

    const isDevMode = !process.env.MIDTRANS_SERVER_KEY ||
      process.env.MIDTRANS_SERVER_KEY.includes('xxxx');

    let paymentToken: string;

    if (isDevMode) {
      paymentToken = `dev-token-${booking.booking_number}`;
      await this.confirmBookingAndIssueTickets(booking.booking_number);
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', paid_at: new Date().toISOString() })
        .eq('booking_number', bookingNumber);
    } else {
      paymentToken = await createSnapTransaction({
        booking_number: booking.booking_number,
        total_amount: booking.total_amount,
        user: booking.users,
      });
      await supabase
        .from('bookings')
        .update({ status: 'awaiting_payment' })
        .eq('booking_number', bookingNumber);
    }

    return { payment_token: paymentToken, booking_number: booking.booking_number };
  }

  async getBookingDetail(bookingNumber: string, userId: number) {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, status, total_amount, platform_fee, notes, created_at, expires_at, paid_at,
        booking_items(
          id, item_type, quantity, unit_price, subtotal, metadata,
          ticket_tiers(name, price, event_id, events(id, title, start_at, end_at, banner_url, venues(name, city, address, latitude, longitude))),
          accommodations(id, name, type, city, address, star_rating, latitude, longitude),
          tickets(id, qr_code, status)
        )
      `)
      .eq('booking_number', bookingNumber)
      .eq('user_id', userId)
      .single();

    if (error || !booking) throw new AppError('BOOKING_NOT_FOUND', 404);
    return booking;
  }

  async getUserBookings(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count, error } = await supabase
      .from('bookings')
      .select(
        `id, booking_number, status, total_amount, platform_fee, notes, created_at,
         booking_items(
           item_type, quantity, unit_price, subtotal, metadata,
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

    for (const item of ticketItems) {
      await supabase.rpc('confirm_ticket_sale', {
        p_tier_id: item.ticket_tier_id,
        p_quantity: item.quantity,
      });
      await commitLock(item.ticket_tier_id, booking.id);
    }
  }
}
