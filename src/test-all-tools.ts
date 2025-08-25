#!/usr/bin/env tsx
/**
 * Comprehensive test script for all MCP tools
 * Tests that Claude can actually use these tools
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { AppService } from './services/app-service.js';
import { FinanceService } from './services/finance-service.js';
import { AnalyticsService } from './services/analytics-service.js';
import { BetaService } from './services/beta-service.js';
import { ReviewService } from './services/review-service.js';

// Load environment variables
dotenv.config();

// Test result tracking
interface TestResult {
  tool: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function testAllTools() {
  console.log('🧪 Comprehensive MCP Tools Test Suite v1.1.0\n');
  console.log('Testing all tools that Claude will use...\n');

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;

  if (!keyId || !issuerId || !p8Path) {
    console.error('❌ Missing required environment variables!');
    process.exit(1);
  }

  try {
    // Initialize services
    const auth = new JWTManager({ keyId, issuerId, p8Path });
    const client = new AppStoreClient(auth);
    const appService = new AppService(client);
    const financeService = new FinanceService(client, vendorNumber);
    const analyticsService = new AnalyticsService(client);
    const betaService = new BetaService(client);
    const reviewService = new ReviewService(client);

    // Test 1: Connection Test
    console.log('📡 Testing: test_connection');
    try {
      const connected = await client.testConnection();
      results.push({
        tool: 'test_connection',
        status: connected ? 'PASS' : 'FAIL',
        message: connected ? 'Connected to App Store Connect' : 'Connection failed'
      });
      console.log(connected ? '  ✅ PASS' : '  ❌ FAIL');
    } catch (error) {
      results.push({
        tool: 'test_connection',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 2: List Apps
    console.log('📱 Testing: list_apps');
    let firstAppId: string | undefined;
    try {
      const apps = await appService.getAllAppsSummary();
      firstAppId = apps[0]?.id;
      results.push({
        tool: 'list_apps',
        status: 'PASS',
        message: `Found ${apps.length} apps`,
        data: { count: apps.length, firstApp: apps[0]?.name }
      });
      console.log(`  ✅ PASS - Found ${apps.length} apps`);
    } catch (error) {
      results.push({
        tool: 'list_apps',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 3: Get App Details
    console.log('🔍 Testing: get_app');
    if (firstAppId) {
      try {
        const app = await appService.getAppSummary(firstAppId);
        results.push({
          tool: 'get_app',
          status: 'PASS',
          message: `Retrieved app: ${app.name}`,
          data: { name: app.name, bundleId: app.bundleId }
        });
        console.log(`  ✅ PASS - Retrieved: ${app.name}`);
      } catch (error) {
        results.push({
          tool: 'get_app',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error)
        });
        console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
      }
    } else {
      results.push({
        tool: 'get_app',
        status: 'SKIP',
        message: 'No app ID available to test'
      });
      console.log('  ⏭️  SKIP - No app ID available');
    }

    // Test 4: Sales Report
    console.log('💰 Testing: get_sales_report');
    if (vendorNumber) {
      try {
        const report = await financeService.getSalesReport({
          reportType: 'SALES'
        });
        results.push({
          tool: 'get_sales_report',
          status: 'PASS',
          message: `Sales report retrieved: ${report.rowCount} rows`,
          data: { rowCount: report.rowCount, totalRevenue: report.totalRevenue }
        });
        console.log(`  ✅ PASS - ${report.rowCount} rows parsed`);
      } catch (error) {
        results.push({
          tool: 'get_sales_report',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error)
        });
        console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
      }
    } else {
      results.push({
        tool: 'get_sales_report',
        status: 'SKIP',
        message: 'No vendor number configured'
      });
      console.log('  ⏭️  SKIP - No vendor number');
    }

    // Test 5: Revenue Metrics
    console.log('📊 Testing: get_revenue_metrics');
    try {
      const metrics = await financeService.getRevenueMetrics();
      results.push({
        tool: 'get_revenue_metrics',
        status: 'PASS',
        message: `MRR: $${metrics.subscriptions?.mrr || 0}, ARR: $${metrics.subscriptions?.arr || 0}`,
        data: { 
          mrr: metrics.subscriptions?.mrr,
          arr: metrics.subscriptions?.arr,
          totalRevenue: metrics.totalRevenue 
        }
      });
      console.log(`  ✅ PASS - MRR: $${metrics.subscriptions?.mrr || 0}`);
    } catch (error) {
      results.push({
        tool: 'get_revenue_metrics',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 6: Subscription Metrics
    console.log('🔄 Testing: get_subscription_metrics');
    try {
      const subs = await financeService.getSubscriptionMetrics();
      results.push({
        tool: 'get_subscription_metrics',
        status: 'PASS',
        message: `Active: ${subs.metrics.activeSubscribers}, MRR: $${subs.metrics.mrr}`,
        data: subs.metrics
      });
      console.log(`  ✅ PASS - ${subs.metrics.activeSubscribers} active subscribers`);
    } catch (error) {
      results.push({
        tool: 'get_subscription_metrics',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 7: App Analytics
    console.log('📈 Testing: get_app_analytics');
    if (firstAppId) {
      try {
        const analytics = await analyticsService.getAppAnalytics({
          appId: firstAppId,
          metricType: 'USERS'
        });
        results.push({
          tool: 'get_app_analytics',
          status: 'PASS',
          message: `Analytics retrieved for ${analytics.appId}`,
          data: analytics.metrics
        });
        console.log(`  ✅ PASS - Users: ${analytics.metrics.users || 'Mock data'}`);
      } catch (error) {
        results.push({
          tool: 'get_app_analytics',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error)
        });
        console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
      }
    } else {
      results.push({
        tool: 'get_app_analytics',
        status: 'SKIP',
        message: 'No app ID available'
      });
      console.log('  ⏭️  SKIP - No app ID');
    }

    // Test 8: TestFlight Metrics
    console.log('✈️  Testing: get_testflight_metrics');
    try {
      const testflight = await betaService.getTestFlightSummary(firstAppId);
      results.push({
        tool: 'get_testflight_metrics',
        status: 'PASS',
        message: `${testflight.metrics.totalTesters} testers, ${testflight.metrics.activeTesters} active`,
        data: testflight.metrics
      });
      console.log(`  ✅ PASS - ${testflight.metrics.totalTesters} total testers`);
    } catch (error) {
      results.push({
        tool: 'get_testflight_metrics',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 9: Beta Testers
    console.log('👥 Testing: get_beta_testers');
    try {
      const testers = await betaService.getBetaTesters(10);
      results.push({
        tool: 'get_beta_testers',
        status: 'PASS',
        message: `Retrieved ${testers.length} beta testers`,
        data: { count: testers.length }
      });
      console.log(`  ✅ PASS - ${testers.length} testers retrieved`);
    } catch (error) {
      results.push({
        tool: 'get_beta_testers',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Test 10: Customer Reviews
    console.log('⭐ Testing: get_customer_reviews');
    if (firstAppId) {
      try {
        const reviews = await reviewService.getCustomerReviews(firstAppId, 10);
        results.push({
          tool: 'get_customer_reviews',
          status: 'PASS',
          message: `Retrieved ${reviews.length} reviews`,
          data: { 
            count: reviews.length,
            avgRating: reviews.length > 0 ? 
              (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0
          }
        });
        console.log(`  ✅ PASS - ${reviews.length} reviews retrieved`);
      } catch (error) {
        results.push({
          tool: 'get_customer_reviews',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error)
        });
        console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
      }
    } else {
      results.push({
        tool: 'get_customer_reviews',
        status: 'SKIP',
        message: 'No app ID available'
      });
      console.log('  ⏭️  SKIP - No app ID');
    }

    // Test 11: Review Metrics
    console.log('📝 Testing: get_review_metrics');
    if (firstAppId) {
      try {
        const reviewMetrics = await reviewService.getReviewSummary(firstAppId);
        results.push({
          tool: 'get_review_metrics',
          status: 'PASS',
          message: `Rating: ${reviewMetrics.rating.average}/5, Total: ${reviewMetrics.rating.total}`,
          data: reviewMetrics.rating
        });
        console.log(`  ✅ PASS - ${reviewMetrics.rating.average}/5 average rating`);
      } catch (error) {
        results.push({
          tool: 'get_review_metrics',
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error)
        });
        console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
      }
    } else {
      results.push({
        tool: 'get_review_metrics',
        status: 'SKIP',
        message: 'No app ID available'
      });
      console.log('  ⏭️  SKIP - No app ID');
    }

    // Test 12: API Stats
    console.log('📊 Testing: get_api_stats');
    try {
      const stats = client.getStats();
      results.push({
        tool: 'get_api_stats',
        status: 'PASS',
        message: `${stats.requestCount}/${stats.requestLimit} requests used`,
        data: stats
      });
      console.log(`  ✅ PASS - ${stats.requestCount} API calls made`);
    } catch (error) {
      results.push({
        tool: 'get_api_stats',
        status: 'FAIL',
        message: error instanceof Error ? error.message : String(error)
      });
      console.log('  ❌ FAIL:', error instanceof Error ? error.message : String(error));
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📋 TEST RESULTS SUMMARY\n');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ Passed:  ${passed}/12 tools`);
    console.log(`❌ Failed:  ${failed}/12 tools`);
    console.log(`⏭️  Skipped: ${skipped}/12 tools`);
    
    if (failed > 0) {
      console.log('\n🔴 Failed Tools:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.tool}: ${r.message}`);
      });
    }

    // Key metrics from successful tests
    console.log('\n🎯 KEY METRICS EXTRACTED:');
    const revenueData = results.find(r => r.tool === 'get_revenue_metrics' && r.status === 'PASS');
    if (revenueData?.data) {
      console.log(`  💵 MRR: $${revenueData.data.mrr || 0}`);
      console.log(`  💰 ARR: $${revenueData.data.arr || 0}`);
      console.log(`  📈 Total Revenue: $${revenueData.data.totalRevenue || 0}`);
    }
    
    const subData = results.find(r => r.tool === 'get_subscription_metrics' && r.status === 'PASS');
    if (subData?.data) {
      console.log(`  👥 Active Subscribers: ${subData.data.activeSubscribers || 0}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🚀 MCP Server v1.1.0 Test Complete!');
    
    // Return exit code based on failures
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Fatal test error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the tests
testAllTools().catch(console.error);