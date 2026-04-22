import MidtransClient from 'midtrans-client';

export const snap = new MidtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export interface BookingForPayment {
  booking_number: string;
  total_amount: number;
  user: { full_name: string; email: string; phone?: string };
}

export async function createSnapTransaction(booking: BookingForPayment) {
  const token = await snap.createTransactionToken({
    transaction_details: {
      order_id: booking.booking_number,
      gross_amount: Math.round(booking.total_amount),
    },
    customer_details: {
      first_name: booking.user.full_name,
      email: booking.user.email,
      phone: booking.user.phone,
    },
    callbacks: {
      finish: `eventure://booking/status?order_id=${booking.booking_number}`,
    },
    expiry: { duration: 15, unit: 'minutes' },
  });

  return token as string;
}

export function verifyWebhookSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHash('sha512')
    .update(
      `${payload.order_id}${payload.status_code}${payload.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`
    )
    .digest('hex');
  return hash === payload.signature_key;
}
