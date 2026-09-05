# DESIGN.md

Technical design of **Credify** as the code actually stands. Everything below was
derived by reading the source, not the README — where the two disagree, this document
follows the code and says so.

---

## 1. System shape

Three independently deployable units that share **no code and no types**:

| Unit | Stack | Owns |
|---|---|---|
| `/` (root) | Next.js 16 App Router, React 19, TypeScript | Dashboard, feature demo UIs, Neon Auth session |
| `/backend` | Express 5, plain-JS ESM, Drizzle ORM | All business logic, all Postgres access |
| `/extension` | Chrome Manifest V3, vanilla JS, no build | In-page review scanning on arbitrary sites |

The product targets the **general public**: users sign in with Neon Auth and every
capability is session-gated. There is no B2B API-key surface. The browser holds **no
secrets at all** — it talks only to the Next.js proxy (`/api/backend/*`), which
validates the session cookie and forwards to Express with a shared
`x-internal-secret` header. The Drizzle schema and the `pg` pool exist only in
`backend/src/db/`.

```
 Browser (signed-in user)                  Chrome Extension
        |                                        |
        | session cookie                         | no credentials
        v                                        v
 +---------------------------+          +---------------------------+
 | Next.js  /api/backend/*   |          |                           |
 |  allowlisted proxy:       |          |                           |
 |  getSession -> 401        |          |                           |
 |  inject identity          |          |                           |
 +---------------------------+          |                           |
        | x-internal-secret             |  IP rate limit only       |
        v                               v                           |
 +------------------------------------------------------------------+
 |  Express :3002   /api/v1/*                                       |
 |    requireInternal -- refund | document | id | review | user |   |
 |                       profile | dashboard | trustcanvas          |
 |    public          -- extension/classify                         |
 +------------------------------------------------------------------+
        |                    |                      |
        v                    v                      v
   Neon Postgres        Hive AI v3            Google Gemini
   (Drizzle)            (image forensics)     (OCR / NLP / fallback)
```

---

## 2. Data model

Six tables in `backend/src/db/schema.js`. There are no foreign keys — tables are joined
in application code, or not at all.

- **`trust_profiles`** — the reputation ledger. Keyed by `email` *and* `phone_number`,
  both independently `unique`. Holds `trust_score`, `prior_flags`, `total_checks`.
- **`watermarked_documents`** — issuance ground truth for certificates. `doc_hash` is the
  UUID embedded steganographically into the image.
- **`physical_ids`** — issuance ground truth for ID cards. `signed_token` is the UUID
  encoded into the printed QR.
- **`verification_logs`** — append-only audit trail. `endpoint`, `result_status`
  (`PASS`/`FAIL`/`FLAG`), and a `details` blob that is usually `JSON.stringify(result)`.
- **`user_profiles`** — dashboard account metadata, keyed by the Neon Auth `user_id`.
  Deliberately separate from `trust_profiles`.

**Design consequence worth knowing:** `verification_logs` stores no user or profile id.
Nothing in the schema links an audit event back to the identity that caused it. This is
the single biggest structural gap in the model and it forces the Trust Canvas to fake
its edges (§5.6).

---

## 3. The Unified Trust Score — the core mechanism

This is the one idea the whole product is built around, and it is what makes the
features more than four unrelated detectors: **a verdict in any feature permanently
moves a score that every other feature then reads.**

`backend/src/utils/trustProfile.js` implements it in a single function,
`upsertAndScoreTrustProfile(db, { email, phone_number }, outcome)`.

**Identity resolution.** The lookup is an `or()` across both identifiers, so a user
seen by email on a refund claim and by phone on a review resolves to the *same* profile
row. This is what makes the score "cross-platform" — identity is deliberately fuzzy and
contact-based rather than account-based.

**Scoring.** A flat delta, clamped to `[0, 100]`:

| Outcome | Delta | Side effect |
|---|---|---|
| `PASS` | `+3` | — |
| `FLAG` | `-5` | — |
| `FAIL` | `-15` | `prior_flags += 1` |

