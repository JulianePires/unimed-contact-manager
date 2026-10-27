// Massa de carga para T-NF01–03, sem ler o .env (que pode apontar para produção):
//   DATABASE_URL=postgres://contatos:contatos@127.0.0.1:5432/contatos pnpm --filter @contatos/api perf:seed
import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { hashPassword } from '@/modules/auth/password-hasher';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { contacts, imports, type NewContact, users } from '@/shared/db/schema';

export const PERF_IMPORT_ID = '00000000-0000-4000-8000-00000000f001';

const FIRST_NAMES = ['Ana', 'Bruno', 'Cecília', 'Davi', 'Élida', 'Fábio', 'Gisele', 'Heitor'];
const LAST_NAMES = ['Silva', 'Araújo', 'Conceição', 'Lima', 'Ferreira', 'Melo', 'Gonçalves'];

const rowCount = Number(process.argv[2] ?? 10_000);
const email = process.env['PERF_EMAIL'] ?? 'perf@contatos.app';
const password = process.env['PERF_PASSWORD'] ?? 'perf-contatos-2026';
const env = loadEnv();
const db = createDatabase(env.DATABASE_URL);

try {
  const [existing] = await db.orm
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  const [user] = existing
    ? [existing]
    : await db.orm
        .insert(users)
        .values({ email, name: 'Carga de performance', passwordHash: await hashPassword(password) })
        .returning({ id: users.id });
  if (!user) throw new Error('Não foi possível criar o usuário de carga');

  const rows: NewContact[] = Array.from({ length: rowCount }, (_, index) => {
    const n = index + 1;
    const first = FIRST_NAMES[n % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(n / FIRST_NAMES.length) % LAST_NAMES.length];
    return {
      ownerId: user.id,
      name: `${first} ${last} ${n}`,
      email: `carga${n}@empresa.com`,
      mobileE164: `+55819${String(20_000_000 + n)}`,
      isFavorite: n % 10 === 0,
    };
  });
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 1_000) {
    const result = await db.orm
      .insert(contacts)
      .values(rows.slice(offset, offset + 1_000))
      .onConflictDoNothing({ target: [contacts.ownerId, contacts.mobileE164] })
      .returning({ id: contacts.id });
    inserted += result.length;
  }

  const finishedAt = new Date();
  await db.orm
    .insert(imports)
    .values({
      id: PERF_IMPORT_ID,
      ownerId: user.id,
      fileName: 'carga-performance.csv',
      fileSha256: createHash('sha256').update('seed:carga-performance.csv').digest('hex'),
      status: 'COMPLETED',
      totalRows: rowCount,
      processedRows: rowCount,
      createdCount: rowCount,
      createdAt: finishedAt,
      startedAt: finishedAt,
      finishedAt,
    })
    .onConflictDoNothing({ target: imports.id });

  process.stdout.write(
    `Usuário: ${email}\nContatos inseridos agora: ${inserted} (alvo: ${rowCount})\nImportação: ${PERF_IMPORT_ID}\n`,
  );
} finally {
  await db.close();
}
