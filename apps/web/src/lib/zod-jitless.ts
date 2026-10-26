import { z } from 'zod';

// Importado antes de qualquer schema: o Zod lê esta opção ao criar cada schema. Sem ela, testa
// `new Function`, que a CSP com Trusted Types bloqueia e reporta como violação (ADR-008).
z.config({ jitless: true });
