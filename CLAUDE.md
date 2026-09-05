# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

All frontend commands run from the repo root; all backend commands run from `backend/`.

```bash
# Frontend (Next.js 16, root)
npm run dev            # http://localhost:3000
npm run build
npm run lint           # eslint (flat config, eslint-config-next)

# Backend (Express 5, backend/)
npm run dev            # nodemon src/server.js -> http://localhost:3002
node src/server.js     # without watch
npm run db:generate    # drizzle-kit generate (emit migration SQL)
npm run db:push        # drizzle-kit push (apply schema straight to Neon)
node src/db/seed.js    # insert 8 sample trust_profiles (4 good, 4 fraudulent)

# Backend integration tests -- require a running server on :3002 and a live DB
node tests/run_tests.js
```

`tests/run_tests.js` is a single sequential script hitting 9 real endpoints, not a
test framework. There is no way to run one case in isolation; comment out steps or
copy a request into `tests/manual.http`. It authenticates with the
**`INTERNAL_API_SECRET`** from `backend/.env` (sent as `x-internal-secret`),
bypassing the Next.js session proxy to talk to Express directly.

There is no test runner for the frontend and no typecheck script (`tsc --noEmit`
must be invoked manually).

## Environment

Neither `.env` is committed. Copy `.env.example` -> `.env` and `backend/.env.example` -> `backend/.env`.

| Variable | File | Notes |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | Neon Postgres connection string |
| `GEMINI_API_KEY` | `backend/.env` | ID OCR, review NLP, extension classify, AI-detection fallback |
| `HIVE_API_KEY` | `backend/.env` | Hive AI image forensics (primary detector) |
| `PORT` | `backend/.env` | **Must be 3002.** `server.js` defaults to 3000, which collides with Next dev, and every frontend fallback plus the test suite hardcodes 3002. |
| `NEON_AUTH_BASE_URL` | root `.env` | The console's **Auth URL** verbatim, including the trailing `/auth` — the SDK appends endpoints directly (`${baseUrl}/get-session`) |
| `NEON_AUTH_COOKIE_SECRET` | root `.env` | Validated at runtime; must be >= 32 chars |
| `INTERNAL_API_SECRET` | **both** `.env` files | Shared secret between the Next proxy and Express; must be identical in both. Express refuses to boot without it. |
| `BACKEND_INTERNAL_URL` | root `.env` (optional) | Where the proxy reaches Express; defaults to `http://localhost:3002` |

There are no API keys and no `NEXT_PUBLIC_` secrets. The browser talks only to
the Next.js proxy at `/api/backend/*` (`src/lib/apiProxy.ts`), which checks the
Neon Auth session, injects the caller's identity, and forwards to Express with
`x-internal-secret`.

## Architecture

Three deployable pieces that do **not** share code:

