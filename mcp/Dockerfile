# Image of the MCP server. Build from the repository root:
#   docker build -f mcp/Dockerfile -t zeugnisgenerator-mcp .
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build:mcp

FROM node:22-alpine

WORKDIR /app

# The bundle contains the server, its dependencies and the text modules.
COPY --from=builder /app/dist/mcp ./

USER node

EXPOSE 8080

CMD ["node", "--enable-source-maps", "main.cjs"]
