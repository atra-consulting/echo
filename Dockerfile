FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app

# Only the built app and the static file server, keeps the image small
COPY --from=builder /app/dist/zeugnisgenerator/browser ./dist
# License notices of the bundled third-party packages, served at /3rdpartylicenses.txt
COPY --from=builder /app/dist/zeugnisgenerator/3rdpartylicenses.txt ./dist/

RUN npm install -g serve@14

EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
