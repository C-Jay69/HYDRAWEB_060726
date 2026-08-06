# HydraWeb

**AI-powered website generation and vibe coding** — describe a website in plain English, get a
production-ready site with frontend, backend and database, refine it together with an AI copilot,
and deploy it on your own subdomain.

This is a production-oriented MVP: no stubs, no mock data, real Stripe billing, real auth,
real database migrations, real deployments.

## Features

- **AI website generation** — a prompt becomes HTML/CSS/browser JS, a FastAPI backend, and a
  Postgres schema, streamed to the editor via SSE and saved as a version.
- **Vibe coding** — a chat copilot proposes diffs to your site; review and apply them, or dismiss.
- **Visual editing** — a GrapesJS canvas on top of every generated version.
- **Versioning & rollback** — every generation and applied suggestion is persisted; roll back any time.
- **Deployments** — publish to `{subdomain}.myplatform.dev` (static hosting served from this API).
- **Teams** — owners, editors and viewers share projects.
- **Billing** — Stripe subscriptions (Free / Pro / Enterprise), invoices, customer portal,
  and one-time payments for premium generations.
- **API keys** — `hw_*` keys with per-plan rate limits for programmatic access.
- **Rate limiting** — Redis sliding-window limits per user + path, based on plan.
- **Admin portal** — `/admin` dashboard with platform analytics (users, projects, deployments,
  LLM usage, revenue) and moderation (ban/unban, promote/demote). Admins bypass all plan limits.

## Monorepo layout

```
.
├── apps/web/            Next.js 14 frontend (App Router, Tailwind, GrapesJS)
│   ├── app/             Pages + API route handlers (proxy to backend)
│   ├── components/      UI kit, app shell, editor, vibe chat panel
│   └── lib/             api client, SSE streaming, auth, types
├── services/api/        FastAPI backend
│   ├── app/
│   │   ├── routes/      auth, users, projects, generate, deploy, billing, teams, admin
│   │   ├── llm/         OpenRouter streaming + mock fallback
│   │   ├── services/    versions, deploy, export, stripe, rate limiting, email
│   │   └── models.py    SQLAlchemy models (User, Project, Version, Chat, Billing, Teams)
│   ├── alembic/         Migrations
│   └── tests/           pytest suite (SQLite in-memory)
├── infra/               docker-compose for Postgres + Redis (and optional full-stack)
├── .github/workflows/   CI for backend and frontend
└── .env.example         All configuration knobs
```

## Quickstart

