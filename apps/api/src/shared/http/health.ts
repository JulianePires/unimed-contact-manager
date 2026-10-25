import type { HealthStatus } from '@contatos/contracts';
import type { FastifyPluginCallback } from 'fastify';

import type { Database } from '../db/client';
import { AppError } from '../errors';

/** `live`: o processo responde. `ready`: o banco está acessível (docs/03, health checks do Render). */
export const healthRoutes: FastifyPluginCallback<{ db: Pick<Database, 'ping'> }> = (
  app,
  { db },
  done,
) => {
  app.get('/api/health/live', (): HealthStatus => ({ status: 'ok' }));

  app.get('/api/health/ready', async (request): Promise<HealthStatus> => {
    try {
      await db.ping();
    } catch (error) {
      request.log.warn({ err: error }, 'banco indisponível');
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Serviço indisponível');
    }
    return { status: 'ok' };
  });

  done();
};
