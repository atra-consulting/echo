# Image of the backend: REST API (/api) and MCP server (/mcp). Build from the
# repository root:
#   docker build -f server/Dockerfile -t zeugnisgenerator-backend .
# It listens on 127.0.0.1:8081 by default and is reached through the ingress
# (Dockerfile in the root); see README section "Backend" for the variables.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build:server

FROM node:22-alpine

WORKDIR /app

# The bundle contains the server, its dependencies and the text modules; next
# to it node_modules with the Firestore client, which cannot be bundled.
COPY --from=builder /app/dist/server ./

USER node

ENV API_PORT=8081

EXPOSE 8081

CMD ["node", "--enable-source-maps", "main.cjs"]
