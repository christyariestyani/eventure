import { nanoid } from 'nanoid';

export function generateBookingNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = nanoid(6).toUpperCase();
  return `EVT-${ymd}-${suffix}`;
}

export function generateQRToken(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return `TKT-${ymd}-${suffix}`;
}

export function bookingExpiresAt(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