Asymmetric by design: trust is slow to earn (+3) and fast to lose (−15), so five clean
interactions do not offset one fraud.

**Cold start.** Unknown identities are created at **80**, not 100 — new users begin
mildly distrusted. Note the schema's column default of `100` applies only to rows
inserted elsewhere (`seed.js`, `/user/sync`), so a profile's origin is visible in its
starting score.

### 3.1 Two-pass risk evaluation

The non-obvious part of the architecture, implemented in `routes/refund.js` and mirrored
in `routes/review.js`. Ordering is load-bearing:

1. **Detect.** Run the forensic signals, derive a provisional outcome.
2. **Mutate.** Call `upsertAndScoreTrustProfile` — the score changes *now*.
3. **Re-evaluate against the new score.** History can override a clean detection result:
   in refund, `trust_score < 50` forces `DENY` even when the image passed; a `PASS` with
   `trust_score < 80` is downgraded to `FLAG_FOR_REVIEW`.
4. **Log.** Insert into `verification_logs`, return `evidence_report_url` built from the
   inserted row id.

Because step 3 reads the value written in step 2, the current request's own verdict
partially influences its own risk decision. That is intentional — a fraudulent image
both drops the score and is judged against the dropped score.

---

## 4. Cross-cutting design pattern: the degradation ladder

Every external-AI call in this codebase has a fallback, and no route can be taken down
by a vendor outage. This appears four separate times:

| Call site | Primary | Fallback | Last resort |
|---|---|---|---|
| `utils/aiDetection.js` | C2PA parse (local) → Hive AI v3 | Gemini vision prompt | honest "detectors unavailable" |
| `routes/review.js` | Gemini JSON | regex heuristics (`assessAiText`) | — |
| `routes/extension.js` | Gemini batch | server-side heuristic | heuristic on parse crash |
| `extension/background.js` | Credify backend | identical local heuristic | — |

The fallbacks are silent — the response shape is identical, so a caller cannot tell
whether a verdict came from a frontier model or from four regexes. Good for uptime,
but it means **a missing `GEMINI_API_KEY` degrades quality without any error surfacing.**
The one exception is image AI-detection: when both Hive and Gemini fail it now returns
`detectors_unavailable: true` with a zero score instead of a fabricated verdict, and the
refund route flags such requests for human review rather than auto-approving blind.

The heuristic in `extension.js` is duplicated almost verbatim in `background.js`
(same keyword list, same emoji regex, same repetition ratio) so the extension keeps
working with the backend entirely unreachable.

---

## 5. Features

### 5.1 Refund image verification — `POST /api/v1/refund/verify`

Multipart `image` upload, held in memory (`multer.memoryStorage()`), never written to disk.

**Signals.** Three, weighted deliberately unequally:

- *C2PA provenance* (`utils/c2paAnalysis.js`). Runs **first and locally** via the
  official `@contentauth/c2pa-node` library — it parses the JUMBF manifest, validates the
  signature, and reads the `c2pa.actions` assertion's `digitalSourceType`. A valid
  manifest declaring an AI source type (`trainedAlgorithmicMedia`, `algorithmicMedia`, …)
  is conclusive: the route returns `DENY` and never spends a Hive/Gemini call. A
  `validation_state` of `Invalid` or a `dataHash.mismatch` failure means the pixels were
  edited after signing → `tampered` → `DENY`. A signed *edit* trail (`c2pa.edited`,
  `composite`) → `ai_edited` → `FLAG`. **Absence of a manifest is neutral**, never
  suspicious — most images have none.
- *AI forensics* (`utils/aiDetection.js`). If C2PA is not conclusive, posts base64 to
  Hive's `ai-generated-and-deepfake-content-detection` v3 endpoint, reading the
  `ai_generated` and `deepfake` class values. On any non-OK response or throw, falls
  through to a Gemini vision prompt scoped **strictly to visible pixels** — it is no
  longer asked about metadata it cannot see. If both are down it returns
  `detectors_unavailable` rather than a fabricated score.
