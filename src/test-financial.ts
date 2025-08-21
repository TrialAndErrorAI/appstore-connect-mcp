#!/usr/bin/env tsx
/**
 * Test script specifically for financial reports with version parameters
 * Usage: npm run test:financial
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { FinanceService } from './services/finance-service.js';

// Load environment variables
dotenv.config();

async function testFinancial() {
  console.log('🧪 Testing Financial Reports with Version Parameters\n');

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;

  if (!keyId || !issuerId || !p8Path || !vendorNumber) {
    console.error('❌ Missing required environment variables!');
    process.exit(1);
  }

  try {
    // Initialize components
    const auth = new JWTManager({ keyId, issuerId, p8Path });
    const client = new AppStoreClient(auth);
    const financeService = new FinanceService(client, vendorNumber);

    // Test 1: Sales Report
    console.log('Test 1: Sales Report (with version 1_4)...');
    try {
      const salesReport = await financeService.getSalesReport({
        reportType: 'SALES',
        dateType: 'DAILY'
      });
      console.log('✅ Sales report retrieved');
      console.log('  Response type:', typeof salesReport);
      console.log('  Response length:', JSON.stringify(salesReport).length);
      console.log('  First 200 chars:', JSON.stringify(salesReport).substring(0, 200));
    } catch (error) {
      console.log('❌ Sales report failed:', error instanceof Error ? error.message : String(error));
    }

    // Test 2: Subscription Metrics
    console.log('\nTest 2: Subscription Metrics (with version 1_4)...');
    try {
      const subMetrics = await financeService.getSubscriptionMetrics();
      console.log('✅ Subscription metrics retrieved');
      console.log('  Response:', JSON.stringify(subMetrics, null, 2));
    } catch (error) {
      console.log('❌ Subscription metrics failed:', error instanceof Error ? error.message : String(error));
    }

    // Test 3: Financial Report
    console.log('\nTest 3: Financial Report (with version 1_0)...');
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const financialReport = await financeService.getFinancialReport(currentYear, currentMonth);
      console.log('✅ Financial report retrieved');
      console.log('  Response type:', typeof financialReport);
      console.log('  Response length:', JSON.stringify(financialReport).length);
    } catch (error) {
      console.log('❌ Financial report failed:', error instanceof Error ? error.message : String(error));
    }

    // Test 4: Revenue Metrics
    console.log('\nTest 4: Revenue Metrics Calculation...');
    try {
      const metrics = await financeService.getRevenueMetrics();
      console.log('✅ Revenue metrics calculated');
      console.log('  Metrics:', JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.log('❌ Revenue metrics failed:', error instanceof Error ? error.message : String(error));
    }

    console.log('\n🎉 Financial testing complete!');
    
    // Show API usage
    const stats = client.getStats();
    console.log(`\n📊 API Usage: ${stats.requestCount}/${stats.requestLimit} requests`);

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
testFinancial().catch(console.error);