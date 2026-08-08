# E2E matrix (platform expansion)

Manual / CI checklist after migrations `004` + `005`.

## Auth

- [ ] Magic link / GitHub OAuth → `/auth/callback` → profile row exists
- [ ] `/settings` updates handle / display / bio
- [ ] Guest `POST /api/submit` → `401 auth_required`
- [ ] Signed-in submit creates match with `owner_id = auth.uid()`

## Match

- [ ] Fixture select `async-race` and `json-merge`
- [ ] Model select only allowlisted ids
- [ ] `race_asymmetric` stores `objective_a` / `objective_b`
- [ ] Runner resolves `fixtures/<id>/` (not hardcoded async-race)
- [ ] Proxy uses match `model_id`; unknown id rejected
- [ ] Budget reserve uses per-model ceiling

## Social

- [ ] `/u/[handle]` follow / unfollow / friend request
- [ ] Match comments under finished verdict (Realtime insert)
- [ ] `/messages` open DM + Realtime message

## Tournaments

- [ ] Ops creates tournament → open → entrants register
- [ ] Advance seeds bracket + enqueues round-1 matches
- [ ] Finished edge advances winner; final sets `completed`

## Clips

- [ ] Finished match: pick start/end seq → clip row `queued`
- [ ] Runner `/clips/:id/render` → `ready` (+ Storage or local path)
- [ ] Non-participant non-ops cannot create

## Dashboards

- [ ] `/me` shows matches, tokens, friends, clips
- [ ] `/ops` (role=ops) toggles kill switch, lists fixtures, creates draft tournament

## Smoke

```bash
npm run smoke
```

Fixture matrix (honest + tamper) for every catalog id + model allowlist assert.
