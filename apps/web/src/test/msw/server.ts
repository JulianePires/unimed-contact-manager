import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/** API simulada na camada de rede (ADR-008): o código de produção usa o fetch real. */
export const server = setupServer(...handlers);
