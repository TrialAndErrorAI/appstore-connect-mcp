# App Store Connect MCP Project Memory

## ⚠️ PUBLIC REPOSITORY RULES
- **This is a PUBLIC GitHub repository**
- **NEVER include specific revenue numbers in commits**
- **Keep commit messages vague about financial data**
- **Use terms like "improved accuracy" not specific percentages**
- **Remove actual dollar amounts from documentation**

## 🚨 PROJECT CONTEXT
**Created**: August 21, 2025 @ 2:24 PM  
**Why**: NPM package @joshuarileydev/app-store-connect-mcp-server returns 404. We build our own.  
**Timeline**: 3 hours to MVP, shipping TODAY  
**First User**: RenovateAI (90% of revenue is iOS - CRITICAL)  

## 🎯 CURRENT STATUS (3:32 PM - Aug 21)
- ✅ PRFAQ written - vision clear
- ✅ RFC-001 drafted - architecture defined  
- ✅ Project structure created in ~/Code/te/appstore-connect-mcp
- ✅ Authentication layer complete - JWT generation working
- ✅ API client built - rate limiting, pagination, error handling
- ✅ MCP server wrapper done - 8 tools exposed to Claude
- ✅ TypeScript compiles successfully
- ✅ Published to GitHub: https://github.com/TrialAndErrorAI/appstore-connect-mcp
- ✅ First Trial and Error Inc open source contribution
- 🔄 Ready to test with RenovateAI credentials
- ⏳ Need App Store Connect API key to proceed

## 🚀 NEXT STEPS (Priority Order)
1. **Get App Store Connect Credentials**
   - Login to App Store Connect with RenovateAI account
   - Generate API Key (Admin or Finance role)
   - Download P8 file (ONLY downloadable once!)
   - Note KEY_ID and ISSUER_ID
   - Find VENDOR_NUMBER in Payments section

2. **Test Authentication**
   ```bash
   cd ~/Code/te/appstore-connect-mcp
   cp .env.example .env
   # Add credentials to .env
   npm run test:auth
   ```

3. **Test API Connection**
   ```bash
   npm run test:api
   ```

4. **Configure Claude Desktop**
   - Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Add MCP server configuration
   - Restart Claude Desktop

5. **Complete SID-157**
   - Pull real metrics using Claude
   - No more estimates!

## 🏗️ ARCHITECTURE DECISIONS

### Core Stack
- **TypeScript** - Type safety for Apple's complex API
- **MCP SDK** - @modelcontextprotocol/sdk for server
- **jsonwebtoken** - JWT generation for Apple auth
- **axios** - HTTP client (reliable, well-tested)
- **No heavy frameworks** - Keep it simple

### Key Design Choices
1. **Local-first**: Runs on developer machine, not SaaS
2. **Generic package**: Not RenovateAI-specific, helps everyone
3. **Minimal dependencies**: Less to break
4. **AI-optimized responses**: Format for Claude consumption
5. **Automatic pagination**: Handle large datasets gracefully

### Three-Layer Architecture
```
1. Auth Layer (src/auth/)
   - JWT generation from P8 key
   - Token caching (19-min validity)
   - Auto-refresh

2. API Client (src/api/)  
   - Typed wrappers for Apple endpoints
   - Rate limiting (3600/hour)
   - Pagination with async generators

3. MCP Server (src/server/)
   - Tool definitions for Claude
   - Response formatting
   - Error handling
```

## 📚 APPLE API REFERENCE

### Authentication
- **Base URL**: `https://api.appstoreconnect.apple.com/v1`
- **Auth Header**: `Authorization: Bearer [JWT_TOKEN]`
- **Token Expiry**: 20 minutes (we refresh at 19)
- **Algorithm**: ES256 with P8 private key

### Critical Endpoints We Need
```typescript
// Financial
GET /v1/salesReports
GET /v1/financeReports  

// Analytics
GET /v1/analyticsReportRequests
GET /v1/apps/{id}/analyticsReportRequests

// Apps
GET /v1/apps
GET /v1/apps/{id}

// Beta
GET /v1/betaTesters
GET /v1/betaGroups

// Reviews
GET /v1/customerReviews
GET /v1/apps/{id}/customerReviews
```

### JWT Token Structure
```javascript
{
  "iss": "ISSUER_ID",        // Your issuer ID
  "iat": 1234567890,          // Issued at (unix timestamp)
  "exp": 1234568890,          // Expires (20 min from iat)
  "aud": "appstoreconnect-v1", // Always this value
  "scope": ["GET"]            // Read-only by default
}
```

## 🧪 TESTING APPROACH

### Manual Testing Commands
```bash
# Test JWT generation
npm run test:auth

# Test single API call
npm run test:api -- --endpoint /v1/apps

# Test MCP server locally
npm run dev

# Full integration test
npm run test:integration
```

### Test with Real Credentials
1. Create `.env.test` with:
   ```
   APP_STORE_KEY_ID=your_key
   APP_STORE_ISSUER_ID=your_issuer
   APP_STORE_P8_PATH=/path/to/key.p8
   ```
2. Run: `npm run test:real`

## 🛠️ COMMON COMMANDS

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run type-check   # Check types only

# Testing
npm test            # Run test suite
npm run test:watch  # Test with watch mode

