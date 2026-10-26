import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import {
  contactSchema,
  fieldErrorSchema,
  healthStatusSchema,
  importErrorSchema,
  importSchema,
  problemDetailsSchema,
  userSchema,
} from '@contatos/contracts';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const DOCS_PATH = '/api/docs';

/** Versão do contrato (`/api/v1`), independente do bump de versão do pacote. */
const API_CONTRACT_VERSION = 'v1';

// Schemas compartilhados viram `components.schemas` com `$ref`, em vez de repetidos por rota
const COMPONENTS = [
  [problemDetailsSchema, 'ProblemDetails', 'Erro no formato RFC 9457 (application/problem+json)'],
  [fieldErrorSchema, 'FieldError', 'Erro de um campo em errors[]'],
  [contactSchema, 'Contact', 'Contato'],
  [importSchema, 'Import', 'Importação de CSV'],
  [importErrorSchema, 'ImportError', 'Linha rejeitada na importação'],
  [userSchema, 'User', 'Usuário autenticado'],
  [healthStatusSchema, 'HealthStatus', 'Saúde do serviço'],
] as const;
for (const [schema, id, description] of COMPONENTS) {
  z.globalRegistry.add(schema, { id, description });
}

/** Rotas de upload: o corpo é multipart e não passa pelo validador; só a documentação o descreve. */
export interface MultipartDocs {
  multipartFile?: { field: string; description: string };
}

const SESSION_COOKIE = 'sessionCookie';

/** Rotas abertas (cadastro, login, saúde) declaram `security: []`; as demais exigem o cookie. */
export const PUBLIC_ROUTE = { security: [] };

/** Respostas de erro em Problem Details (RFC 9457, docs/05 §5.2), por status. */
export function problemResponses(...statuses: number[]): Record<number, z.ZodType> {
  return Object.fromEntries(statuses.map((status) => [status, problemDetailsSchema]));
}

export const noContent = z.null().describe('Sem conteúdo');

const DESCRIPTION = [
  'API da Agenda Unimed (docs/05). Autenticação por cookie de sessão HttpOnly (ADR-006).',
  'Toda mutação (POST, PUT, PATCH, DELETE) exige o header `X-Requested-With: fetch` (CSRF);',
  'sem ele, a resposta é `403 CSRF_HEADER_MISSING`. Erros seguem Problem Details com `code` estável.',
].join(' ');

/**
 * OpenAPI 3.1 gerado dos schemas Zod das rotas (docs/05): `/api/docs` fora de produção e
 * exportado para `docs/openapi.json` por `pnpm openapi:export`.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Agenda Unimed', version: API_CONTRACT_VERSION, description: DESCRIPTION },
      tags: [
        { name: 'auth', description: 'Cadastro, sessão e usuário atual' },
        { name: 'contacts', description: 'Agenda de contatos' },
        { name: 'imports', description: 'Importação de contatos via CSV' },
        { name: 'health', description: 'Saúde do serviço' },
      ],
      components: {
        securitySchemes: {
          [SESSION_COOKIE]: { type: 'apiKey', in: 'cookie', name: '__Host-sid' },
        },
      },
      security: [{ [SESSION_COOKIE]: [] }],
    },
    transformObject: jsonSchemaTransformObject,
    transform: (input) => {
      const transformed = jsonSchemaTransform(input);
      const multipart = (input.route.config as MultipartDocs | undefined)?.multipartFile;
      if (!multipart) return transformed;
      return {
        ...transformed,
        schema: {
          ...transformed.schema,
          consumes: ['multipart/form-data'],
          body: {
            type: 'object',
            required: [multipart.field],
            properties: {
              [multipart.field]: {
                type: 'string',
                format: 'binary',
                description: multipart.description,
              },
            },
          },
        },
      };
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: DOCS_PATH });
}
