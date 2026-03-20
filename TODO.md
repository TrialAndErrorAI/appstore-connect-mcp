# App Store Connect MCP — Roadmap

> **Vision**: The all-in-one App Store Connect MCP. Code mode. 2 tools. 100+ endpoints. Zero token bloat.

## Current: v1.2.0 (shipped Mar 19, 2026)

- [x] JWT auth with P8 key (ES256, 19-min cache)
- [x] 14 traditional MCP tools (apps, sales, finance, subs, reviews, beta, analytics)
- [x] Gzip decompression for Apple report endpoints
- [x] Rate limiting (3600/hr)
- [x] Mock data killed (errors > fabrication)
- [x] Fork fixes cherry-picked (console.error, ArrayBuffer, error matching, $0 gate, tsconfig)
- [x] MCP SDK upgraded to 1.27
- [x] Live-tested with real App Store Connect account

## Next: v2.0 — Code Mode (RFC-002)

**The big refactor: 14 tools → 2 tools (search + execute)**

See `docs/RFC-002-code-mode.md` for full architecture.

### Build (one session)
- [ ] Build API spec object (`src/spec/appstore-connect.ts`) — Phase 1 endpoints
- [ ] Build sandbox executor (`src/executor/sandbox.ts`) — Node.js vm
- [ ] Rewrite mcp-server.ts — 2 tools only (search + execute)
- [ ] Simplify client.ts — add sandbox-friendly `request()` method
- [ ] Delete all service files (7 files)
- [ ] Test: search discovers endpoints → execute calls them
- [ ] Test: chained execution (list apps → get reviews)

### Ship
- [ ] Version bump → v2.0.0
- [ ] README rewrite — code mode is the headline
- [ ] GitHub release with changelog
- [ ] npm publish (check package name availability)

### Announce
- [ ] Tweet: "14 tools → 2. Your LLM writes the query."
- [ ] Blog post (if tweet gets traction)
- [ ] Submit to MCP directories (PulseMCP, etc.)

## v2.1 — Expand API Coverage

- [ ] App metadata read/write (appInfoLocalizations) — **ASO killer feature**
- [ ] In-App Purchase management (subscriptionGroups, inAppPurchases)
- [ ] Version management (appStoreVersions, phased releases)
- [ ] Pricing across territories (appPrices)
- [ ] What's New text (appStoreVersionLocalizations)

## v2.2 — Production Hardening

- [ ] Replace Node.js vm with `isolated-vm` for stricter sandbox
- [ ] Response truncation tuning
- [ ] Migrate from deprecated `Server` to `McpServer` class (MCP SDK)
- [ ] Proper test suite (vitest)
- [ ] CI/CD with GitHub Actions

## Unresolved Questions

1. Does Apple publish an OpenAPI spec, or hand-build from docs?
2. Report endpoints (gzipped CSV) — auto-decompress in execute, or expose in spec?
3. Ship POST/PATCH (write) endpoints in v2.0 or v2.1?
4. npm package name: `appstore-connect-mcp` available?
5. Response truncation threshold: 40K chars or tune for App Store data?

---

*"Fixed token cost. Infinite API surface. The agent writes the query."*