# Production
npm start           # Run compiled version
npm run docker:build # Build Docker image
npm run docker:run   # Run in container
```

## 🐛 KNOWN ISSUES & SOLUTIONS

### Issue: "Invalid JWT token"
**Solution**: Check P8 key format - must include header/footer lines:
```
-----BEGIN PRIVATE KEY-----
[key content]
-----END PRIVATE KEY-----
```

### Issue: Rate limit (429)
**Solution**: Built-in exponential backoff. If persists, reduce request frequency.

### Issue: Empty responses
**Solution**: Check app ID exists and you have access permissions.

## 📝 TODO IMPLEMENTATION ORDER

1. **Authentication (CURRENT)**
   - [x] Create directory structure
   - [ ] Implement JWTManager class
   - [ ] Test token generation
   - [ ] Add token caching

2. **API Client**
   - [ ] Create base client class
   - [ ] Add request method with auth
   - [ ] Implement pagination
   - [ ] Add rate limiting

3. **MCP Server**  
   - [ ] Initialize MCP SDK server
   - [ ] Define tool schemas
   - [ ] Map tools to API calls
   - [ ] Format responses for AI

4. **Testing**
   - [ ] Test with RenovateAI credentials
   - [ ] Verify all tools work
   - [ ] Check Claude Desktop integration
   - [ ] Performance testing

5. **Polish**
   - [ ] Error messages
   - [ ] Documentation
   - [ ] npm publish
   - [ ] GitHub release

## 🔑 CREDENTIALS NEEDED

From App Store Connect → Users and Access → Keys:
1. **KEY_ID**: 10-character string (e.g., ABC123DEF4)
2. **ISSUER_ID**: UUID format (e.g., 12345678-1234-1234-1234-123456789012)
3. **P8 File**: Private key (download once, keep secure)
4. **VENDOR_NUMBER**: (optional) For financial reports - find in Payments section

## 💡 KEY INSIGHTS

1. **Apple's API is well-designed** - Consistent patterns, good docs
2. **JWT auth is straightforward** - Just sign with P8 key
3. **Rate limits are generous** - 3600/hour is plenty
4. **Pagination is required** - Some endpoints return lots of data
5. **MCP SDK is minimal** - Most work is in API client

## ⚡ QUICK WINS

- Start with `/v1/apps` endpoint - simplest, no parameters
- Financial reports are most valuable for RenovateAI
- TestFlight data is easy and impressive
- Reviews/ratings are great for demos

## 🚀 SHIPPING CHECKLIST

- [ ] All tests passing
- [ ] Works in Claude Desktop
- [ ] README has clear instructions  
- [ ] Credentials documented
- [ ] npm package published
- [ ] GitHub repo public
- [ ] Tweet announcement
- [ ] Update Linear ticket

## 🎯 SUCCESS METRICS

- **Technical**: Response time < 2 seconds
- **Adoption**: 100+ GitHub stars week 1
- **Quality**: Zero critical bugs
- **Business**: SID-157 completed with real data

---

## SESSION NOTES

### Aug 21, 2:32 PM
- Made architectural decision to build from here (not separate Claude session)
- Maintaining flow and context in main secondbrain workspace
- Thursday no-meeting day - perfect for deep work
- Energy is high, momentum building

### Implementation Strategy
- Write code directly, test immediately
- No over-engineering - MVP first
- Use RenovateAI as test case
- Ship working code today

## 🔧 MCP SERVER DEVELOPMENT

### Critical Rules & Lessons Learned

1. **CRITICAL RULE**: MCP servers MUST NOT output ANYTHING to stdout except JSON-RPC messages
   - Any stdout output will break communication with Claude
   - This includes debug messages, library outputs, and dotenv warnings

2. **Console Suppression Pattern**: Suppress all console output at the very start of index.ts:
   ```typescript
   console.log = () => {};
   console.error = process.stderr.write.bind(process.stderr);
   ```

3. **dotenv Issue**: dotenv outputs debug tips to stdout - must be suppressed
   - Load dotenv after console suppression
   - Or use alternative environment loading methods

4. **Testing Pattern**: Test MCP output with:
   ```bash
   node dist/index.js 2>/dev/null < /dev/null | head -1
   ```
   - Should return empty (no stdout output)
   - Any output indicates a protocol violation

5. **Debugging**: Check Claude logs at:
   ```
   /Users/sid/Library/Logs/Claude/mcp-server-*.log
   ```
   - Use process.stderr for debug output
   - Never use console.log in production

6. **Apple JWT**: No 'scope' field in JWT payload for App Store Connect
   - Remove scope field from JWT generation
   - Apple's API uses different auth patterns than expected

## API Response Handling
1. **GZIPPED Responses**: Apple returns gzipped CSV data for reports
   - Detect gzip header: starts with `\u001f\u008b\u0008`
   - Use Node's zlib: `import { gunzipSync } from 'zlib'`
   - Pattern: `const decompressed = gunzipSync(Buffer.from(response))`

2. **Version Requirements**: Different Apple report types need different versions
   - Sales reports: version "1_1"
   - Subscription reports: version "1_3"  
   - Financial reports: version "1_0"
   - Error message tells you the correct version: "The latest version for this report is X_X"

3. **Testing Financial APIs**: 
   - Create dedicated test scripts (test-financial.ts)
   - Test each report type separately
   - Check response type and length before processing

## Pragmatic Debugging - MCP Specific
- When API returns unexpected format, check first 10 bytes for magic headers
- Binary/compressed data shows as unicode garbage in console
- Use Buffer.from() and check for compression headers
- Apple's API errors are actually helpful - they tell you the correct version

### Root Cause Philosophy
- **Fix the problem, not the blame** - Focus on solutions
- **Find root causes** - Understand why MCP communication breaks
- **Test assumptions** - Verify protocol compliance early

---

*"We build what doesn't exist. Today."* - Trial and Error Inc