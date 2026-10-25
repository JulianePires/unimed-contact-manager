import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <App queryClient={queryClient} router={createAppRouter({ queryClient })} />
  </StrictMode>,
);
