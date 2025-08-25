#!/usr/bin/env tsx
/**
 * Test the new FinanceReportService
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { FinanceReportService } from './services/finance-report-service.js';

dotenv.config();

async function testFinanceReportService() {
  console.log('🧪 TESTING FINANCE REPORT SERVICE\n');
  
  const keyId = process.env.APP_STORE_KEY_ID!;
  const issuerId = process.env.APP_STORE_ISSUER_ID!;
  const p8Path = process.env.APP_STORE_P8_PATH!;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER!;

  const auth = new JWTManager({ keyId, issuerId, p8Path });
  const client = new AppStoreClient(auth);
  const financeService = new FinanceReportService(client, vendorNumber);

  console.log('📊 TEST 1: Get July 2025 Monthly Summary\n');
  
  try {
    const summary = await financeService.getMonthlySummary(2025, 7);
    
    console.log('💰 REVENUE SUMMARY:');
    console.log(`  Total Revenue: $${summary.totalRevenue.toFixed(2)}`);
    console.log(`  Sales: $${summary.salesVsReturns.sales.toFixed(2)}`);
    console.log(`  Returns: $${summary.salesVsReturns.returns.toFixed(2)}`);
    
    console.log('\n📦 TOP PRODUCTS:');
    const topProducts = Array.from(summary.byProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topProducts.forEach(([product, revenue]) => {
      console.log(`  ${product}: $${revenue.toFixed(2)}`);
    });
    
    console.log('\n🌍 TOP COUNTRIES:');
    const topCountries = Array.from(summary.byCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topCountries.forEach(([country, revenue]) => {
      const pct = (revenue / summary.totalRevenue * 100).toFixed(1);
      console.log(`  ${country}: $${revenue.toFixed(2)} (${pct}%)`);
    });
    
    // Analysis
    console.log('\n💡 ANALYSIS:');
    console.log('─'.repeat(60));
    
    if (summary.totalRevenue > 100000) {
      console.log('✅ FOUND COMPLETE REVENUE!');
      console.log('This includes subscription renewals that were missing from SALES reports.');
    } else if (summary.totalRevenue > 50000) {
      console.log('⚠️ Revenue higher than SALES but still seems low.');
      console.log('May need to check different region codes.');
    } else {
      console.log('❌ Revenue too low - might be parsing issue.');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST 2: Compare with FINANCIAL Report\n');
  
  try {
    const financial = await financeService.getFinancialReport({
      fiscalPeriod: '2025-10', // July 2025
      regionCode: 'US'
    });
    
    console.log(`Report Type: ${financial.metadata.reportType}`);
    console.log(`Region: ${financial.metadata.regionCode}`);
    console.log(`Rows: ${financial.rowCount}`);
    console.log(`Total Revenue: $${financial.totalRevenue.toFixed(2)}`);
    
    // Show sample columns
    if (financial.headers.length > 0) {
      console.log('\nAvailable columns:', financial.headers.length);
      console.log('Revenue-related columns:');
      financial.headers.forEach((h, i) => {
        if (h.toLowerCase().includes('share') || 
            h.toLowerCase().includes('amount') ||
            h.toLowerCase().includes('revenue')) {
          console.log(`  ${i}: ${h}`);
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testFinanceReportService().catch(console.error);