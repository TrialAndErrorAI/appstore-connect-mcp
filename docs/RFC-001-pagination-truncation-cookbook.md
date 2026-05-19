# RFC-001 — Companion Cookbook + Discoverability for ASC MCP

**Status**: v1 — May 19, 2026 — post /sharpen (3-lens adversarial review, cookbook-first reversal applied)

> **Born from**: May 19, 2026 — an LLM consumer of this MCP claimed an iOS app had "0 in-app events for 268 days" based on `api.request({ limit: 30 })` response. Reality: 40 events total, last live event 12 days prior (not 268). The agent didn't paginate, didn't know the `PAST` event state existed, missed the 10 most recent events. **Three bad analyses shipped before the user opened App Store Connect UI and corrected it.**

**Root cause**: not LLM judgment failure — **structural knowledge gap**. The MCP's existing `paginate()` and `getAll()` helpers in `AppStoreClient` already solve pagination. The LLM didn't know about them because the tool description only documents `api.request()`. Same for enum values (`PAST` vs `ARCHIVED`), gzipped reports, and other ASC quirks.

---

## The 80% Fix (Phase 1 — ship now)

### Fix 1 — Ship `docs/COOKBOOK.md`

Companion reference doc for LLM consumers. Mirrors the shape of the sister `asa-mcp-cookbook` (Apple Search Ads MCP). Single markdown file with:

- **Pagination contract**: list endpoints return one page; check `links.next`. Use cases:
  - "I want all results, <200 expected" → `api.request()` with `limit: 200`; check `links.next`; if present, paginate manually with hard cap or warn the user
  - "Streaming / early-exit / unknown size" → manual pagination via `links.next`, document why
- **Known enums** with semantic notes:
  - `eventState`: `DRAFT`, `READY_FOR_SALE` (live), `PAST` (was live, now ended), `ARCHIVED` (removed by team)
  - `appStoreState`: `PREPARE_FOR_SUBMISSION`, `READY_FOR_SALE`, `IN_REVIEW`, ... (full set)
  - Discriminator notes: `PAST` ≠ `ARCHIVED` — both are "not currently live" but `PAST` is auto-transitioned by Apple at event end, `ARCHIVED` is manual cleanup
- **Common pitfalls**:
  - Reports endpoints return gzipped data (auto-decompressed by client)
  - `sort` param rejected on some endpoints (e.g. `customerReviews`) — returns 400
  - Territory schedules embed 170 country codes → response bloat → output truncation risk
  - `customProductPages` is NOT under `/v1/apps/{id}/customProductPages` despite the URL pattern — needs spec query to find
- **Cookbook recipes** (worked examples):
  - "Pull all events with schedules" (the bug-origin scenario)
  - "Find PPO experiments + lift data"
  - "Recent customer reviews sorted by date (without `sort` param)"
  - "App preview video age check"
- **Field-selection guidance**: use `?fields[<resource>]=` to narrow response size when output truncation risk

### Fix 2 — Tool Description Integration (discoverability gate)

Amend tool descriptions in `src/server/mcp-server.ts` (both `execute` and `search`) with explicit cookbook reference:

```
**Before using this tool**, load the companion cookbook at `docs/COOKBOOK.md`
in this repo. It contains pagination contracts, enum tables, common pitfalls,
and worked recipes that prevent the most common consumer errors (wrong 30 of N
results, missing event states, response truncation).
```

This is the actual enforcement primitive. Tool description is the only always-on surface the LLM sees. Cookbook on disk without this pointer = ship-and-pray.

---

## Decision

**Phase 1 (ship now)**: Fixes 1 + 2 only. Zero code-surface risk. ~2 hours of work.

**Phase 2 (conditional — only if data justifies)**: code changes deferred. See §"Conditional Phase 2" below.

---

## Test Plan (Phase 1)

Single integration test — the actual bug-reproduction:

1. Fresh LLM session loaded with COOKBOOK.md
2. Query: "What's the state of in-app events for app 1661709494?"
3. Expected: LLM uses pagination (per cookbook guidance) to get all 40 events, correctly distinguishes `PAST` vs `ARCHIVED`, identifies the actual gap (12 days, not 268)

Per-fix unit tests skipped — tautological for the cookbook approach.

---

## Conditional Phase 2 (only if Phase 1 proves insufficient after 30d usage)

If we see continued LLM consumer errors in this MCP's logs that the cookbook didn't prevent:

### Phase 2A — Expose existing pagination helpers via sandbox

`AppStoreClient` already has `paginate()` (async generator, client.ts:96-117) and `getAll()` (materializes all pages, client.ts:122-130). Both unreachable from sandbox today.

