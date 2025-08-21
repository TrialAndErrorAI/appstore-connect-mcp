# App Store Connect MCP Server

**By Trial and Error Inc**  
*The reliable bridge between App Store Connect and AI assistants*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.17-green)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange)](https://github.com/TrialAndErrorAI/appstore-connect-mcp)

## Problem

You need iOS app metrics in Claude. The "official" MCP servers are broken. Manual exports waste hours. This fixes that.

## Solution

A working MCP server for App Store Connect. Built in 3 hours. No dependencies on broken packages. It just works.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/TrialAndErrorAI/appstore-connect-mcp
cd appstore-connect-mcp

# Install dependencies
npm install

# Build
npm run build

# Configure Claude Desktop
# Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "appstore-connect": {
      "command": "node",
      "args": ["/path/to/appstore-connect-mcp/dist/index.js"],
      "env": {
        "APP_STORE_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_P8_PATH": "/path/to/key.p8"
      }
    }
  }
}

# Restart Claude Desktop
```

## Getting App Store Connect Credentials

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to Users and Access → Keys
3. Click "+" to generate a new key
4. Select "Admin" or "Finance" role
5. Download the .p8 file (ONLY downloadable once!)
6. Note your Key ID and Issuer ID

## What You Can Ask Claude

Once configured, Claude can help you with:

- **Financial Metrics**: "What's our iOS monthly recurring revenue?"
- **Subscription Analytics**: "Show me active subscriber count and churn rate"
- **App Performance**: "List all our iOS apps with their current versions"
- **Revenue Insights**: "Calculate our ARR and growth rate"
- **API Health**: "Test the App Store Connect connection"
- **Usage Monitoring**: "Show API rate limit status"

*More features coming soon: crash analytics, TestFlight metrics, customer reviews*

## Architecture

See [RFC-001-architecture.md](RFC-001-architecture.md) for technical details.

## Project Structure

```
appstore-connect-mcp/
├── PRFAQ.md               # Product vision and FAQ
├── RFC-001-architecture.md # Technical specification
├── src/
│   ├── auth/             # JWT authentication
│   ├── api/              # App Store Connect client
│   ├── services/         # Domain logic
│   └── server/           # MCP server implementation
├── tests/                # Test suite
└── dist/                 # Compiled output
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Type check
npm run type-check
```

## Why We Built This

Our portfolio company [RenovateAI](https://renovateai.app) is ranked #28 in Design Tools on the App Store. We needed real-time iOS metrics in Claude to make data-driven decisions. The existing solutions failed us:

- `@joshuarileydev/app-store-connect-mcp-server` - NPM 404 error
- Manual API integration - Days of work, maintenance burden
- CSV exports - Manual, error-prone, time-consuming

So we built our own. Clean, typed, reliable. In 3 hours flat.

## Status

🚀 **ALPHA RELEASE** - MVP Complete, Ready for Testing

### Completed ✅
- [x] PRFAQ written - Vision crystallized
- [x] RFC drafted - Architecture defined  
- [x] Authentication module - JWT with P8 keys
- [x] API client - Rate limiting, pagination, error handling
- [x] MCP server - 8 tools exposed to Claude
- [x] Core services - App and Finance services
- [x] TypeScript setup - Full type safety
- [x] Build system - Clean compilation
- [x] Documentation - Setup guides and API docs

### In Progress 🔄
- [ ] Live testing with real App Store Connect account
- [ ] Analytics service implementation
- [ ] Comprehensive test suite
- [ ] npm package publishing

### Roadmap 📍
- [ ] Automated testing with GitHub Actions
- [ ] More financial report types
- [ ] TestFlight integration
- [ ] Customer reviews analysis
- [ ] Crash reporting metrics

**Current Status**: MVP complete, awaiting App Store Connect credentials for live testing

## License

MIT - Use it, modify it, sell it. Just make it work.

## Available Tools

The MCP server exposes 8 tools to Claude:

| Tool | Description | Status |
|------|-------------|--------|
| `list_apps` | Get all apps in your account | ✅ Ready |
| `get_app` | Get detailed app information | ✅ Ready |
| `get_sales_report` | Fetch sales and subscription data | ✅ Ready |
| `get_revenue_metrics` | Calculate MRR, ARR, churn | ✅ Ready |
| `get_subscription_metrics` | Subscription analytics | ✅ Ready |
| `get_app_analytics` | User engagement metrics | 🔄 Stub |
| `test_connection` | Verify API access | ✅ Ready |
| `get_api_stats` | Rate limit monitoring | ✅ Ready |

## Troubleshooting

### Common Issues

#### 1. "Unexpected token" errors in Claude logs

**Cause**: Console output polluting JSON-RPC stream  
**Fix**: Ensure no `console.log` statements in production code  
**Check**: `/Users/sid/Library/Logs/Claude/mcp-server-appstore-connect.log`

```bash
# Look for console output in logs
tail -f ~/Library/Logs/Claude/mcp-server-appstore-connect.log
```

#### 2. "Illegal scope GET" error

**Cause**: Apple's JWT doesn't use 'scope' field  
**Fix**: Remove scope from JWT payload in `jwt-manager.ts`

The JWT payload should only include:
```javascript
{
  "iss": "ISSUER_ID",
  "iat": 1234567890,
  "exp": 1234568890,
  "aud": "appstoreconnect-v1"
}
```

#### 3. MCP not connecting

**Troubleshooting steps**:
1. Check credentials in Claude config
2. Verify P8 file has correct permissions: `chmod 600 /path/to/key.p8`
3. Test authentication manually:
   ```bash
   source .env && npm run test:auth
   ```
4. Verify Claude Desktop config path: `~/Library/Application Support/Claude/claude_desktop_config.json`
5. Restart Claude Desktop after config changes

#### 4. Financial reports error

**Common fixes**:
- Add version parameter: `version: "1_4"` for reports
- Vendor number required for financial data (find in App Store Connect → Payments)
- Ensure API key has "Finance" role permissions

#### 5. Empty or missing data

**Check**:
- App ID exists and you have access permissions
- Date ranges are valid (Apple keeps limited historical data)
- Reports are available for your region/app

#### 6. Rate limiting (429 errors)

**Solutions**:
- Built-in exponential backoff should handle this automatically
- If persistent, reduce request frequency
- Check API usage: use the `get_api_stats` tool in Claude

#### 7. Authentication token expired

**Fix**: Tokens auto-refresh every 19 minutes. If issues persist:
```bash
# Clear any cached tokens and restart
rm -f ~/.appstore-connect-token-cache
```

### Debug Mode

Enable detailed logging:
```bash
export DEBUG=appstore-connect:*
npm start
```

### Verification Commands

```bash
# Test P8 key format
openssl pkey -in /path/to/key.p8 -text -noout

# Test API connectivity
curl -H "Authorization: Bearer $(npm run generate-token)" \
     https://api.appstoreconnect.apple.com/v1/apps

# Validate Claude config
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

## Support

- **Issues**: [GitHub Issues](https://github.com/TrialAndErrorAI/appstore-connect-mcp/issues)
- **Discussions**: Coming soon
- **Email**: mcp@trialanderror.ai

## Credits

Built by [Trial and Error Inc](https://trialanderror.ai) because broken dependencies are unacceptable.

First production use: [RenovateAI](https://renovateai.app) - The AI that understands architecture.

---

*"We don't wait for packages to work. We build."* - Trial and Error Inc

**Star this repo** if you found it useful! We're building more MCP servers for the tools you actually use.