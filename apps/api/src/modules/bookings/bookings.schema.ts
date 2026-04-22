import { z } from 'zod';

export const CreateBookingSchema = z.object({
  ticket_tier_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  accommodation_id: z.string().uuid().optional(),
  accommodation_meta: z
    .object({
      check_in: z.string().date(),
      check_out: z.string().date(),
      room_type: z.string().optional(),
    })
    .optional(),
});

export type CreateBookingDTO = z.infer<typeof CreateBookingSchema>;
