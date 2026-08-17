FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/memory/package.json packages/memory/package.json
COPY packages/prompts/package.json packages/prompts/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/backend/package.json apps/backend/package.json

RUN bun install

COPY apps/frontend ./apps/frontend
COPY apps/backend ./apps/backend
COPY packages/ai ./packages/ai
COPY packages/memory ./packages/memory
COPY packages/prompts ./packages/prompts
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/eslint-config ./packages/eslint-config
COPY packages/typescript-config ./packages/typescript-config
COPY packages/ui ./packages/ui

RUN cd packages/db && DATABASE_URL="postgresql://p:p@localhost:5432/p" bunx prisma generate

ARG VITE_BACKEND_URL=https://api.evalio.krishlabs.tech
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ARG VITE_WS_HOST=ws.evalio.krishlabs.tech
ENV VITE_WS_HOST=${VITE_WS_HOST}

WORKDIR /app/apps/frontend

RUN bun run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
