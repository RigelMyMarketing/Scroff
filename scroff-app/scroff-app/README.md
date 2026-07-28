# Scroff 🪙 — Scratch & Win

A toilet-bowl themed scratch-and-win lucky draw. Players pick one of 50 bowls,
scratch the latex off a ticket, and see what they've won. Admins configure the
prize pool (with real photos), how many turns each player gets, and publish
changes live.

This is a real, deployable full-stack app — not a demo. It's split into two
independently-runnable projects that ship together as one deployment:

```
scroff/
├── server/     Node/Express API + SQLite (via Prisma) + auth + uploads
├── client/     React (Vite) frontend
├── Dockerfile          single-container production build
├── docker-compose.yml  one-command deploy
└── package.json        root convenience scripts for local dev
```

## How it works

- **Players never log in.** The first time a browser hits the API it's handed
  a random, httpOnly session cookie. That cookie is the player's identity for
  turns, their board, and their "My Prizes" list. There's no personal data to
  manage — just an anonymous per-browser session.
- **Admins have real accounts.** Username + bcrypt-hashed password, JWT
  session cookie, completely separate from the player session. Seeded from
  environment variables the first time the server starts (see below) — change
  the password after logging in for the first time in a real deployment.
- **Boards are per-player, not one shared shrinking inventory.** The admin
  defines a *distribution* (e.g. "5 out of 50 slots are a coffee voucher").
  Each player gets their own freshly shuffled 50-cell board built from that
  distribution. When a player uses all their turns (or the admin publishes a
  change), their board — and their prize history — resets to a brand new
  shuffle. This is what makes "the pool refreshes after all turns are spent"
  work sensibly with many concurrent players instead of everyone fighting
  over one literal set of 50 cards.
- **"One more time" prizes refund the turn.** Any prize type can be flagged
  `isFreeRetry`. Landing on it still uses up that bowl, but the turn itself is
  credited back the moment the player finishes scratching it off.
- **Prizes stay hidden until 80% scratched.** The scratch canvas samples its
  own alpha channel as the player scratches and only reveals the prize (and
  fires the win-recording API call) once 80% of the latex is gone.

## Project structure (server)

```
server/
├── prisma/schema.prisma   data model — the source of truth for the DB shape
├── prisma/seed.js         creates the first admin + default prize pool
├── src/
│   ├── app.js             express app assembly (routes, static files)
│   ├── index.js           entrypoint — runs the seed, then starts listening
│   ├── lib/
│   │   ├── auth.js        password hashing + admin JWT
│   │   ├── session.js     anonymous player session cookie
│   │   ├── board.js       pure board-shuffle logic (no DB — easy to test)
│   │   ├── uploadStorage.js  local-disk photo storage (swap for S3 later)
│   │   └── prisma.js      shared Prisma client instance
│   ├── middleware/requireAdmin.js
│   └── routes/
│       ├── auth.routes.js    admin login/logout/me
│       ├── admin.routes.js   prize CRUD, photo upload, settings, publish
│       └── game.routes.js    board state, pick a bowl, reveal a scratch
```

## Project structure (client)

```
client/src/
├── pages/
│   ├── RoleSelect.jsx      landing page — choose Player or Admin
│   ├── PlayHome.jsx        the game itself
│   ├── AdminLogin.jsx
│   └── AdminDashboard.jsx  prize pool manager + settings + publish
├── components/
│   ├── BowlGrid.jsx        the 10×5 board
│   ├── ScratchCard.jsx     canvas scratch-off ticket
│   ├── PrizeRow.jsx        one editable prize row in the admin dashboard
│   └── Coin.jsx            the logo
└── lib/
    ├── api.js              fetch wrapper (credentials, error handling)
    └── confetti.js         win celebration effect
```

## Running it locally

You'll need Node 20+ installed.

```bash
# from the repo root
npm run install:all          # installs server + client dependencies

cp server/.env.example server/.env
# edit server/.env — at minimum set a real JWT_SECRET and admin password

npm run prisma:migrate       # creates the SQLite database + tables
npm run dev                  # runs the API (:4000) and the client (:5173) together
```

Open `http://localhost:5173`. The client proxies `/api` and `/uploads` to the
server in dev, so cookies work without any CORS setup.

The first time the server starts, it automatically creates an admin account
from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in your `.env`, plus a default
50-slot prize pool, so the app is playable immediately.

## Deploying it live

The simplest path is the included Docker setup — it builds the client, and
the server serves it directly, so it's a single process/container:

```bash
cp server/.env.example .env    # docker compose reads a root .env file
# edit .env: JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

docker compose up -d --build
```

This works as-is on any VPS with Docker, or on platforms like Railway,
Render, or Fly.io that can build from a Dockerfile. The SQLite database and
uploaded photos are stored in Docker volumes so they survive redeploys.

If you deploy behind HTTPS (you should, for real users), the app already
marks its cookies `secure` automatically when `NODE_ENV=production` is set —
which the Dockerfile does for you.

### Scaling beyond SQLite

SQLite is genuinely fine for a single-server deployment with moderate
traffic. If you outgrow it — multiple server instances, heavier concurrent
writes — moving to Postgres is a small, contained change:

1. In `server/prisma/schema.prisma`, change `provider = "sqlite"` to
   `provider = "postgresql"`.
2. Point `DATABASE_URL` at your Postgres instance.
3. Run `npx prisma migrate dev` (locally) or `prisma migrate deploy` (in
   production) to create the same tables there.

No application code changes — every query goes through Prisma, which is the
whole point of using it here.

### Swapping photo storage for cloud storage

`server/src/lib/uploadStorage.js` is the only file that knows prize photos
live on local disk. If you need photos to survive across multiple server
instances (or just prefer S3/Cloudinary), replace the `multer.diskStorage`
engine in that one file with an S3-backed multer storage engine and update
`publicUrlFor` to return the remote URL — nothing in the routes or the client
needs to change.

## Security notes for a real deployment

- Change `ADMIN_PASSWORD` immediately — the seeded one is only meant to get
  you into the dashboard the first time.
- Generate a real `JWT_SECRET` (`openssl rand -hex 32`), not the placeholder
  in `.env.example`.
- The admin dashboard has no rate-limiting on login attempts yet. For a
  public deployment, consider adding a login rate-limiter (e.g.
  `express-rate-limit`) in front of `POST /api/auth/login`.
- Player "accounts" are just anonymous cookies — there's no way to recover a
  session if someone clears cookies or switches devices, by design. If you
  later need real player accounts (e.g. to redeem prizes by name/phone
  number), that's a contained addition: a `Player` model in
  `schema.prisma`, a login/registration flow next to `auth.routes.js`, and
  swapping `req.sessionId` for `req.player.id` in `game.routes.js`.

## Extending the game

Because prize types, board generation, and the scratch mechanic are each in
their own small file, common requests are localized:

- **Change the board size or shape:** `BOARD_SIZE` in `server/src/lib/board.js`
  and the `.grid-10x5` CSS rule in `client/src/styles.css`.
- **Change the reveal threshold:** `REVEAL_THRESHOLD` in
  `client/src/components/ScratchCard.jsx`.
- **Add a new kind of special prize** (like "One more time"): add a boolean
  column to `PrizeType` in `schema.prisma`, a checkbox in `PrizeRow.jsx`, and
  a branch in `POST /api/game/reveal` in `game.routes.js` — the same pattern
  `isFreeRetry` already follows.
