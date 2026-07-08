# Portfolio Maker

A Portfolio CMS: a public portfolio renderer backed entirely by the database, plus a hidden
admin dashboard. See [`docs/architecture.md`](docs/architecture.md) and
[`docs/database-design.md`](docs/database-design.md) for the full design — this README is
just the "how do I run it" reference.

Currently at milestone **M0** (foundation) — see `architecture.md` §15 for the roadmap.

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:
- `AUTH_SECRET` — generate with `pnpm dlx auth secret` (or `openssl rand -base64 32`).
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the one v1 admin account.
- `DATABASE_URL` — see below.

### Database

**Local (default):**

```bash
docker compose up -d      # or: docker-compose up -d
pnpm db:migrate
pnpm db:seed
```

**Production:** point `DATABASE_URL` at a pooled Vercel Postgres / Neon connection string
(`?pgbouncer=true` or the Neon-pooled host). No code change needed — same schema, same
migrations.

### Run

```bash
pnpm dev
```

- Public site: [http://localhost:3000](http://localhost:3000)
- Admin login: [http://localhost:3000/access](http://localhost:3000/access) (not linked from
  the public site — see architecture.md §13)

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | Seed the single workspace + owner user |
| `pnpm db:studio` | Prisma Studio |
