# Imagem única da aplicação (ADR-010, ADR-011): API + SPA + worker + migrate.
# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .

FROM node:24.22.1-alpine3.24 AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN pnpm turbo run build --filter=@contatos/web --filter=@contatos/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter=@contatos/api deploy --legacy --prod /prod/api

FROM node:24.22.1-alpine3.24 AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /repo/apps/web/dist /app/apps/web/dist
USER node
EXPOSE 3000
# Mesma imagem: `node dist/worker.js` (worker) e `node dist/migrate.js` (migrations)
CMD ["node", "dist/server.js"]
