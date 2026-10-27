import { eq } from 'drizzle-orm';

import { hashPassword } from '@/modules/auth/password-hasher';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { contacts, users } from '@/shared/db/schema';

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
  const [user] =
    existing === undefined
      ? await db.orm
          .insert(users)
          .values({
            email,
            name: 'Carga de performance',
            passwordHash: await hashPassword(password),
          })
          .returning({ id: users.id })
      : [existing];
  if (!user) throw new Error('Não foi possível criar o usuário de carga');

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const n = index + 1;
    return {
      ownerId: user.id,
      name: `Contato de carga ${n}`,
      email: `carga${n}@empresa.com`,
      mobileE164: `+55819${String(20_000_000 + n).padStart(8, '0')}`,
    };
  });
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 1) {
    const batch = rows.slice(offset, offset + 500);
    const result = await db.orm
      .insert(contacts)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: contacts.id });
    inserted += result.length;
  }
  process.stdout.write(`Usuário: ${email}\nContatos inseridos: ${inserted}; alvo: ${rowCount}\n`);
} finally {
  await db.close();
}
