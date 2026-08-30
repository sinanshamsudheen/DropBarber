FROM oven/bun:1 AS build
WORKDIR /app

# Dependencies first so `docker compose build` only reinstalls them when
# bun.lock actually changes, not on every source edit.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Vite's `import.meta.env.VITE_*` values are baked into the compiled bundle
# at build time (there's no runtime equivalent) — a different backend
# origin needs a rebuild with a different --build-arg, not a container
# restart with a different -e.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# vite.config.ts's own default build target is `cloudflare-module` (a
# Workers bundle, not runnable by plain Node) — this backend-agnostic env
# var is Nitro's own override hook and takes precedence without touching
# that config.
ENV NITRO_PRESET=node_server

RUN bun run build

FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