- *EXIF* (`utils/exifAnalysis.js`). `exifr` parse flagging `missing_camera_info`,
  `editing_software_detected` (regex over `Software` for photoshop/lightroom/gimp/
  midjourney/dall-e/stable diffusion), or `missing_all_metadata`.

**Fusion.** Signed AI provenance and the pixel classifier both dominate; a signed edit
trail, weak classifier score, 3+ EXIF flags, or detectors being down all escalate to
review; EXIF alone never can:

```
C2PA ai_generated/tampered, OR isAi           HIGH   / DENY            / FAIL
C2PA ai_edited, OR aiScore > 0.3,             MEDIUM / FLAG_FOR_REVIEW / FLAG
  OR exif flags > 2, OR detectors_unavailable
otherwise                                     LOW    / AUTO_APPROVE    / PASS
```

One or two EXIF flags are **intentionally ignored** — stripped metadata is normal for
screenshots and messaging apps, so EXIF alone can never escalate risk.

Then the two-pass trust re-evaluation of §3.1 runs.

> **Why real C2PA, not a prompt.** The old fallback asked Gemini to "check for C2PA
> provenance metadata." Vision models receive only decoded pixels and cannot read the
> JUMBF boxes a manifest lives in, so those answers were hallucinated. Provenance is now
> parsed and cryptographically validated locally; the model is asked only what it can
> actually observe.

### 5.2 Document watermarking — `POST /api/v1/document/watermark` · `/verify`

The most distinctive feature: tamper evidence via **deliberate fragility**.

*Issuance.* A `uuidv4()` is generated, embedded into the image, and stored in
`watermarked_documents` alongside recipient/type/dates. The modified image is streamed
back as raw `image/png` — this route is the only one that returns a binary body rather
than JSON.

*Embedding* (`utils/steganography.js`). Plain LSB with Jimp: the payload plus a
`||END||` delimiter is expanded to bits, and one bit is written into the low bit of each
**R, G and B** channel in scan order (alpha is skipped). The output is forced to PNG
because the payload lives in exact pixel values and would not survive lossy re-encoding.

*Extraction.* Walks the raw bitmap linearly, skipping every 4th byte (alpha), rebuilding
bytes MSB-first and stopping at `||END||`. Bails out at 1000 characters to avoid scanning
a whole non-watermarked image.

*Three-way verdict* — the useful part:

| Condition | Verdict | Meaning |
|---|---|---|
| No delimiter recovered | `UNVERIFIED` | Watermark absent **or destroyed** — AI re-generation, screenshotting, or JPEG conversion |
| Hash recovered, no DB row | `FRAUD_FLAG` | Payload was forged or copied from elsewhere |
| Hash recovered, DB row found | `VERIFIED` | Returns the full issuance record |

Distinguishing "destroyed" from "forged" is the whole point: any AI edit of a certificate
rewrites pixels and silently erases the payload, so *absence itself* is the tamper signal.

Note this feature does **not** touch the trust score — documents are issuer-bound, not
identity-bound.

### 5.3 Physical ID verification — `POST /api/v1/id/generate` · `/verify`

Combats photographed/edited student ID cards by anchoring to cryptographic ground truth.

*Generate.* Upserts on `student_id`, mints (or reuses) a `signed_token` UUID, and returns
a QR data-URI encoding `https://verify.credify.io/id/<token>`. Re-issuing for an
existing student keeps the original token so previously printed cards stay valid.

*Verify.* The interesting pipeline:

1. `utils/qrExtraction.js` decodes the QR with `jsqr` over the Jimp bitmap.
2. Token parsed out of the URL by regex, falling back to treating the raw QR payload as
   the token.
3. DB row loaded as **ground truth**. No row → immediate `FRAUD_FLAG`, no OCR spent.
4. Gemini (`gemini-3-flash-preview`, `responseMimeType: application/json`) receives the
   card image *and the ground-truth values in the prompt*, and is asked to both extract
   each field and return a per-field `match` boolean.

