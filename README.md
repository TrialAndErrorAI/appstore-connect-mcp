# App Store Connect MCP Server — Code Mode

**923 endpoints. 2 tools. The spec IS the implementation.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.27-green)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![API Version](https://img.shields.io/badge/ASC%20API-v4.3-orange)](https://developer.apple.com/app-store-connect/api/)

## The Problem

Traditional MCP servers wrap each API endpoint as a separate tool. Apple's App Store Connect API has **923 endpoints**. That means 923 tool definitions, ~100K+ context tokens, and a new release every time Apple adds an endpoint.

## The Solution

Code Mode: **2 tools replace 923**.

| Tool | What It Does |
|------|-------------|
| `search(code)` | Write JS to query Apple's OpenAPI spec. Discover endpoints, check parameters, read schemas. |
| `execute(code)` | Write JS to call the API. Auth is automatic. Chain multiple calls. |

The LLM writes the query. The spec IS the implementation. Adding endpoints = Apple updates their spec. Zero code changes on our side.

```
Traditional MCP:  923 endpoints → 923 tools → ~100K tokens → constant maintenance
Code Mode:        923 endpoints → 2 tools   → ~1K tokens   → zero maintenance
```

## Quick Start

```bash
git clone https://github.com/TrialAndErrorAI/appstore-connect-mcp
cd appstore-connect-mcp
npm install
npm run build
```

### Configure for Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "node",
      "args": ["/path/to/appstore-connect-mcp/dist/index.js"],
      "env": {
        "APP_STORE_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_P8_PATH": "/path/to/AuthKey.p8",
        "APP_STORE_VENDOR_NUMBER": "YOUR_VENDOR_NUMBER"
      }
    }
  }
}
```

### Configure for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "node",
      "args": ["/path/to/appstore-connect-mcp/dist/index.js"],
      "env": {
        "APP_STORE_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_P8_PATH": "/path/to/AuthKey.p8"
      }
    }
  }
}
```

### Get Credentials

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Integrations → Keys
2. Click "+" to generate a new key (Admin or Finance role)
3. Download the .p8 file (only downloadable once!)
4. Note your Key ID and Issuer ID

## Usage Examples

### Discover endpoints

```
search: "Find all endpoints related to customer reviews"
```

The LLM writes:
```javascript
const reviews = Object.entries(spec.paths)
  .filter(([p]) => p.includes('customerReview'))
  .map(([path, methods]) => ({
    path,
    methods: Object.keys(methods).map(m => m.toUpperCase())
  }));
return reviews;
```

### List your apps

```
execute: "List all my apps"
```

The LLM writes:
```javascript
const apps = await api.request({ method: 'GET', path: '/v1/apps' });
return apps.data.map(a => ({ id: a.id, name: a.attributes.name }));
```

### Chain multiple calls

```
execute: "Get latest reviews for my first app"
```

The LLM writes:
```javascript
const apps = await api.request({ method: 'GET', path: '/v1/apps', params: { limit: '1' } });
const appId = apps.data[0].id;
const reviews = await api.request({
  method: 'GET',
  path: `/v1/apps/${appId}/customerReviews`,
  params: { limit: '5', sort: '-createdDate' }
});
return {
  app: apps.data[0].attributes.name,
  reviews: reviews.data.map(r => ({
    rating: r.attributes.rating,
    title: r.attributes.title,
    body: r.attributes.body
  }))
};
```

## What You Can Access

All 923 App Store Connect API endpoints, including:

| Category | Endpoints | What You Get |
|----------|-----------|-------------|
| **App Metadata** | 29 | Title, subtitle, keywords, description — read AND write |
| **Analytics** | 10 | Impressions, page views, downloads, source attribution |
| **Sales & Finance** | 2 | Revenue, units, proceeds by country |
| **Customer Reviews** | 5 | Ratings, review text, respond to reviews |
| **Subscriptions** | 30 | Sub management, pricing, groups, offers |
| **In-App Purchases** | 29 | IAP management, offer codes |
| **Versions** | 28 | Version management, phased rollout |
| **Screenshots** | 12 | Upload, reorder, manage screenshot sets |
| **A/B Testing** | 24 | Product page experiments, treatment variants |
| **Custom Product Pages** | 18 | Custom landing pages per ad campaign |
| **TestFlight** | 23 | Beta groups, testers, builds |
| **Pricing** | 11 | Per-territory pricing, price points |
| **Builds** | 29 | Build management, processing state |

See [API-COVERAGE.md](docs/API-COVERAGE.md) for the full grouped map.

## How It Works

```
Claude writes JavaScript
    │
    ▼
┌─────────────────────────────────────────────────┐
│ search({ code })                                │
│  Sandbox executes code against OpenAPI spec     │
│  923 paths, 1337 schemas — pre-resolved $refs   │
│  Returns: matching endpoints + parameters       │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│ execute({ code })                               │
│  Sandbox executes code against auth'd client    │
│  JWT injected — code never sees credentials     │
│  Supports GET/POST/PATCH/DELETE + chaining      │
│  Auto-decompresses gzipped report responses     │
│  Returns: API response (truncated to 40K chars) │
└─────────────────────────────────────────────────┘
```

### Security

- Code runs in Node.js `vm` sandbox
- No `fetch`, `require`, `process`, `eval`, `setTimeout` available
- Credentials injected via binding — never visible to generated code
- Response truncated to prevent context bloat
- Only `spec` (search) or `api` (execute) available as globals

## Architecture

```
src/
├── auth/jwt-manager.ts      — JWT with P8 key, ES256, 19-min cache
├── api/client.ts             — HTTP client, rate limiting, gzip handling
├── spec/
│   ├── openapi.json          — Apple's official spec (923 endpoints)
│   └── loader.ts             — Loads + resolves $refs for flat traversal
├── executor/sandbox.ts       — vm-based sandboxed execution
├── server/mcp-server.ts      — MCP server (3 tools)
└── index.ts                  — Entry point
```

## Why Code Mode?

| | Traditional MCP | Code Mode |
|---|---|---|
| **Tools** | 1 per endpoint (923) | 2 total |
| **Context tokens** | ~100K+ | ~1K |
| **Adding endpoints** | New tool + code + schema + release | Apple updates spec. Zero changes. |
| **Chaining calls** | Re-enter LLM between each | Single execution, multiple calls |
| **Maintenance** | Update 923 tool definitions | Update 1 spec file |

Inspired by [Cloudflare's Code Mode pattern](https://blog.cloudflare.com/code-mode/).

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile + copy spec
npm run dev          # Watch mode (tsx)
npm start            # Run compiled server
npm run type-check   # TypeScript check
```

## License

MIT — Use it, modify it, sell it. Just make it work.

## Credits

Built by [Trial and Error Inc](https://trialanderror.ai).

First production use: [RenovateAI](https://renovateai.app) — AI home design, #28 in Design Tools.

Code mode pattern from [Cloudflare](https://blog.cloudflare.com/code-mode/).

---

*"We don't implement individual endpoints. We implement the ability to call ANY endpoint."*
