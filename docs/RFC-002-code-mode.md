# RFC-002: Code Mode Architecture — v2.0

**Author**: Sid Sarasvati / Atlas
**Date**: March 19, 2026
**Status**: DRAFT — Ready for review

---

## Problem

v1.2.0 exposes 14 individual MCP tools. Each tool = one API endpoint wrapper. Each tool schema consumes context tokens.

Apple's App Store Connect API has **100+ endpoints** across apps, builds, sales, subscriptions, analytics, TestFlight, reviews, pricing, metadata, screenshots, IAP, phased releases, and more.

Traditional MCP can't scale:
- 14 tools = ~14K schema tokens. Manageable.
- 50 tools = ~50K tokens. Painful.
- 100 tools = ~100K tokens. Impossible.

Every new endpoint requires: new service method + new tool definition + new handler case + rebuild + release. Linear cost, zero leverage.

## Solution

Refactor to **Code Mode**: 2 tools replace all 14 (and future 100+).

```
search(code)  — LLM writes JS to query the API spec → discovers endpoints
execute(code) — LLM writes JS against authenticated client → calls API
```

The LLM writes the query. Auth is injected. Adding endpoints = updating the spec object. Zero tool changes.

### Token economics

| State | Tools | Schema tokens | Adding 50 endpoints |
|-------|-------|---------------|---------------------|
| v1.2.0 (current) | 14 | ~14K | +50 tools, +50K tokens |
| v2.0 (code mode) | 2 | ~1K | Update spec object. 0 new tokens. |

## Architecture

```
Claude writes JS/TS
    │
    ▼
┌─────────────────────────────────────────────┐
│ search({ code })                            │
│                                             │
│  Sandbox executes code with `spec` object   │
│  Agent filters paths, reads schemas         │
│  Returns: matching endpoints + params       │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ execute({ code })                           │
│                                             │
│  Sandbox executes code with `api` client    │
│  api.request({ method, path, body, params })│
│  JWT auth injected — invisible to code      │
│  Supports chaining multiple calls           │
│  Returns: API response data                 │
└─────────────────────────────────────────────┘
    │
    ▼
Only results enter context
```

### Components

**1. API Spec Object** (`spec`)
- Hand-built from Apple's App Store Connect API docs
- All paths, methods, parameters, response shapes
- Pre-resolved (no $ref pointers — flat structure)
- Injected into `search` sandbox as `spec` global

**2. Authenticated Client** (`api`)
- Wraps our existing JWTManager + axios client
- Single method: `api.request({ method, path, body?, params? })`
- JWT token auto-refreshed (19-min cache already built)
- Injected into `execute` sandbox as `api` global

**3. Sandbox Executor**
- Runs LLM-generated code in isolation
- Phase 1: Node.js `vm` module (fast prototype, acceptable for local MCP)
- Phase 2: Consider `isolated-vm` for stricter isolation if publishing to npm
- No network access, no filesystem, no env vars in sandbox
- Timeout enforcement (10s default)
- Output truncation (~40K chars)

**4. MCP Server** (simplified)
- 2 tools instead of 14
- Tool descriptions teach the LLM how to use search/execute
- Error handling at tool level (same pattern as v1.2.0)

## API Spec Coverage

### Phase 1 — Ship with these (what v1.2.0 already covers)

| Category | Endpoints | Priority |
|----------|-----------|----------|
| Apps | GET /v1/apps, GET /v1/apps/{id} | P0 |
| Sales Reports | GET /v1/salesReports | P0 |
| Finance Reports | GET /v1/financeReports | P0 |
| Customer Reviews | GET /v1/apps/{id}/customerReviews | P0 |
| Beta Testers | GET /v1/betaTesters | P1 |
| Beta Groups | GET /v1/betaGroups | P1 |
| Builds | GET /v1/builds | P1 |

### Phase 2 — Expand (new capabilities)

| Category | Endpoints | Value |
|----------|-----------|-------|
| App Info + Localizations | GET/PATCH appInfoLocalizations | **ASO metadata read/write** |
| App Store Versions | GET/POST/PATCH appStoreVersions | Version management |
| In-App Purchases | GET/POST inAppPurchases | IAP management |
| Subscription Groups | GET/POST subscriptionGroups | Sub management |
| Phased Releases | GET/PATCH appStoreVersionPhasedReleases | Release control |
| Pricing | GET/POST appPrices | Pricing across territories |
| Screenshots | GET/POST appScreenshotSets | Screenshot management |

### Phase 3 — Full coverage

Everything else in Apple's API. The point of code mode is: **adding these requires ZERO tool changes**. Just expand the spec object.

## Tool Descriptions (Critical — these teach the LLM)

### search tool

```
Write JavaScript to explore the App Store Connect API specification.

Available globals:
- `spec` — Object with all API endpoints. Structure: spec.paths['/v1/endpoint'].method

How to use:
- List all endpoints: Object.keys(spec.paths)
- Filter by category: Object.entries(spec.paths).filter(([path]) => path.includes('/apps/'))
- Get endpoint details: spec.paths['/v1/apps'].get
- Check parameters: spec.paths['/v1/apps'].get.parameters
- Check response shape: spec.paths['/v1/apps'].get.responses

Return your findings as a value or use console.log().

Example:
  const sales = Object.entries(spec.paths)
    .filter(([p]) => p.includes('salesReport'))
    .map(([path, methods]) => ({ path, methods: Object.keys(methods) }));
  return sales;
```

