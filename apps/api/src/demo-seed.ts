import { createHash } from 'node:crypto';

import { type FieldError, normalizeMobile, normalizePhone } from '@contatos/contracts';
import { and, eq } from 'drizzle-orm';

import { hashPassword } from '@/modules/auth/password-hasher';
import type { Orm } from '@/shared/db/client';
import { contacts, importErrors, imports, type NewContact, users } from '@/shared/db/schema';
import { withTransaction } from '@/shared/db/transaction';

/** Conta de avaliação (ADR-006); as credenciais estão no README. */
export const DEMO_EMAIL = 'demo@contatos.app';
export const DEMO_SECRET = 'demo-contatos-2026';

interface DemoContact {
  name: string;
  mobile: string;
  phone?: string;
  favorite?: boolean;
  inactive?: boolean;
}

/** ~30 contatos com ativos, inativos (um deles favorito) e favoritos, para a avaliação. */
const DEMO_CONTACTS: DemoContact[] = [
  { name: 'Ana Beatriz Lima', mobile: '(81) 99101-0001', favorite: true },
  { name: 'André Costa', mobile: '(81) 99101-0002', phone: '(81) 3301-0002' },
  { name: 'Bruna Araújo', mobile: '(81) 99101-0003' },
  { name: 'Caio Nascimento', mobile: '(81) 99101-0004', inactive: true },
  { name: 'Camila Rocha', mobile: '(81) 99101-0005', favorite: true },
  { name: 'Carlos Eduardo Melo', mobile: '(81) 99101-0006' },
  { name: 'Daniela Freitas', mobile: '(81) 99101-0007', phone: '(81) 3301-0007' },
  { name: 'Diego Albuquerque', mobile: '(81) 99101-0008' },
  { name: 'Eduarda Pires', mobile: '(81) 99101-0009', inactive: true },
  { name: 'Fernanda Gomes', mobile: '(81) 99101-0010', favorite: true },
  { name: 'Gabriel Nunes', mobile: '(81) 99101-0011' },
  { name: 'Helena Barros', mobile: '(81) 99101-0012' },
  { name: 'Igor Teixeira', mobile: '(81) 99101-0013', phone: '(81) 3301-0013' },
  { name: 'Joana Dias', mobile: '(81) 99101-0014', inactive: true, favorite: true },
  { name: 'João Souza', mobile: '(81) 99101-0015' },
  { name: 'Júlia Martins', mobile: '(81) 99101-0016', favorite: true },
  { name: 'Lucas Ribeiro', mobile: '(81) 99101-0017' },
  { name: 'Luíza Cavalcanti', mobile: '(81) 99101-0018' },
  { name: 'Marcos Vinícius', mobile: '(81) 99101-0019', inactive: true },
  { name: 'Mariana Alves', mobile: '(81) 99101-0020', phone: '(81) 3301-0020' },
  { name: 'Natália Cardoso', mobile: '(81) 99101-0021' },
  { name: 'Otávio Moreira', mobile: '(81) 99101-0022', favorite: true },
  { name: 'Paula Cristina', mobile: '(81) 99101-0023' },
  { name: 'Rafael Monteiro', mobile: '(81) 99101-0024' },
  { name: 'Renata Duarte', mobile: '(81) 99101-0025', inactive: true },
  { name: 'Sérgio Batista', mobile: '(81) 99101-0026' },
  { name: 'Tatiane Lopes', mobile: '(81) 99101-0027', favorite: true },
  { name: 'Thiago Farias', mobile: '(81) 99101-0028' },
  { name: 'Vítor Hugo', mobile: '(81) 99101-0029' },
  { name: 'Yasmin Correia', mobile: '+1 415 555 2671' },
];

const DEMO_IMPORT_FILE = 'contatos-demo.csv';

