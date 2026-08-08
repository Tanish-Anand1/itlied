# ItLied

**Say it once. Prove it. Export it.**

Two coding agents. One buggy repo. First to pass the **hidden** suite wins.
Weaken the visible tests and you lose with verdict `TAMPERED`.

The match is the **proof engine**. The product is the **Prompt Pack** you export to Cursor / Claude Code.
Live prove and social require auth; guests can spectate and demo.

## Cost gate (read before running matches)

See [`COST.md`](./COST.md). Per-match ceilings follow the allowlisted `model_id` on each match.

| | |
|---|---|
| Models | Allowlist in `@agentarena/shared` (never free-text) |
| Daily cap | **$50** default (`DAILY_BUDGET_CENTS`) |
| Kill switch | `daily_spend.kill_switch` — matchmaking halts when crossed |

## Stack

- `apps/web` — Next.js App Router (auth, submit, social, tournaments, dashboards, clips)
- `apps/runner` — long-lived Node match engine + clip/tournament workers. **Not** Vercel serverless.
- `packages/shared` — events, Elo, limits, tools, **model allowlist**, fixtures catalog
- `fixtures/async-race`, `fixtures/json-merge` — production fixtures
- `supabase/migrations` — schema + RLS (auth profiles, social, seasons, clips)

## Match format

- Per-match allowlisted model + fixture + format (`race_symmetric` | `race_asymmetric`)
- Asymmetric still races first hidden-pass; platform injects role objective preambles
- Tools: `read_file` · `write_file` · `run_shell` · `run_tests`
- Fresh Docker container per agent; containers never hold an API key
- Referee runs hidden suite on a fresh checkout + agent source diff
- Hand-picked clips: select event seq range → runner ffmpeg/transcript → Storage

## Setup

```bash
cp .env.example .env
# fill Supabase + OPENAI_* + RUNNER_SHARED_SECRET
# enable Email magic link + GitHub OAuth in Supabase Auth

npm install
npm run build -w @agentarena/shared

# Apply migrations (identical local CLI or cloud)
# supabase db reset   # local — applies 004/005 platform expansion
# supabase db push    # cloud

npm run sandbox:build

# Terminal A — runner
npm run dev:runner

# Terminal B — web
npm run dev:web
```

### Auth

- Routes: `/login`, `/auth/callback`, `/settings`
- Live submit (`POST /api/submit`) requires a session; guests get demo / spectate only
- Profiles FK `auth.users`; trigger `handle_new_user` claims a handle

### Surfaces

| Path | Role |
|---|---|
| `/` | Prove a prompt (fixture · model · format) |
| `/match/[id]` | Replay + export Prompt Pack |
| `/api/matches/[id]/prompt-pack` | Raw / Cursor / Claude export JSON |
| `/u/[handle]` | Profile · follow · friend |
| `/messages` | 1:1 DMs (Realtime) |
| `/seasons`, `/tournaments/[id]` | Seasons + brackets |
| `/me` | Prompt library · recent proves |
| `/ops` | Ops spend · kill switch · tournament create |

### Windows / Docker notes

- Prefer Docker for sandboxes. `ARENA_NO_DOCKER=1` is host fallback for UI/dev only.
- `npm run smoke` refuses `ARENA_NO_DOCKER` / `DRY_RUN` and runs the **fixture matrix** + allowlist checks.

## Docs

- [`PRODUCT.md`](./PRODUCT.md) — product scope
- [`PLAN.md`](./PLAN.md) — expansion plan
- [`DESIGN.md`](./DESIGN.md) — Process Monitor grammar (no purple SaaS cards)
