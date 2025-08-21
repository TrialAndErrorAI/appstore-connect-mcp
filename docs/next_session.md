# Next Session Bootstrap - App Store Connect MCP Server

## Current Status
✅ **MVP COMPLETE AND WORKING IN PRODUCTION**
- Successfully retrieving data from 5 apps including RenovateAI (#28 in Design Tools)
- JWT authentication with P8 keys working
- 8 MCP tools exposed to Claude Desktop
- Clean JSON-RPC communication established

## RFC-001 Completion Status: 85% Complete ✅
See full report: `/docs/RFC-001-completion-report.md`

### Completed (Working in Production)
- ✅ Authentication Layer (100%) - JWT with P8 keys
- ✅ API Client (100%) - Rate limiting, pagination  
- ✅ MCP Server (100%) - 8 tools exposed to Claude
- ✅ App Service (100%) - List/get apps working
- ✅ Finance Service (70%) - Basic reports working

### Missing (To Complete RFC)
- ❌ Analytics Service (0%) - `src/services/analytics-service.ts`
- ❌ Beta Service (0%) - `src/services/beta-service.ts`  
- ❌ Review Service (0%) - `src/services/review-service.ts`
- ❌ Test Suite (0%) - Unit and integration tests
- ❌ Performance Caching (0%) - Response caching layer

### Decision
✅ **SHIP IT** - 85% provides immediate business value. Complete remaining services in v1.1.

## Critical Files to Read First
1. `/Users/sid/Code/te/appstore-connect-mcp/CLAUDE.md` - MCP server development lessons
2. `/Users/sid/Code/te/appstore-connect-mcp/src/index.ts` - See console suppression pattern
3. `/Users/sid/Code/te/appstore-connect-mcp/src/auth/jwt-manager.ts` - JWT without scope field
4. `/Users/sid/Code/te/appstore-connect-mcp/.env` - Has real credentials (DO NOT COMMIT)

## Known Issues to Fix
1. Financial reports need version parameter: `version: "1_4"`
2. Sales report returns compressed data - needs decompression
3. Analytics service is just a stub - needs implementation

## Next Priority Tasks
1. Complete Analytics Service implementation
2. Add Beta Service for TestFlight
3. Add Review Service for ratings
4. Then fix financial reports and publish to npm

## Testing Commands
```bash
# Test auth (use explicit env vars to avoid dotenv issues)
APP_STORE_KEY_ID=YOUR_KEY_ID APP_STORE_ISSUER_ID=YOUR_ISSUER_ID APP_STORE_P8_PATH=/path/to/AuthKey.p8 npx tsx src/test-auth.ts

# Test API
source .env && npm run test:api

# Check MCP logs
tail -f ~/Library/Logs/Claude/mcp-server-appstore-connect.log
```

## Architecture Context
- Three-layer: Auth (JWT) → API Client (axios) → MCP Server
- Rate limiting: 3600 requests/hour
- Token caching: 19 minutes (refresh before 20 min expiry)
- P8 key stored securely at: `~/.config/appstore-connect/`

## Philosophy (from CLAUDE.md)
- Fix the problem, not the blame
- Find root causes, not symptoms
- Test with single commands
- Use tracer bullets - get end-to-end working first

## Remember
- NO console.log in production code (breaks JSON-RPC)
- dotenv outputs to stdout - must suppress
- Apple JWT has no 'scope' field
- Test everything with real API before committing