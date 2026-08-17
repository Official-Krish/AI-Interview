FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/memory/package.json packages/memory/package.json
COPY packages/prompts/package.json packages/prompts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN bun install

COPY apps/backend ./apps/backend
COPY packages/ai ./packages/ai
COPY packages/memory ./packages/memory
COPY packages/prompts ./packages/prompts
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/eslint-config ./packages/eslint-config
COPY packages/typescript-config ./packages/typescript-config

RUN cd packages/db && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" bun --bun run prisma generate

WORKDIR /app/apps/backend
RUN bun run build

FROM oven/bun:1 AS runtime

WORKDIR /app/apps/backend

ENV NODE_ENV=production

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/backend /app/apps/backend
COPY --from=builder /app/packages /app/packages

EXPOSE 3000

CMD ["bun", "dist/index.js"]