Step 4 is the design decision worth calling out: **field comparison is delegated to the
model rather than done with string equality.** The prompt explicitly instructs that
`"B.Tech"` vs `"BTech"`, `"CSE C"` vs `"cse-c"`, and case differences are matches, while
a wrong name or ID is not. This buys tolerance to OCR noise and print formatting that
`===` could never express — at the cost of a non-deterministic comparator that sees the
answer it is grading against.

Any field with `match: false` yields `HIGH_FRAUD_PROBABILITY` plus a `tampered_fields`
list. Two checks are structurally incapable of failing: `College Name` is hardcoded
`pass: true` (no ground truth stored for it), and `Expiry Date` passes automatically when
the record has no expiry.

If the Gemini call throws, it is caught and `extractedData` stays `{}` — every `match`
then defaults to `false`, so an **API outage produces a fraud verdict**. This is the one
place the degradation ladder fails closed rather than open.

### 5.4 Review credibility scoring — `POST /api/v1/review/score`

Text-only, no upload. Gemini returns `{is_ai_generated, ai_probability, is_spam,
spam_flags}`; on any failure the offline heuristics substitute — an LLM-tell regex list
(`delve into`, `testament to`, `in conclusion`, `tapestry`) returning a blunt 85 or 12,
plus length and `buy now|click here` spam checks.

Outcome mapping: `ai_probability > 80` → `FAIL`, any spam flag → `FLAG`, else `PASS`.

Credibility is then computed as a **separate** additive-penalty score from 100, distinct
from the trust score it consumes:

```
-40  ai_probability > 80
-30  any spam flags
-50  reviewer trust_score < 50   (else -20 if < 80)
```

clamped to `[0,100]`, then `< 40` → `HIDE`, `< 75` → `FLAG_FOR_REVIEW`, else `DISPLAY`.

So a perfectly human-written review from a burned identity can still be hidden — the
cross-feature memory of §3 doing its job.

### 5.5 Extension bridge — `POST /api/v1/extension/classify`

A deliberately **keyless, unauthenticated** proxy, and the reason the extension needs no
setup: end users never hold a Gemini key, the server holds it.

Accepts `{reviews: string[]}` and returns `{results: [{label, confidence}]}` **in input
order** — the ordering contract is the entire API. All reviews go into one batched prompt
(`Review 1: …`, `Review 2: …`) for a single round trip. A length check
(`parsed.length !== reviews.length`) rejects a misaligned model response wholesale and
falls back to heuristics, since a shifted array would mislabel every review.

*Client side.* `background.js` is the service worker: it keeps an in-memory `Map` cache
keyed on exact review text, chunks uncached items into batches of 10, and merges results
back into their original indices.

*In-page.* `content.js` tries **nine selector strategies in order** — Amazon-specific
(`div[data-hook="review"]`), then generic (`.review`, `article[class*="review"]`,
`[data-testid="review-card"]`, Yotpo) — and stops at the first that matches, which is
how one extension covers many storefronts without per-site code. It marks nodes with
`data-reviewAnalyzed` / `data-reviewProcessing` to avoid rescanning, injects colored
badges inline, and installs a `window.__CREDIFY_CLEANUP` idempotency guard so an
extension reload does not leave duplicate observers on the page.

Note `background.js` posts to the deployed `https://factoryscan.onrender.com`, not
localhost — local testing of this path requires editing that URL.

### 5.6 Trust Canvas — `/trust-canvas`

Live graph over `GET /api/v1/trustcanvas` (50 newest profiles, 200 newest logs), rendered
with `@xyflow/react` using two custom node types. User nodes are color-coded by score
(≥80 green, ≥50 amber, else red); event nodes are colored per endpoint via an
`ENDPOINT_META` map. Failed events get animated edges. Layout is computed manually —
users in a left column, events in a 4-column grid.

**The edges are not real.** Because `verification_logs` has no user column (§2), edges
are assigned round-robin: `profileIds[idx % profiles.length]`. The comment in the source
admits this. The visualization is therefore structurally accurate about *what happened*
and fabricated about *who did it*. Adding a `user_id`/`profile_id` column to
`verification_logs` is the fix, and it would make this page genuinely meaningful.

