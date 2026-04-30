# Changelog

## 2.0.0 — 2026-04-30

First public npm release as `@trialanderror-ai/appstore-connect-mcp`.

- **Code Mode architecture**: 923 App Store Connect endpoints exposed through 2 tools (`search`, `execute`) plus a `test_connection` health check.
- **Spec-driven**: Apple's OpenAPI spec ships in the package; LLMs query it directly. Adding endpoints = Apple updates their spec, zero code changes here.
- **Sandboxed execution**: `vm` runs LLM-written JS in an isolated context with the Apple API client + spec injected.
- **JWT auth**: ES256 P8 key signing, 19-minute token cache (1-min buffer under Apple's 20-min ceiling).
- Inspired by [Cloudflare's Code Mode pattern](https://blog.cloudflare.com/code-mode/).

Internal versions 1.0–1.2 (service-style API, never npm-published) preceded this release. The 2.0 jump reflects the architectural rewrite to code mode.