- **root/** — Next.js App Router frontend (dashboard, feature demos, Neon Auth session)
- **backend/** — Express 5 API, plain JS ESM (`"type": "module"`), owns the database
- **extension/** — Manifest V3 Chrome extension, no build step, loaded unpacked

The frontend never touches Postgres. It calls the Express API over HTTP with
`x-api-key`, which means the API key ships to the browser (acceptable locally, not
for production). Drizzle schema and the `pg` pool live only in `backend/src/db/`.

### The Unified Trust Score is the spine

Every verification feature converges on one mutable per-identity score. This is the
single most important invariant in the codebase: **a new verification route is
incomplete until it calls `upsertAndScoreTrustProfile`.**

`backend/src/utils/trustProfile.js` resolves an identity by `email` OR
`phone_number` (an `or()` lookup, so either identifier matches the same profile),
then applies a fixed delta clamped to 0–100:

| Outcome | Delta | Side effect |
|---|---|---|
| `PASS` | +3 | — |
| `FLAG` | -5 | — |
| `FAIL` | -15 | increments `prior_flags` |

Unknown identities are created at **80**, not 100 — new users start cautious, while
the `trust_profiles` column default of 100 applies only to rows inserted by the seed
script or by hand.

### Two-pass risk evaluation

`routes/refund.js` is the reference implementation and the pattern other routes
follow. Read it before adding a feature. The order matters:

1. Run detectors (AI forensics, EXIF) and derive a provisional `outcome`.
2. Call `upsertAndScoreTrustProfile` with that outcome — this *mutates* the score.
3. Re-evaluate risk **against the freshly updated score**, so cross-platform history
   can escalate an otherwise-clean request (`trust_score < 50` forces `DENY`;
   `< 80` on a PASS downgrades to `FLAG_FOR_REVIEW`).
4. Write a `verification_logs` row and return `evidence_report_url` built from its id.

### Auth architecture

One user-facing auth system (Neon Auth sessions) plus one machine-to-machine gate:

- **Neon Auth** (`src/lib/auth/server.ts`, `src/middleware.ts`) is the only auth
  end users see. The middleware `matcher` redirects signed-out visitors to login for
  `/account`, `/dashboard`, `/features`, `/trust-canvas`, and `/profile-setup`.
- **The session proxy** (`src/lib/apiProxy.ts` + `src/app/api/backend/[...path]/route.ts`)
  is the only path from browser to Express. It is an explicit allowlist; a new
  backend route is unreachable from the frontend until a rule is added there. Rules
  overwrite identity fields (`email`, `userId`) from the session, so never trust
  client-supplied identity — the proxy discards it.
- **Express** (`backend/src/middleware/internal.js`) accepts only requests bearing
  `x-internal-secret`. The single exception is `/api/v1/extension/classify`, which is
  public by design (zero-config Chrome extension) and IP-rate-limited instead.

When adding a verification feature: Express route → proxy rule → relative
`fetch('/api/backend/...')` from the page, with no headers.

### Detector utilities

Routes stay thin; all detection logic is isolated in `backend/src/utils/` so models can
be swapped without touching routes:

- `c2paAnalysis.js` — real C2PA (Content Credentials) parsing via the official
  `@contentauth/c2pa-node` (needs Node >=22). Validates the manifest signature and reads
  `digitalSourceType`; returns a `verdict` of `ai_generated` / `tampered` / `ai_edited` /
  `authentic_capture` / `present` / `absent`. **Absence is neutral, never suspicious.**
- `aiDetection.js` — layered: C2PA first (a signed AI manifest short-circuits to a verdict
  with no paid call), then Hive AI v3, **falling back to Gemini** (pixels only — never
  asked about metadata it can't see) on any non-OK response or throw. If both classifiers
  fail it returns `detectors_unavailable` instead of a fabricated score.
- `steganography.js` — LSB watermarking via Jimp, writing one bit into each of the R/G/B
  channels and terminated by a `||END||` delimiter. **Always returns PNG** — the payload
  does not survive JPEG re-encoding, which is precisely the tamper-evidence mechanism.
- `exifAnalysis.js` — `exifr` metadata forensics, returns a `flags` array. Refund
  scoring intentionally ignores 1–2 flags and only reacts at 3+.
- `qrExtraction.js` — `jsqr` over decoded pixels; ID verification parses
  `/id/<signed-token>` out of the QR URL, loads the DB row as ground truth, then uses
  Gemini OCR to cross-compare the photographed card.

### Frontend conventions

App Router with **CSS Modules and vanilla CSS only** — no Tailwind, despite
`tailwind-merge` being a dependency. Theme tokens are CSS custom properties in
`src/app/globals.css` (`--background`, `--primary`, `--card`, …); it is a dark theme by
default. Shared primitives are `src/components/ui/` and `src/components/layout/`.
Path alias `@/*` maps to `./src/*`. Turbopack `root` is pinned in `next.config.ts`.

## Known rough edges

- `build_output.txt`, `lint_output.txt`, `ts_errors.txt`, `db_out.txt`, `seed_out.txt`
  are committed UTF-16 console dumps from past runs. They are stale artifacts, not
  documentation — regenerate rather than trust them.
- The extension's `background.js` posts to the deployed
  `https://factoryscan.onrender.com/api/v1/extension/classify`, not localhost; point it
  at your local server when testing that path.
