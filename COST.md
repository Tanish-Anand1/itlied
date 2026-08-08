# Match cost estimate (Part 6 — before runner)

**Model:** `gpt-4.1`  
**List prices (verified 2026-08):** $2.00 / 1M input · $8.00 / 1M output  

## Ceilings

| Limit | Value |
|---|---|
| Wall clock | 300s / agent |
| Tool calls | 40 / agent |
| Tokens | **80,000** / agent (proxy-enforced) |
| Match agents | 2 (identical model, temp, tools) |

## Worst-case match cost

Assumed mix at ceiling: **75% input / 25% output** (typical tool-calling loop).

```
Per agent:
  input  60,000 × $2.00/1M = $0.120
  output 20,000 × $8.00/1M = $0.160
  ─────────────────────────────────
  agent total                $0.280

Per match (both agents hit ceiling):
  2 × $0.280 = $0.560
```

**Ceiling cost per match: $0.56**

## Daily budget cap

| Cap | Max matches at ceiling |
|---|---|
| **$50 / day** | ≈ **89** |

The runner checks `daily_spend_cents` against `DAILY_BUDGET_CENTS` (default `5000`)
before matchmaking. Crossing the cap flips the global kill switch and rejects
new matches until the next UTC day.

This kill switch is built before the first match can run.