/** Linhas rejeitadas da importação de exemplo (docs/05 §5.5). */
const DEMO_IMPORT_ERRORS: {
  lineNumber: number;
  raw: Record<string, string>;
  errors: FieldError[];
}[] = [
  {
    lineNumber: 8,
    raw: {
      nome: 'Rodrigo Prado',
      email: 'rodrigo.prado@',
      celular: '(81) 99101-0099',
      telefone: '',
    },
    errors: [{ field: 'email', code: 'INVALID_EMAIL', message: 'Informe um e-mail válido.' }],
  },
  {
    lineNumber: 15,
    raw: {
      nome: 'Silvia Rego',
      email: 'silvia@empresa.com',
      celular: '(81) 3301-0015',
      telefone: '',
    },
    errors: [
      {
        field: 'celular',
        code: 'NOT_A_MOBILE_NUMBER',
        message: 'Informe um número de celular válido.',
      },
    ],
  },
  {
    lineNumber: 22,
    raw: {
      nome: 'Ana B. Lima',
      email: 'ana.b@empresa.com',
      celular: '(81) 99101-0001',
      telefone: '',
    },
    errors: [
      {
        field: 'celular',
        code: 'DUPLICATE_IN_FILE',
        message: 'Celular repetido no arquivo (primeira ocorrência na linha 2).',
      },
    ],
  },
];

function emailOf(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.');
  return `${slug}@empresa.com`;
}

function e164(input: string): string {
  const result = normalizeMobile(input);
  if (!result.ok) throw new Error(`Celular inválido no seed: ${input}`);
  return result.e164;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export interface DemoSeedResult {
  userCreated: boolean;
  contactsCreated: number;
  importCreated: boolean;
}

/**
 * Dados de avaliação, idempotentes: a conta só é criada se não existir; contatos entram com
 * `ON CONFLICT DO NOTHING` na unicidade do celular (ADR-001), sem sobrescrever o que foi alterado
 * na demo; a importação de exemplo é reconhecida pelo hash do arquivo (ADR-002).
 */
export async function seedDemo(orm: Orm, now = new Date()): Promise<DemoSeedResult> {
  return withTransaction(orm, async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, DEMO_EMAIL));
    const [created] = existing
      ? []
      : await tx
          .insert(users)
          .values({
            email: DEMO_EMAIL,
            name: 'Pessoa Demo',
            passwordHash: await hashPassword(DEMO_SECRET),
          })
          .returning({ id: users.id });
    const ownerId = existing?.id ?? created?.id;
    if (!ownerId) throw new Error('Não foi possível criar a conta demo');

    const rows: NewContact[] = DEMO_CONTACTS.map((contact, index) => {
      const createdAt = daysAgo(now, DEMO_CONTACTS.length - index);
      return {
        ownerId,
        name: contact.name,
        email: emailOf(contact.name),
        mobileE164: e164(contact.mobile),
        phoneE164: contact.phone ? (normalizePhone(contact.phone)?.e164 ?? null) : null,
        isFavorite: contact.favorite ?? false,
        deactivatedAt: contact.inactive ? daysAgo(now, 1) : null,
        createdAt,
        updatedAt: createdAt,
      };
    });
    const inserted = await tx
      .insert(contacts)
      .values(rows)
      .onConflictDoNothing({ target: [contacts.ownerId, contacts.mobileE164] })
      .returning({ id: contacts.id });

    const fileSha256 = createHash('sha256').update(`seed:${DEMO_IMPORT_FILE}`).digest('hex');
    const [previousImport] = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(and(eq(imports.ownerId, ownerId), eq(imports.fileSha256, fileSha256)));
    if (!previousImport) {
      const finishedAt = daysAgo(now, 2);
      const [demoImport] = await tx
        .insert(imports)
        .values({
          ownerId,
          fileName: DEMO_IMPORT_FILE,
          fileSha256,
          status: 'COMPLETED_WITH_ERRORS',
          totalRows: 34,
          processedRows: 34,
          createdCount: 30,
          skippedCount: 1,
          failedCount: DEMO_IMPORT_ERRORS.length,
          createdAt: finishedAt,
          startedAt: finishedAt,
          finishedAt,
        })
        .returning({ id: imports.id });
      if (!demoImport) throw new Error('Não foi possível criar a importação demo');
      await tx
        .insert(importErrors)
        .values(DEMO_IMPORT_ERRORS.map((row) => ({ importId: demoImport.id, ...row })));
    }

    return {
      userCreated: created !== undefined,
      contactsCreated: inserted.length,
      importCreated: !previousImport,
    };
  });
}
