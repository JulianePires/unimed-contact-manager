import { z } from 'zod';

/** Corpo de `GET /api/health/live` e `GET /api/health/ready` (docs/05). */
export const healthStatusSchema = z.object({ status: z.literal('ok') });
export type HealthStatus = z.infer<typeof healthStatusSchema>;