Prereqs: Docker, Node 20+, Python 3.12, [uv](https://docs.astral.sh/uv/).

```bash
# 1. Infra (Postgres + Redis)
npm run infra:up

# 2. Backend
npm run api:install
cp .env.example services/api/.env   # then fill in SECRET_KEY + OPENROUTER_API_KEY
npm run api:migrate
npm run api:dev               # http://localhost:8011  (API docs at /docs)

# 3. Frontend
npm run web:install
cd apps/web && npm run dev    # http://localhost:3100
```

> **Note on `.env`**: the backend reads `.env` from its own working directory, so the file lives at
> `services/api/.env` (not the repo root). `LLM_MOCK=true` uses a built-in sample generator so you
> can try the whole flow without an OpenRouter key.

## How to use

### 1. Create an account

1. Open the app at `http://localhost:3100`.
2. Click **Sign up free** (or **Create your account**). The free plan is active immediately — no
   credit card.
3. If SMTP is not configured, accounts are auto-verified. Otherwise check your inbox and click the
   verification link (or paste the link from the email into the `/verify` page).
4. OAuth is available once you add `GITHUB_CLIENT_ID/SECRET` or `GOOGLE_CLIENT_ID/SECRET` to your
   env.

### 2. Build a website from a prompt

- From the **landing page**, type a description into the hero box (e.g. *"a job board with user
  auth and Stripe payments"*) and hit **Start building** — you will sign up and land in the editor
  with your prompt prefilled.
- Or from the **dashboard**, click **New project**, name it, optionally add a prompt, and create it.

### 3. Generate & refine in the editor

The editor screen has three areas:

- **Left — GrapesJS canvas**: drag-and-drop blocks, click elements to edit text/styles, and the
  toolbar covers style, traits, blocks and layers. Press **Save** to persist your manual edits as a
  new version.
- **Top bar**: `Generate`/`Regenerate` (new version from a prompt), `Save`, `Versions`, `Deploy`,
  `Export` (download a ZIP of HTML/CSS/JS + generated backend).
- **Right — Vibe chat**: talk to the AI as if it were a teammate.

The **Vibe chat** workflow:

1. Type something like *"add a dark-mode toggle"* or *"make the hero section bolder"* and press
   Enter.
2. The AI streams its reply, then shows an **Apply** / **Dismiss** card with the proposed change.
3. Click **Apply** — it is saved as a new version and loaded into the canvas. Click **Dismiss** to
   ignore it. Every apply/regenerate creates a new version, so nothing is ever lost.

### 4. Deploy

1. Click **Deploy** in the top bar.
2. Choose a subdomain (lowercase letters, numbers, hyphens), e.g. `myapp`.
3. Your site goes live at `{subdomain}.myplatform.dev` (locally:
   `http://localhost:8011/s/myapp`). The live link appears in the editor header.

Deployed sites are static HTML/CSS/JS; the generated FastAPI backend and `schema.sql` are written
under `storage/sites/{subdomain}/` and included in the **Export** ZIP.

### 5. Versions

Every generated/regenerated site, applied suggestion, and manual save is a **version**. Open
**Versions** in the top bar to see the history. Roll back to an older version with the rollback
endpoint:

```bash
curl -X POST http://localhost:8011/projects/<project_id>/versions/<version>/rollback \
  -H "Authorization: Bearer <token>"
```

### 6. Billing & plans

- **Pricing page** (`/pricing`) shows the three plans: Free ($0, 1 project), Pro ($20/mo, 10
  projects), Enterprise ($100/mo, unlimited).
- From **Billing** in the app, click **Upgrade** on a paid plan to open Stripe Checkout, then manage
  or cancel via the **Stripe customer portal**. Invoices appear on the same page.
- Stripe must be configured first — see [Deployment → Configure Stripe](#configure-stripe).

### 7. API keys (programmatic access)

1. Go to **Settings → API keys**.
2. Create a key (e.g. `CI pipeline`). Copy it immediately — it is shown only once.
3. Use it as a bearer token against the API:

```bash
curl http://localhost:8011/projects \
  -H "Authorization: Bearer hw_<your-key>"
```

Keys are rate-limited per plan (100/300/1000 req/min for Free/Pro/Enterprise).

### 8. Teams

Invite collaborators so owners, editors and viewers can share projects (team endpoints under
`/teams`, UI to come).

### 9. Admin portal (maintenance & analytics)

Admins see an **Admin** tab in the app nav (`/admin`) with:

- **Analytics cards** — total users, projects, deployments, API keys, teams, LLM calls/tokens,
  revenue, plus 7-day signups and projects.
- **Users** — browse the user list and **ban/unban** or **promote/demote** accounts.
- **Projects, Subscriptions, LLM usage, Payments** — read-only tables of platform activity.

Admins are treated as **enterprise** users: they bypass project limits and rate limits. To become
an admin:

1. Before signing up, add your email to `ADMIN_EMAILS` in `services/api/.env` — that account gets
   `role=admin` automatically.
2. Or promote an existing account:

   ```bash
   cd services/api && uv run python -m app.promote you@example.com
   ```

   (Re-login afterwards so the new role is picked up in your session token.)

## Configuration

Copy `.env.example` to `services/api/.env`. Key settings:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` / `REDIS_URL` | Postgres (asyncpg) and Redis connections |
| `SECRET_KEY` | JWT signing — must match between API and web (`apps/web` also reads `SECRET_KEY`) |
| `OPENROUTER_API_KEY` / `LLM_MODEL` | LLM provider and model (default `openrouter/free`) |
| `LLM_MOCK` | `true` = offline sample generator |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` | Stripe billing |
| `PLATFORM_DOMAIN` | Public domain for deployed subdomains (`*.myplatform.dev`) |
| `AUTO_VERIFY_EMAIL` | Skip email verification when no SMTP is configured |
| `ADMIN_EMAILS` | Comma-separated emails that get `role=admin` on signup |

The frontend reads `API_URL` (default `http://localhost:8011`) and `SECRET_KEY` from the shell or
from `apps/web/.env.local` (Next.js loads `.env*` files automatically).

## Testing

```bash
npm run api:test      # 22 pytest cases (auth, projects, generate, billing, versions)
cd apps/web && npm run lint && npm run build
```

Backend lint/typecheck: `cd services/api && uv run ruff check .`

## Deployment

There are two paths: run the whole stack with Docker locally, or deploy each piece to a managed
hosting platform.

### Option A — Full-stack with Docker (single host)

The `infra/docker-compose.yml` defines five services: `postgres`, `redis`, `api`, `web`. Run
everything on one machine:

```bash
# 1. Configure
cp .env.example infra/.env
#    edit infra/.env — at minimum SECRET_KEY, OPENROUTER_API_KEY, STRIPE_* (see below)
#    set FRONTEND_URL to your public frontend URL and PLATFORM_DOMAIN to your apex domain

# 2. Build & start
docker compose -f infra/docker-compose.yml up -d --build

# 3. First-time database setup
docker compose -f infra/docker-compose.yml exec api alembic upgrade head
```

- Frontend: `http://localhost:3100`
- API + docs: `http://localhost:8011/docs`
- Deployed sites: `http://localhost:8011/s/{subdomain}`

For real subdomains in production you would put a reverse proxy (Caddy/Nginx) in front and point a
`*.yourdomain.com` wildcard DNS record at this host; the API serves deployed sites at `/s/{subdomain}`.

### Option B — Managed hosting (recommended for production)

Three pieces, each on the platform of your choice:

| Component | Recommended | Notes |
| --- | --- | --- |
| **Postgres** | Supabase / Neon / RDS | create a DB, copy the connection string |
| **Redis** | Upstash / Redis Cloud | copy the connection string |
| **API (FastAPI)** | Railway / Fly.io / Render | build `services/api/Dockerfile` |
| **Frontend (Next.js)** | Vercel | build `apps/web/Dockerfile` or Vercel's native Next.js builder |

#### Deploy the API

1. Push the repo (or point the platform at the `services/api` directory).
2. Build from `services/api/Dockerfile`.
3. Set the environment variables — the full list is in `.env.example`. Minimum set:

   ```
   ENVIRONMENT=production
   API_URL=https://api.yourdomain.com
   FRONTEND_URL=https://app.yourdomain.com
   PLATFORM_DOMAIN=yourdomain.com
   DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
   REDIS_URL=redis://host:6379
   SECRET_KEY=<long random string>
   OPENROUTER_API_KEY=sk-or-...
   AUTO_VERIFY_EMAIL=false
   CORS_ORIGINS=https://app.yourdomain.com
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_PRO_ANNUAL=price_...
   STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
   STRIPE_PRICE_ENTERPRISE_ANNUAL=price_...
   ```

4. **Attach persistent storage** at `/app/storage` (the API writes deployed sites and exports there;
   deployed subdomains live on the `storage/sites/{subdomain}` volume).
5. Run migrations once: `alembic upgrade head`.
6. **Wildcard DNS**: create `*.yourdomain.com` → point to the API host (or its CDN). This is what
   makes `{subdomain}.myplatform.dev` resolve.
7. **Stripe webhook** → point to `https://api.yourdomain.com/billing/webhook` (see below).

#### Deploy the frontend

1. Deploy `apps/web` to Vercel (or build `apps/web/Dockerfile` anywhere).
2. Environment variables:

   ```
   API_URL=https://api.yourdomain.com   # must match the API's API_URL
   SECRET_KEY=<same long random string as the API>
   ```

3. Add `https://app.yourdomain.com` to the API's `CORS_ORIGINS`.

> The frontend is a thin proxy: all `/api/*` route handlers forward to `API_URL` and re-attach the
> httpOnly `hydraweb_token` cookie, so browser and backend stay in sync. Keep `SECRET_KEY`
> identical on both sides (it signs the JWT).

#### Configure Stripe

1. Create three **products** in the Stripe dashboard: Free ($0 — price IDs are informational),
   Pro ($20/mo + $200/yr), Enterprise ($100/mo + $1000/yr).
2. For each paid product create **monthly and annual recurring prices**, copy their `price_...` IDs
   into `STRIPE_PRICE_*`.
3. Add a **webhook endpoint** for `https://api.yourdomain.com/billing/webhook` listening to:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`,
   `invoice.paid`, `payment_intent.succeeded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test with Stripe's test cards (e.g. `4242 4242 4242 4242`).

The app handles plan upgrades/downgrades/cancels automatically via these webhooks and exposes a
self-serve **Stripe customer portal**.

#### OpenRouter (LLM)

Get an API key at [openrouter.ai](https://openrouter.ai). Set `OPENROUTER_API_KEY` and, if you like,
pick a model via `LLM_MODEL` (default `openrouter/free`). With `LLM_MOCK=true` the app works fully
offline with a sample site generator — handy for staging/demos.

## Architecture

```mermaid
flowchart LR
  subgraph Client
    W[Next.js app :3100]
  end

  subgraph API[FastAPI backend :8011]
    R[HTTP + SSE routes]
    A[auth / users / projects]
    G[generate / chat / apply]
    D[deploy / export]
    B[billing / webhook]
    T[teams / admin]
    LLM[LLM service → OpenRouter]
  end

  PG[(Postgres)]
  RD[(Redis)]
  ST[storage/sites]
  SP[Stripe]

  W -- proxy routes --> R
  R -- SSE --> W
  R --> LLM
  R --> PG
  R --> RD
  R --> SP
  D --> ST
```

Requests flow: the Next.js app proxies `/api/*` calls to the FastAPI backend, attaching the
httpOnly `hydraweb_token` cookie. SSE streams (`generate`, `chat`) pass through the proxy
untouched. Deployments write static files to `storage/sites/{subdomain}/` which the API serves
at `/s/{subdomain}` (a `*.myplatform.dev` wildcard DNS record points here in production).

## CI/CD

- `.github/workflows/backend.yml` — installs deps, runs `ruff` and `pytest`.
- `.github/workflows/frontend.yml` — `npm ci`, lint, `tsc`, production build.
