import type { FastifyServerOptions } from 'fastify';

import type { Env } from './config/env';

/** Parâmetros de busca que nunca vão para o log (ADR-009: o termo `q` pode conter dados pessoais). */
const SENSITIVE_PARAMS = ['q'];

export function redactSearchParams(url: string): string {
  const [path = '', query] = url.split('?', 2);
  if (query === undefined) return url;
  const params = new URLSearchParams(query);
  for (const key of SENSITIVE_PARAMS) {
    if (params.has(key)) params.set(key, '[REDACTED]');
  }
  return `${path}?${params.toString()}`;
}

/** Logger do Fastify (pino): JSON estruturado com `reqId` e redação de dados sensíveis. */
export function loggerOptions(env: Pick<Env, 'LOG_LEVEL'>): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        url: redactSearchParams(req.url),
      }),
    },
  };
}