### 5.7 Trust Database showcase — `/trust-database`

Entirely **static marketing content** — the `trustLogs` array, the five orbiting store
nodes, and the score are hardcoded literals. It makes no network call. Worth stating
plainly so it is not mistaken for the live view; `/trust-canvas` is the real one.

### 5.8 The session proxy

`src/lib/apiProxy.ts` is the sole bridge between browser and backend, and it is an
**explicit allowlist**: a `RULES` map keyed by `METHOD path`, one entry per reachable
upstream route. Anything not listed 404s at the proxy, so adding a backend route does
not expose it until a rule is added.

Per rule the proxy: (1) requires a Neon Auth session via `auth.getSession()`, else
401; (2) rebuilds the body — `req.formData()` re-sent for multipart so `fetch` mints a
fresh boundary, JSON re-serialized; (3) runs the rule's `inject` hook, which
**overwrites identity fields from the session** (`email` on refund/review/sync,
`userId` on profile) and deletes client-supplied phone fields — so a signed-in user
can only ever affect their own trust profile; (4) forwards with `x-internal-secret`;
(5) for the watermark route, streams the binary PNG back untouched.

Express-side, `requireInternal` (`backend/src/middleware/internal.js`) does a constant
comparison on the header; `server.js` exits at boot if `INTERNAL_API_SECRET` is unset.
The extension bridge is exempt and carries a dependency-free fixed-window IP rate
limiter (30 req/min) instead.

### 5.9 Dashboard and auth

`/api/v1/dashboard/stats` aggregates in SQL (`count(*)`, `avg(trust_score)`) counting
`result_status IN ('FAIL','FLAGGED','FLAG')` as fraud stopped. A near-duplicate
`/api/v1/user/dashboard-stats` does the same work in JavaScript over a full table scan
and only counts `'FLAGGED'` — a status string **no route ever writes**, so its
`fraudStopped` is always 0. The dashboard uses the SQL one.

Auth is Neon Auth's drop-in views: `/auth/[path]` renders `<AuthView>`,
`/account/[path]` renders `<AccountView>`, and `app/api/auth/[...path]/route.ts` proxies
via `auth.handler()`. `src/middleware.ts` redirects signed-out visitors to login for
`/account`, `/dashboard`, `/features`, `/trust-canvas`, and `/profile-setup`. Post-signup,
`/profile-setup` writes to `user_profiles`, while `src/lib/userSync.ts` separately
creates a `trust_profiles` row — the two identity tables are populated by different code
paths and never joined.

---

## 6. Recurring conventions

- **Thin routes, pure utils.** Detection lives in `backend/src/utils/`; routes only
  orchestrate. Swapping Hive for another vendor touches one file.
- **Uniform envelope.** `{success, result, evidence_report_url}` on success,
  `{success: false, error}` on failure. Business-level fraud verdicts return **HTTP 200**
  with a negative `verdict` — non-200 means the *system* failed, not the *user*.
- **Every route try/catches** into a generic 500 with the real error logged server-side.
- **Uploads stay in memory.** No temp files anywhere.
- **Audit before response.** The log row is inserted first so its id can seed
  `evidence_report_url` (which points at `credify.io`, an endpoint not implemented here).
- **Frontend styling is CSS Modules + custom properties only.** No Tailwind, despite
  `tailwind-merge` being installed. Tokens live in `src/app/globals.css`.

---

## 7. Known gaps

- `verification_logs` has no identity column — breaks Trust Canvas edges and makes
  per-user audit impossible.
- `/trustcanvas` is session-gated but not scoped: any signed-in user sees every
  profile and log, not just their own.
- The in-memory rate limiter on `/extension/classify` resets on restart and is
  per-process — a multi-instance deploy needs a shared store.
- `trust_profiles` and `user_profiles` are never joined; a dashboard user cannot see
  their own trust score.
- Trust deltas are fixed constants with no decay, no recency weighting, and no
  per-endpoint weighting.
- `id/verify` fails closed: a Gemini outage reads as fraud.