Sandbox-side addition in `src/server/mcp-server.ts` executeTool 'execute' case (verbs match client.ts — no rename):

```ts
const api = {
  request: async (opts) => this.client.request(opts.path, opts.params, {
    method: opts.method,
    data: opts.body
  }),
  getAll: async (opts) => this.client.getAll(opts.path, opts.params),
  paginate: (opts) => this.client.paginate(opts.path, opts.params)
};
```

Tool description updated in lockstep — the full new signature block (not "single line"), with worked example.

**Mid-pagination failure handling**: `getAll()` currently throws and discards accumulated items on any page error. Phase 2A must change `getAll()` to return `{ items, complete: boolean, error?, pagesRetrieved }` so partial results survive 429s and network blips. Document in cookbook.

### Phase 2B — Sandbox truncation envelope (only if 200K bump insufficient)

Cheaper first move: bump `MAX_OUTPUT_CHARS` in `src/executor/sandbox.ts` from `40_000` to `200_000` (one-line change). Covers known territory-schedule-array case.

If 200K still hits frequently in logs, ship the structured envelope `{ result, warnings: [], truncated: false }` from the sandbox executor (NOT mutating `result` itself — Apple's JSON:API contract stays byte-identical per Quality review).

### Phase 2 sequencing rule

Only triggered by data. Specifically:
- ≥3 LLM consumer errors in 30 days where pagination was the cause despite cookbook → ship 2A
- Any truncation hit in 30 days on real query → bump to 200K
- Continued truncation hits after 200K → ship envelope

---

## Open Decisions — Resolved

1. **Backwards compatibility for `_paginationWarning`/`_truncated` fields in response**
   **Decision**: Per Quality review, Phase 2 (if shipped) will use an envelope `{ result, warnings[], truncated }` returned by the sandbox executor — NOT mutate Apple's response object. Phase 1 ships only cookbook, so this is moot until Phase 2 triggers.

2. **`requestAll()` safety cap**
   **Decision**: Cookbook teaches "use existing `getAll` only when expected results <200; for larger endpoints paginate manually with explicit cap." No hard cap in code — lean on rate limiter for runaway protection. Revisit if production logs show any single `getAll` call exceeding 50 pages.

3. **Truncation envelope `preview` size**
   **Decision**: Deferred. Phase 2B starts with `MAX_OUTPUT_CHARS = 200_000` (one-line change). Envelope only if 200K proves insufficient.

---

## Maintenance Contract

Tool description in `mcp-server.ts` MUST reference `docs/COOKBOOK.md` and stay in sync. Any change to one requires reviewing the other. Enforce via repo CI check or commit-time review.

---

## Why This Is The Right Shape

- **Cookbook-first matches the actual failure**: LLM didn't know to paginate. Code didn't need fixing — knowledge did.
- **Zero code-surface risk**: no API changes, no response-shape mutation, no sandbox executor changes in Phase 1.
- **Cheap to ship + measure**: ~2 hours, then observe 30 days.
- **Reversible**: if cookbook is insufficient, Phase 2 is well-scoped and triggered by real data, not speculation.
- **Mirrors sister MCP discipline**: asa-mcp ships its cookbook the same way. Single pattern across both MCPs reduces consumer learning curve.

---

## /sharpen Receipt (v0 → v1)

3-lens review (Reuse + Quality + Efficiency) returned 20 findings. Convergent (2+ lenses agreed):
- **Ship cookbook FIRST**, defer code changes — restructured RFC from 3 parallel fixes to Phase 1 + Conditional Phase 2
- **Response-shape pollution** — Phase 2 (when triggered) uses envelope, not field-mutation
- **Naming consistency** — use `getAll`/`paginate` matching client.ts, not invented `requestAll`
- **Cookbook discoverability via tool-description integration** — added as Fix 2, made it the actual enforcement primitive
- **Open Decisions resolved** — all 3 resolved with explicit rationale + revisit triggers

Singletons applied:
- Demoted Bug 2 (truncation) — separate incident, footnoted
- Quality #4 (mid-pagination partial-failure) → added to Phase 2A scope
- Efficiency #2 (defer envelope, start with 200K bump) → resolved as Phase 2B first step
- Maintenance §Contract added

Skipped (false positives or out-of-scope):
- Reuse #3 (check asa-mcp first) — kept as informational in cookbook lineage note rather than blocking RFC

---

*v1 — May 19, 2026 — Tue 17:00 EDT. Ready for sign-off → COOKBOOK.md draft + tool description amend (Phase 1).*
