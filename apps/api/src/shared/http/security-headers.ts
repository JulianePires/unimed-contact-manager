import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

/** Marcador no `index.html` do SPA trocado pelo nonce de estilo de cada resposta. */
export const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE__';

/** Recursos do navegador que a aplicação não usa ficam desligados. */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'browsing-topics=()',
].join(', ');

/** HSTS de 2 anos com subdomínios, só em produção (HTTPS obrigatório, ADR-009 §5). */
const HSTS = { maxAge: 63_072_000, includeSubDomains: true };

/**
 * Headers de segurança (ADR-008, RNF03). CSP estrita sem `unsafe-inline`: scripts só da própria
 * origem; Trusted Types obrigatórios, com uma única política (`default`, criada pelo front);
 * estilos da origem ou com o nonce da resposta, usado pelos estilos que o Radix injeta em tempo
 * de execução. Sem frames, plugins nem formulários externos.
 */
export async function registerSecurityHeaders(
  app: FastifyInstance,
  { production }: { production: boolean },
): Promise<void> {
  await app.register(helmet, {
    enableCSPNonces: true,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        requireTrustedTypesFor: ["'script'"],
        trustedTypes: ['default'],
        ...(production ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: production ? HSTS : false,
    referrerPolicy: { policy: 'no-referrer' },
  });
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('permissions-policy', PERMISSIONS_POLICY);
  });
}
