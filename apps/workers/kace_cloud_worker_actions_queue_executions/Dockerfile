# syntax=docker/dockerfile:1.7
# Build context: monorepo root (set by CDK DockerImageAsset.directory).
#
# Strategy: bundle the worker source + all workspace deps (including @kace/core
# which uses bare directory imports internally) into a single ESM file via
# esbuild during the builder stage. Mirrors what aws-cdk-lib's NodejsFunction
# does for the existing Lambda services. Without bundling, Node 22 ESM strict
# mode rejects @kace/core's internal directory imports at runtime.

# Base pineada por digest (§6.3): un tag es un puntero mutable.
# node:22-alpine, resuelto 2026-08-24 (re-verificado 2026-08-25, mismo digest).
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
WORKDIR /repo
RUN apk add --no-cache git \
 && corepack enable \
 && corepack prepare pnpm@10.11.0 --activate

# Copy all workspace metadata so pnpm can build the dependency graph.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/workers/kace_cloud_worker_actions_queue_executions ./apps/workers/kace_cloud_worker_actions_queue_executions

# Install ALL deps (including dev) — we need esbuild for bundling.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Bundle src/index.mjs and the entire dependency graph into a single ESM file.
# Knex's optional non-pg drivers are excluded; they are loaded lazily by Knex
# only when the corresponding dialect is configured. We only use pg.
WORKDIR /repo/apps/workers/kace_cloud_worker_actions_queue_executions
RUN mkdir -p /dist \
 && pnpm exec esbuild src/index.mjs \
        --bundle \
        --platform=node \
        --target=node22 \
        --format=esm \
        --outfile=/dist/index.mjs \
        --external:pg-native \
        --external:pg-query-stream \
        --external:tedious \
        --external:oracledb \
        --external:mysql \
        --external:mysql2 \
        --external:sqlite3 \
        --external:better-sqlite3 \
        --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
        --log-level=warning \
        --sourcemap=inline

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime
WORKDIR /app
# npm/npx/yarn no se usan en runtime: el arranque es `node index.mjs` sobre un
# bundle ESM unico. Sus dependencias empaquetadas aportaban 1 CRITICAL + 8 HIGH
# (tar 7.5.11, brace-expansion, ip-address, picomatch, sigstore) que los
# overrides de pnpm NO alcanzan, porque viven dentro de la imagen base y no en
# el lockfile. Borrarlos deja el escaneo en 0. Verificado 2026-08-24.
# La base pineada trae OpenSSL 3.5.7-r0; subir solo sus paquetes corrige
# CVE-2026-14456 sin mover el digest de Node verificado.
RUN apk add --no-cache --upgrade curl tini libcrypto3 libssl3 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
        /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && addgroup -S worker \
 && adduser -S worker -G worker
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
COPY --from=builder --chown=worker:worker /dist/index.mjs /app/index.mjs
USER worker
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.mjs"]
