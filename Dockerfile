# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts ./
COPY src ./src
COPY public ./public
COPY .env.development ./
RUN VITE_API_BASE_URL=/api npm run build -- --mode development

FROM nginxinc/nginx-unprivileged:1.30-alpine-slim AS runtime

ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

COPY .env.development /etc/ticket/development.env
COPY docker/15-ticket-env.envsh /docker-entrypoint.d/15-ticket-env.envsh
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

USER 101:101

EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5174/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
