# App Store Connect MCP — Roadmap

> **Vision**: The all-in-one App Store Connect MCP. Code mode. 2 tools. 923 endpoints. Zero token bloat.

## Current: v2.0.0 (shipped Mar 19, 2026)

- [x] Code mode architecture: 14 tools → 2 (search + execute)
- [x] Apple's official OpenAPI spec bundled (923 endpoints, 1337 schemas, API v4.3)
- [x] Sandboxed execution (Node.js vm — no network, no filesystem, no env vars)
- [x] JWT auth with P8 key (ES256, 19-min cache, invisible to sandbox)
- [x] All HTTP methods (GET/POST/PATCH/DELETE) via `api.request()`
- [x] Auto-decompression for gzipped report endpoints
- [x] $ref resolution in spec loader (flat traversal for generated code)
- [x] Response truncation (40K chars)
- [x] Fork bug fixes (console.error, ArrayBuffer, error matching, $0 gate, tsconfig)
- [x] Mock data killed (errors > fabrication)
- [x] MCP SDK upgraded to 1.27
- [x] Live-tested: 8 apps, reviews, chained execution confirmed
- [x] API coverage map documented (`docs/API-COVERAGE.md`)
- [x] Content seed captured for launch post

## Strategy: ASO Atlas Integration Plan

**How Atlas uses this day-to-day (cabinet-reviewed):**

### Week 1: Revenue in `/aso:pulse`
- [ ] Wire ASC sales reports into pulse (replace RevenueCat browser dependency)
- [ ] Daily iOS revenue via API (not browser scraping)

### Week 2: Reviews in wake report
- [ ] "New reviews since yesterday?" check on wake
- [ ] 1-2 star: surface full text. 4-5 star: count only.
- [ ] Sid reads, Sid decides. Atlas reports.

### Week 3: Subscription health in Monday sitrep
- [ ] Active subs, trial conversion, churn rate
- [ ] Weekly cadence only (not daily — creates anxiety without signal)

### After Week 3: Automation plays
- [ ] Screenshot caption automation (keyword intelligence → ASC metadata endpoints)
- [ ] Custom Product Pages per ad campaign (exterior → exterior CPP, kitchen → kitchen CPP)
- [ ] A/B test setup programmatically (test screenshot variants)
- [ ] Review response workflow (draft → AI Sid review → post)

## What the API Groups Enable

### Screenshots & Previews (39 endpoints) — AUTOMATE ASO VISUALS
- CREATE/UPDATE/DELETE screenshot sets and individual screenshots
- Upload captions with target keywords (Apple indexes these for ranking)
- Per Custom Product Page and per A/B test variant
- **Flow**: RAI renders → upload as screenshots → keyword-rich captions → programmatic

### Custom Product Pages (18 endpoints) — TAILORED AD LANDING PAGES
- Create CPPs with localized screenshots/previews per campaign
- Assign search keywords directly to CPPs
- "Exterior paint" campaign → CPP showing exterior renders
- Currently 100% manual UI work → fully automatable

### A/B Testing (24 endpoints) — CONVERSION OPTIMIZATION
- Create experiments + treatment variants programmatically
- Each variant gets its own screenshot/preview sets
- Start/stop/update experiments via API
- Measure conversion lift without App Store Connect UI

### Review Management (5 endpoints) — MONITOR + RESPOND
- Read all reviews (sorted, filtered by date/rating/territory)
- Post review responses (reply to reviews!)
- Delete/update existing responses
- **Flow**: daily check → surface bad reviews → Sid drafts response → post via API

### App Metadata (29 endpoints) — ASO KEYWORD MANAGEMENT
- Read/write title, subtitle, keywords, description
- Per-locale management (all localizations)
- **THE killer ASO feature**: update keywords programmatically based on ranking data

### Subscriptions & IAP (53 endpoints) — REVENUE INTELLIGENCE
- Subscription groups, pricing, promotional offers
- In-app purchase management + offer codes
- Win-back offers for churned users
- Trial conversion tracking

## Ship & Announce

- [ ] README rewrite — code mode is the headline
- [ ] GitHub release with changelog (v2.0.0)
- [ ] npm publish (check `appstore-connect-mcp` availability)
- [ ] Tweet: "2,455 lines deleted. 162 added. 923 endpoints through 2 tools."
- [ ] Blog post (if tweet gets traction)
- [ ] Submit to MCP directories (PulseMCP, etc.)

## Production Hardening (v2.1)

- [ ] Replace Node.js vm with `isolated-vm` for stricter sandbox
- [ ] Migrate from deprecated `Server` to `McpServer` class (MCP SDK)
- [ ] Proper test suite (vitest)
- [ ] CI/CD with GitHub Actions
- [ ] SSE transport option for remote deployment (from gamingflexer fork)

## Resolved Questions

1. ~~Does Apple publish an OpenAPI spec?~~ **YES** — official 6.4MB spec, 923 paths, API v4.3
2. ~~Report endpoints~~ Auto-decompressed in client.ts
3. ~~POST/PATCH in v2.0?~~ YES — `api.request()` supports all methods
4. npm publish — TBD
5. Truncation — 40K chars (Cloudflare's default, works well)

---

*"923 endpoints. 2 tools. The spec IS the implementation."*
