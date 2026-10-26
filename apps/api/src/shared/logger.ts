import type { LoggerOptions } from 'pino';

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

/** Credenciais e dados pessoais (ADR-009 §2): ocultos em qualquer objeto logado, até 2 níveis. */
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'email',
  'mobile',
  'mobileE164',
  'phone',
  'phoneE164',
];

export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

/** Logger do Fastify (pino): JSON estruturado com `reqId` e redação de dados sensíveis. */
export function loggerOptions(env: Pick<Env, 'LOG_LEVEL'>): LoggerOptions {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACTED_PATHS,
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