### execute tool

```
Write JavaScript to call the App Store Connect API.

Available globals:
- `api` — Authenticated client. Auth is automatic (JWT injected).

Usage:
  const result = await api.request({
    method: 'GET',           // GET, POST, PATCH, DELETE
    path: '/v1/apps',        // API path
    params: { limit: '10' }, // Query parameters (optional)
    body: { ... }            // Request body for POST/PATCH (optional)
  });

The response is parsed JSON. Chain multiple calls in one execution.
Use try/catch for error handling.

Example — list apps then get reviews for first app:
  const apps = await api.request({ method: 'GET', path: '/v1/apps', params: { limit: '5' } });
  const appId = apps.data[0].id;
  const reviews = await api.request({
    method: 'GET',
    path: `/v1/apps/${appId}/customerReviews`,
    params: { limit: '10', sort: '-createdDate' }
  });
  return { apps: apps.data.length, latestReview: reviews.data[0]?.attributes };
```

## Migration: v1.2.0 → v2.0

### What stays
- JWT auth layer (JWTManager) — proven, working
- Axios HTTP client — proven, working
- Gzip decompression for report endpoints
- Currency conversion for financial data
- Package structure (src/auth, src/api, src/server)

### What changes
- `src/server/mcp-server.ts` — 14 tool definitions → 2
- `src/services/*` — DELETE all service files. Logic moves to spec + client.
- NEW: `src/spec/appstore-connect-spec.ts` — API spec object
- NEW: `src/executor/sandbox.ts` — Code executor with vm module
- `src/api/client.ts` — Add simple `request()` method for sandbox use

### What gets deleted
- `src/services/app-service.ts`
- `src/services/finance-service.ts`
- `src/services/finance-report-service.ts`
- `src/services/subscription-service.ts`
- `src/services/analytics-service.ts`
- `src/services/beta-service.ts`
- `src/services/review-service.ts`
- All test-*.ts files (rewrite for new architecture)

### Backwards compatibility
None needed. This is a major version bump (v2.0). Clean break.

## Sandbox Design

### Node.js vm (Phase 1)

```typescript
import { createContext, runInNewContext } from 'vm';

async function executeInSandbox(
  code: string,
  globals: Record<string, any>,
  timeout: number = 10000
): Promise<{ result: any; logs: string[] }> {
  const logs: string[] = [];
  const context = createContext({
    ...globals,
    console: { log: (...args: any[]) => logs.push(args.map(String).join(' ')) },
    setTimeout: undefined,
    setInterval: undefined,
    fetch: undefined,
    require: undefined,
    process: undefined,
  });

  const wrappedCode = `(async () => { ${code} })()`;
  const result = await runInNewContext(wrappedCode, context, { timeout });

  return { result, logs };
}
```

### Security measures
- `fetch`, `require`, `process` explicitly undefined
- `setTimeout`/`setInterval` blocked
- vm timeout enforcement (10s)
- Output truncation before returning to MCP
- Only `spec` (read-only) or `api` (authenticated) available as globals

## File Structure (v2.0)

```
src/
├── auth/
│   └── jwt-manager.ts          # KEEP — JWT with P8 key
├── api/
│   └── client.ts               # SIMPLIFY — add sandbox-friendly request()
├── spec/
│   └── appstore-connect.ts     # NEW — API spec object
├── executor/
│   └── sandbox.ts              # NEW — vm-based code executor
├── server/
│   └── mcp-server.ts           # REWRITE — 2 tools only
├── types/
│   ├── api.ts                  # KEEP
│   └── config.ts               # KEEP
└── index.ts                    # KEEP — entry point
```

## Launch Plan

### Build (1 session)
1. Build spec object (Phase 1 endpoints)
2. Build sandbox executor
3. Rewrite mcp-server.ts (2 tools)
4. Simplify client.ts
5. Delete service files
6. Test: search discovers apps endpoint → execute lists apps
7. Test: search finds reviews → execute pulls reviews
8. Test: chained execution (list apps → get reviews for first)

### Ship
1. Version bump → v2.0.0
2. README rewrite — code mode is the headline
3. Commit + push
4. GitHub release with changelog

### Announce
1. Tweet: "14 tools → 2 tools. App Store Connect MCP with Code Mode. Your LLM writes the query."
2. Blog post (if tweet gets traction): technical walkthrough
3. Submit to MCP directories (PulseMCP, etc.)

## Unresolved Questions

1. **Apple OpenAPI spec**: Does Apple publish one, or do we hand-build from docs?
2. **Report endpoints**: Sales/finance reports return gzipped CSV, not JSON. Should `execute` handle decompression automatically, or expose it in the spec?
3. **POST/PATCH endpoints**: Code mode enables WRITE operations. Do we ship those in v2.0 or add in v2.1?
4. **npm publish**: v2.0 is the right time. Package name available? `appstore-connect-mcp`?
5. **Response truncation threshold**: 40K chars (Cloudflare's default) or different for App Store data?

---

*"14 tools → 2 tools. Fixed token cost. Infinite API surface."*
*"The agent writes the query. We provide the spec and the auth."*
