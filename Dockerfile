# Image of the web app and ingress: nginx serves the Angular build and forwards
# /api and /mcp to the backend (server/Dockerfile) on loopback. On Cloud Run
# both run as containers of one service, locally via compose.yaml.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Runs as an unprivileged user and listens on $PORT (Cloud Run sets 8080).
FROM nginxinc/nginx-unprivileged:stable-alpine

# The image fills in the variables matching the filter (PORT, API_PORT) when it starts.
ENV PORT=8080 \
    API_PORT=8081 \
    NGINX_ENVSUBST_FILTER=PORT

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/backend-proxy.conf /etc/nginx/backend-proxy.conf

# Only the built app; the text modules are not part of it, the backend serves them.
COPY --from=builder /app/dist/zeugnisgenerator/browser /usr/share/nginx/zeugnisgenerator
# License notices of the bundled third-party packages, served at /3rdpartylicenses.txt
COPY --from=builder /app/dist/zeugnisgenerator/3rdpartylicenses.txt /usr/share/nginx/zeugnisgenerator/

EXPOSE 8080
