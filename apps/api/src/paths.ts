import { fileURLToPath } from 'node:url';

// Relativos a src/ (tsx) e a dist/ (tsup), que ficam no mesmo nível de apps/api
const fromApiRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export const migrationsFolder = fromApiRoot('../drizzle');
export const defaultWebDistDir = fromApiRoot('../../web/dist');
