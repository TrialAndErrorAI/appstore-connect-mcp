#!/usr/bin/env tsx
/**
 * Test script for App Store Connect API
 * Usage: npm run test:api
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { AppService } from './services/app-service.js';
import { FinanceService } from './services/finance-service.js';

// Load environment variables
dotenv.config();

async function testAPI() {
  console.log('🧪 Testing App Store Connect API Integration\n');

  // Check environment variables
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;

  if (!keyId || !issuerId || !p8Path) {
    console.error('❌ Missing required environment variables!');
    console.log('\nPlease create a .env file with:');
    console.log('APP_STORE_KEY_ID=your_key_id');
    console.log('APP_STORE_ISSUER_ID=your_issuer_id');
    console.log('APP_STORE_P8_PATH=/path/to/your/key.p8');
    console.log('APP_STORE_VENDOR_NUMBER=your_vendor_number (optional)');
    process.exit(1);
  }

  try {
    // Initialize components
    console.log('🔧 Initializing components...\n');
    
    const auth = new JWTManager({ keyId, issuerId, p8Path });
    const client = new AppStoreClient(auth);
    const appService = new AppService(client);
    const financeService = new FinanceService(client, vendorNumber);

    // Test 1: Connection
    console.log('Test 1: Testing API connection...');
    const connected = await client.testConnection();
    
    if (!connected) {
      console.error('❌ Failed to connect to API');
      process.exit(1);
    }
    console.log('✅ Connection successful!\n');

    // Test 2: List apps
    console.log('Test 2: Fetching apps...');
    const apps = await appService.getAllAppsSummary();
    
    if (apps.length === 0) {
      console.log('ℹ️ No apps found (this might be normal for a new account)');
    } else {
      console.log(`✅ Found ${apps.length} app(s):`);
      apps.forEach(app => {
        console.log(`  - ${app.name} (${app.bundleId})`);
      });
    }
    console.log('');

    // Test 3: Get specific app (if we have any)
    if (apps.length > 0) {
      console.log('Test 3: Getting detailed app info...');
      const firstApp = apps[0];
      const appDetails = await appService.getAppSummary(firstApp.id);
      console.log(`✅ Got details for: ${appDetails.name}`);
      console.log(`  Bundle ID: ${appDetails.bundleId}`);
      console.log(`  SKU: ${appDetails.sku}`);
      console.log(`  Primary Locale: ${appDetails.primaryLocale}`);
      console.log('');
    }

    // Test 4: Financial data (if vendor number provided)
    if (vendorNumber) {
      console.log('Test 4: Testing financial reports...');
      try {
        const metrics = await financeService.getSubscriptionMetrics();
        console.log('✅ Financial endpoint accessible');
        console.log('  (Actual data processing would happen here)');
      } catch (error) {
        console.log('⚠️ Financial reports not available:', error instanceof Error ? error.message : String(error));
        console.log('  This is normal if you have no sales data yet');
      }
      console.log('');
    } else {
      console.log('ℹ️ Skipping financial tests (no vendor number provided)\n');
    }

    // Test 5: API Stats
    console.log('Test 5: API usage statistics...');
    const stats = client.getStats();
    console.log('✅ API Stats:');
    console.log(`  Requests made: ${stats.requestCount}/${stats.requestLimit}`);
    console.log(`  Reset in: ${stats.resetInSeconds} seconds`);
    console.log('');

    // Summary
    console.log('🎉 All tests passed!');
    console.log('\nYour App Store Connect MCP server is ready to use.');
    console.log('Add it to Claude Desktop config and restart Claude.');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.message.includes('401')) {
      console.error('\n🔑 Authentication issue. Check your credentials:');
      console.error('  - Is the Key ID correct?');
      console.error('  - Is the Issuer ID correct?');
      console.error('  - Is the P8 key valid and not expired?');
      console.error('  - Does the key have the right permissions?');
    }
    
    process.exit(1);
  }
}

// Run the tests
testAPI().catch(console.error);