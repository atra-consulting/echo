# Image of the backend: REST API (/api) and MCP server (/mcp). Build from the
# repository root:
#   docker build -f server/Dockerfile -t zeugnisgenerator-backend .
# It listens on 127.0.0.1:8081 by default and is reached through the ingress
# (Dockerfile in the root); see README section "Backend" for the variables.
#
# Builds on Node 26 (Debian 13) and runs on distroless Node 26 (Debian 13): the
# final image has no shell and no package manager and runs as the unprivileged
# user nonroot (UID 65532).
FROM node:26-trixie-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build:server

FROM gcr.io/distroless/nodejs26-debian13:nonroot

WORKDIR /app

# The bundle contains the server, its dependencies and the text modules; next
# to it node_modules with the Firestore client, which cannot be bundled.
COPY --from=builder /app/dist/server ./

ENV API_PORT=8081

EXPOSE 8081

# Exec form without a shell: the entrypoint of the image is node itself.
CMD ["--enable-source-maps", "main.cjs"]
