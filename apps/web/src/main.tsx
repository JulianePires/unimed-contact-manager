import './index.css';
import './lib/zod-jitless';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { applyCspNonce } from './lib/csp-nonce';
import { createQueryClient } from './lib/query-client';
import { installTrustedTypesPolicy } from './lib/trusted-types';
import { createAppRouter } from './router';

installTrustedTypesPolicy();
applyCspNonce();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <App queryClient={queryClient} router={createAppRouter({ queryClient })} />
  </StrictMode>,
);
