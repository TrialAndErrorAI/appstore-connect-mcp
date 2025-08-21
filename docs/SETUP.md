# Quick Setup Guide - App Store Connect MCP

## 1. Get Your App Store Connect Credentials

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click on "Users and Access" → "Keys"
3. Click the "+" button to generate a new API key
4. Choose role: 
   - **Admin** for full access
   - **Finance** for read-only financial data
5. Click "Generate"
6. **IMPORTANT**: Download the .p8 file immediately (only downloadable once!)
7. Note down:
   - **Key ID**: The 10-character ID shown
   - **Issuer ID**: The UUID at the top of the keys page

## 2. Set Up Environment

Create a `.env` file in the project root:

```bash
cd ~/Code/te/appstore-connect-mcp
cp .env.example .env
```

Edit `.env` with your credentials:
```
APP_STORE_KEY_ID=YOUR_KEY_ID
APP_STORE_ISSUER_ID=YOUR_ISSUER_ID  
APP_STORE_P8_PATH=/path/to/your/AuthKey_XXXXXX.p8
APP_STORE_VENDOR_NUMBER=YOUR_VENDOR_NUMBER  # Optional, for financial reports
```

## 3. Test Authentication

```bash
npm run test:auth
```

This should show:
- ✅ Token generated successfully
- ✅ Cache working
- ✅ JWT validation passed

## 4. Test API Connection

```bash
npm run test:api
```

This will:
- Test connection to App Store Connect
- List your apps
- Test financial endpoints (if vendor number provided)

## 5. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appstore-connect": {
      "command": "node",
      "args": ["/Users/sid/Code/te/appstore-connect-mcp/dist/index.js"],
      "env": {
        "APP_STORE_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_P8_PATH": "/path/to/your/key.p8",
        "APP_STORE_VENDOR_NUMBER": "YOUR_VENDOR_NUMBER"
      }
    }
  }
}
```

## 6. Restart Claude Desktop

1. Fully quit Claude Desktop (Cmd+Q)
2. Reopen Claude Desktop
3. Look for the MCP icon (🔌) in the bottom right
4. Click it to see "appstore-connect" listed

## 7. Test in Claude

Ask Claude:
- "What apps do I have in App Store Connect?"
- "Show me my iOS revenue metrics"
- "Test the App Store Connect connection"

## Available Tools

Claude now has access to these tools:

1. **list_apps** - Get all your iOS apps
2. **get_app** - Get details about a specific app
3. **get_sales_report** - Get sales data
4. **get_revenue_metrics** - Calculate MRR/ARR
5. **get_subscription_metrics** - Subscription analytics
6. **get_app_analytics** - User engagement metrics
7. **test_connection** - Verify API access
8. **get_api_stats** - Check rate limit usage

## Troubleshooting

### "Authentication failed"
- Check Key ID and Issuer ID are correct
- Verify P8 file path is absolute, not relative
- Ensure P8 file has proper format with BEGIN/END markers

### "No apps found"
- Verify you have apps in this App Store Connect account
- Check the API key has proper permissions

### MCP icon not showing
- Ensure Claude Desktop is fully restarted
- Check JSON syntax in config file
- Verify node path is correct

### "Vendor number required"
- Find in App Store Connect → Payments and Financial Reports
- Usually starts with 8 and is 8-9 digits

## Support

Issues? Create an issue at: github.com/trialanderrorinc/appstore-connect-mcp

---

Built by Trial and Error Inc - Because broken npm packages are unacceptable.