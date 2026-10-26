import { type HealthStatus, healthStatusSchema } from '@contatos/contracts';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import type { Database } from '../db/client';
import { AppError } from '../errors';
import { PUBLIC_ROUTE, problemResponses } from './openapi';

const tags = ['health'];

/** `live`: o processo responde. `ready`: o banco está acessível (docs/03, health checks do Render). */
export const healthRoutes: FastifyPluginCallbackZod<{ db: Pick<Database, 'ping'> }> = (
  app,
  { db },
  done,
) => {
  app.get(
    '/api/health/live',
    {
      schema: {
        tags,
        summary: 'O processo responde',
        ...PUBLIC_ROUTE,
        response: { 200: healthStatusSchema },
      },
    },
    (): HealthStatus => ({ status: 'ok' }),
  );

  app.get(
    '/api/health/ready',
    {
      schema: {
        tags,
        summary: 'O banco está acessível',
        ...PUBLIC_ROUTE,
        response: { 200: healthStatusSchema, ...problemResponses(503) },
      },
    },
    async (request): Promise<HealthStatus> => {
      try {
        await db.ping();
      } catch (error) {
        request.log.warn({ err: error }, 'banco indisponível');
        throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Serviço indisponível');
      }
      return { status: 'ok' };
    },
  );

  done();
};
