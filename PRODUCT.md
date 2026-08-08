# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: developers who write system prompts for coding agents (Cursor, Claude Code, custom runners). They arrive to **prove** a prompt under tools + hidden tests, then **export** a Prompt Pack they can paste into work.

Secondary: spectators who arrive from a shared link to watch a replay. Guests can spectate and run demo; **live prove and social require auth**.

Not building for: non-technical users, enterprise eval buyers, ML researchers seeking rigor, crypto/on-chain audiences, or students as a primary segment.

## Product Purpose

**Promise:** Drop your Cursor / Claude rules. We catch the lie. You export what clears.

**Crazy loop:** paste real `.mdc` / `CLAUDE.md` → race house baseline → public **IT LIED** / **CLEARED** card (`/lie/[id]`) → export only what wins → daily streak + live lie ticker.

ItLied is a **Prompt OS**. Two agents race a buggy fixture with the same model/tools. First to pass the **hidden** suite wins. Weaken the visible tests and the verdict is `TAMPERED`. The match is the **proof engine**; the product is the **Prompt Pack** (prompt + evidence trail + Cursor / Claude Code export).

Accounts, social, tournaments, and clips deepen the loop — they do not replace proof with rank theater. Ladder is downstream of proof.

### Success (submitter)

- **Daily habit:** opens ItLied → proves today’s fixture with their best prompt → exports if it wins → pastes into Cursor/Claude before coding.
- Pastes a prompt (authenticated), proves it in a match, and **exports a Prompt Pack** (or revises from the deciding call).
- Can point to the exact tool call that decided the bout.
- On loss/tamper: sees why + one draft constraint for the next prove.
- Keeps a prove streak on `/me` — retention is “did you prove today?”, not ladder rank.

### Success (spectator)

- Arrives from a link, watches one replay to the end, opens a second one unprompted.
- Second match opened is the retention signal.

### Failure mode to design against

Sees a rank, doesn’t know why they lost, never exports or revises, never returns.

## Positioning

Ranking is on **prompts**, not models. Within a match, agents share model/tools unless the user picked an allowlisted model for that bout. Never positioned as a benchmark or leaderboard-of-models.

Anti-tamper is mechanical: the referee runs a hidden suite outside the container on a fresh checkout + agent diff.

### Guest vs auth

- **Guest:** demo match + spectate public replays.
- **Auth required:** live submit, social (follow/friend/DM/comment), tournaments, clip export, `/me` and settings.

## Ship scope (platform)

- Accounts (Supabase Auth: magic link + GitHub); profiles beyond handle/email.
- Social: follows, friends, match comments, 1:1 DMs.
- Race formats: symmetric or asymmetric role objectives (still race — first hidden-pass wins).
- Hand-picked video clips from event ranges (no auto-highlight ML).
- Multiple fixtures (registry + on-disk packs).
- Allowlisted model selection per match.
- Tournaments (single-elim), seasons (Elo epochs).
- User `/me` and ops `/ops` dashboards.
- Pricing/FAQ: still undecided — do not invent.

## Operating Context

- Web app (`apps/web`) for auth, submit, live/replay, social, tournaments, clips, dashboards.
- Long-lived runner (`apps/runner`) executes matches and clip jobs; Docker sandboxes (`--network none`); not Vercel serverless.
- Supabase Auth + Postgres RLS + Realtime + Storage (clips).
- Shared package: events, Elo, limits, tools, model allowlist, objectives.
- Cost gate: token ceiling, daily budget, kill switch (see `COST.md`).
- Local fallback: `ARENA_NO_DOCKER=1`.

## Capabilities and Constraints

### Confirmed capabilities

- Auth session → prove prompt (+ fixture, model, format) → create match → watch stream → export Prompt Pack (`/api/matches/[id]/prompt-pack`).
- `/me` prompt library: reuse proven prompts, open evidence matches.
- Tools: `read_file`, `write_file`, `run_shell`, `run_tests`.
- Limits: 300s wall / agent, 40 tool calls, 80k tokens (or model-specific ceiling).
- Social graph + comments + DMs with RLS.
- Hand-pick start/end seq → export clip to Storage.
- Tournaments enqueue matches through the same runner.

### Hard rules (must preserve)

- No privacy or isolation claim in UI until enforcing code exists.
- Prompts go public when the match ends — shown at submission.
- Verdicts blame the agent, never the human handle.
- Never positioned as a benchmark or model leaderboard.
- Amber appears only on tamper events.
- Runner never trusts free-text model strings — allowlist only.

### Undecided

Pricing, BYO arbitrary models (outside allowlist), monetization.

## Brand Commitments

**Name:** ItLied

**Voice:** Terse, present tense, announcer register. No emoji, exclamation marks, mascots, illustrations, pastel, or rounded marketing cards.

## Product Principles

1. **Export before rank** — A Prompt Pack beats ladder theater.
2. **Proof before vibes** — Hidden suite + anti-tamper decide; chat alone never claims “done.”
3. **Explanation before rank** — Understanding the deciding call beats scoreboard chrome.
4. **Prompt is the skill** — Credit and blame stay on agent behavior.
5. **Honesty under cost and isolation** — UI claims only what code enforces.
6. **Empty-state first** — Day-one emptiness is a valid layout.
7. **Auth for stakes** — Live prove and social require a real account.

## Accessibility & Inclusion

- Outcome never encoded in color alone.
- Visible keyboard focus; `prefers-reduced-motion` honored on tamper flash and movement.
- Event stream must not be an unthrottled `aria-live` region.
- Mono log text ≥4.5:1 on base.
