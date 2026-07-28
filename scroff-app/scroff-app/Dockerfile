# Builds the client, installs the server, and runs everything as one
# process — the server serves the built client directly (see
# server/src/app.js), so there's only one container to deploy anywhere
# that runs Docker (Fly.io, Railway, a plain VPS, etc).

FROM node:22-alpine AS client-build
WORKDIR /repo/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /repo

# Alpine doesn't ship OpenSSL by default, but Prisma's query engine needs it
# to detect which engine binary to use at runtime. Without this, Prisma
# crashes on startup with a "could not parse schema engine response" error.
RUN apk add --no-cache openssl

# Server dependencies (production only)
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

# Server source + Prisma schema
COPY server/ ./server/
RUN npx --prefix server prisma generate --schema=./server/prisma/schema.prisma

# Built client, served statically by the server (see server/src/app.js)
COPY --from=client-build /repo/client/dist ./client/dist

# SQLite database + uploaded photos live here — mount this as a volume so
# they survive container restarts/redeploys.
VOLUME ["/repo/server/prisma", "/repo/server/uploads"]

ENV NODE_ENV=production
ENV DATABASE_URL="file:./prod.db"
ENV PORT=4000
EXPOSE 4000

# Applies any pending migrations, then starts the server (which also
# seeds the first admin account + default prize pool if the DB is empty).
CMD ["sh", "-c", "npx --prefix server prisma migrate deploy --schema=./server/prisma/schema.prisma && node server/src/index.js"]
