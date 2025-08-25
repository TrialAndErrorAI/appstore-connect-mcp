#!/usr/bin/env tsx
/**
 * PRAGMATIC: Get COMPLETE worldwide revenue by aggregating all regions
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { gunzipSync } from 'zlib';

dotenv.config();

async function testWorldwideRevenue() {
  const auth = new JWTManager({
    keyId: process.env.APP_STORE_KEY_ID!,
    issuerId: process.env.APP_STORE_ISSUER_ID!,
    p8Path: process.env.APP_STORE_P8_PATH!
  });

  const client = new AppStoreClient(auth);
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER!;
  
  console.log('🌍 GETTING COMPLETE WORLDWIDE REVENUE\n');
  console.log('Strategy: Aggregate all available region codes\n');
  console.log('═'.repeat(60));

  // All available region codes for FINANCIAL reports
  const regions = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'EU', name: 'Europe' },
    { code: 'JP', name: 'Japan' },
    { code: 'AU', name: 'Australia' },
    { code: 'WW', name: 'Rest of World' }  // Catch-all for other regions
  ];

  // Test multiple months to see what's available
  const periods = [
    { period: '2025-11', month: 'August 2025' },
    { period: '2025-10', month: 'July 2025' },
    { period: '2025-09', month: 'June 2025' }
  ];

  for (const { period, month } of periods) {
    console.log(`\n📅 ${month} (Fiscal ${period})`);
    console.log('─'.repeat(60));
    
    let totalWorldwide = 0;
    const regionRevenue: Array<{region: string, amount: number}> = [];
    let available = false;
    
    for (const { code, name } of regions) {
      const params = {
        'filter[reportType]': 'FINANCIAL',
        'filter[regionCode]': code,
        'filter[reportDate]': period,
        'filter[vendorNumber]': vendorNumber
      };
      
      try {
        const response = await client.request('/financeReports', params);
        const content = gunzipSync(response).toString('utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const headers = lines[0].split('\t');
        const extShareIdx = headers.findIndex(h => h === 'Extended Partner Share');
        
        let regionTotal = 0;
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          regionTotal += parseFloat(values[extShareIdx] || '0');
        }
        
        totalWorldwide += regionTotal;
        regionRevenue.push({ region: name, amount: regionTotal });
        available = true;
        
      } catch (error: any) {
        if (!error.message.includes('404')) {
          console.log(`  ⚠️ ${name}: Error - ${error.message}`);
        }
      }
    }
    
    if (available) {
      console.log('💰 REVENUE BY REGION:');
      regionRevenue.forEach(({ region, amount }) => {
        const pct = (amount / totalWorldwide * 100).toFixed(1);
        console.log(`  ${region.padEnd(15)} $${amount.toFixed(2).padStart(12)} (${pct}%)`);
      });
      
      console.log('\n🎯 TOTAL WORLDWIDE: $' + totalWorldwide.toFixed(2));
      
      // Analysis
      if (totalWorldwide > 200000) {
        console.log('✅ SUCCESS! This is the complete monthly revenue.');
      } else if (totalWorldwide > 150000) {
        console.log('⚠️ Close to expected $220K. Some regions might be missing.');
      } else {
        console.log('❓ Lower than expected. Check if all regions included.');
      }
      
      // Show MRR and ARR
      console.log('\n📊 METRICS:');
      console.log(`  MRR: $${totalWorldwide.toFixed(2)}`);
      console.log(`  ARR: $${(totalWorldwide * 12).toFixed(2)}`);
      console.log(`  Daily Average: $${(totalWorldwide / 30).toFixed(2)}`);
      
      // This is the latest available month, use it for MCP
      if (available) {
        console.log('\n💡 USE THIS FOR MCP TOOLS:');
        console.log(`Latest available: ${month}`);
        console.log(`Total revenue: $${totalWorldwide.toFixed(2)}`);
        break; // Found the latest month with data
      }
    } else {
      console.log('❌ Not available yet (normal - reports delayed ~1 month)');
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📝 IMPLEMENTATION NOTES:');
  console.log('─'.repeat(60));
  console.log('1. FINANCIAL reports are the source of truth');
  console.log('2. Must aggregate all regions (US, CA, EU, JP, AU, WW)');
  console.log('3. Reports delayed by ~1 month (normal for reconciliation)');
  console.log('4. MCP tools should use latest available month');
  console.log('5. This includes ALL revenue: new + renewals');
}

testWorldwideRevenue().catch(console.error);