import { z } from 'zod';

export const GetEventsQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  category: z.enum(['music', 'sports', 'festival', 'conference']).optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetEventsQuery = z.infer<typeof GetEventsQuerySchema>;
