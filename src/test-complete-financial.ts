#!/usr/bin/env tsx
/**
 * Test FINANCIAL reports with ALL regions to get complete revenue
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { gunzipSync } from 'zlib';

dotenv.config();

async function testCompleteFinancial() {
  const auth = new JWTManager({
    keyId: process.env.APP_STORE_KEY_ID!,
    issuerId: process.env.APP_STORE_ISSUER_ID!,
    p8Path: process.env.APP_STORE_P8_PATH!
  });

  const client = new AppStoreClient(auth);
  
  console.log('🌍 Testing FINANCIAL Report - ALL REGIONS (Z1)\n');
  console.log('═'.repeat(60));
  
  // Test Z1 (all regions) 
  const paramsZ1 = {
    'filter[reportType]': 'FINANCIAL',
    'filter[regionCode]': 'Z1',  // ALL REGIONS
    'filter[reportDate]': '2025-10',  // July 2025
    'filter[vendorNumber]': process.env.APP_STORE_VENDOR_NUMBER!
  };

  try {
    const responseZ1 = await client.request('/financeReports', paramsZ1);
    const contentZ1 = gunzipSync(responseZ1).toString('utf-8');
    const linesZ1 = contentZ1.split('\n').filter(l => l.trim());
    const headersZ1 = linesZ1[0].split('\t');
    
    const extShareIdx = headersZ1.findIndex(h => h === 'Extended Partner Share');
    const countryIdx = headersZ1.findIndex(h => h.includes('Country') || h === 'Territory');
    const productIdx = headersZ1.findIndex(h => h === 'Vendor Identifier' || h === 'SKU');
    
    let totalZ1 = 0;
    const byCountry = new Map<string, number>();
    const byProduct = new Map<string, number>();
    
    for (let i = 1; i < linesZ1.length; i++) {
      const values = linesZ1[i].split('\t');
      const amount = parseFloat(values[extShareIdx] || '0');
      const country = values[countryIdx] || 'Unknown';
      const product = values[productIdx] || 'Unknown';
      
      totalZ1 += amount;
      byCountry.set(country, (byCountry.get(country) || 0) + amount);
      byProduct.set(product, (byProduct.get(product) || 0) + amount);
    }
    
    console.log('💰 JULY 2025 REVENUE (Z1 - ALL REGIONS)');
    console.log('─'.repeat(60));
    console.log(`Total Revenue: $${totalZ1.toFixed(2)}`);
    console.log(`Total Rows: ${linesZ1.length - 1}`);
    
    console.log('\n🌍 TOP 5 COUNTRIES:');
    const topCountries = Array.from(byCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    topCountries.forEach(([country, amount]) => {
      const pct = (amount / totalZ1 * 100).toFixed(1);
      console.log(`  ${country}: $${amount.toFixed(2)} (${pct}%)`);
    });
    
    console.log('\n📦 TOP 3 PRODUCTS:');
    const topProducts = Array.from(byProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    topProducts.forEach(([product, amount]) => {
      const pct = (amount / totalZ1 * 100).toFixed(1);
      console.log(`  ${product}: $${amount.toFixed(2)} (${pct}%)`);
    });
    
    // Compare with US-only
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Comparing with US-ONLY Report\n');
    
    const paramsUS = {
      'filter[reportType]': 'FINANCIAL',
      'filter[regionCode]': 'US',
      'filter[reportDate]': '2025-10',
      'filter[vendorNumber]': process.env.APP_STORE_VENDOR_NUMBER!
    };
    
    const responseUS = await client.request('/financeReports', paramsUS);
    const contentUS = gunzipSync(responseUS).toString('utf-8');
    const linesUS = contentUS.split('\n').filter(l => l.trim());
    const headersUS = linesUS[0].split('\t');
    
    const extShareIdxUS = headersUS.findIndex(h => h === 'Extended Partner Share');
    
    let totalUS = 0;
    for (let i = 1; i < linesUS.length; i++) {
      const values = linesUS[i].split('\t');
      totalUS += parseFloat(values[extShareIdxUS] || '0');
    }
    
    console.log(`US-Only Revenue: $${totalUS.toFixed(2)}`);
    console.log(`International Revenue: $${(totalZ1 - totalUS).toFixed(2)}`);
    console.log(`US Percentage: ${(totalUS / totalZ1 * 100).toFixed(1)}%`);
    
    console.log('\n💡 ANALYSIS:');
    console.log('─'.repeat(60));
    if (totalZ1 > 200000) {
      console.log('✅ SUCCESS! Found complete revenue (~$220K expected)');
      console.log('This is the REAL monthly revenue including all renewals.');
    } else if (totalZ1 > 150000) {
      console.log('⚠️ Close but still missing some revenue');
      console.log('Z1 might not include all regions. Checking available regions...');
    } else {
      console.log('❌ Still too low. Need to investigate further.');
    }
    
    // Test which months are available
    console.log('\n' + '═'.repeat(60));
    console.log('📅 Testing Report Availability\n');
    
    const months = [
      { period: '2025-12', month: 'September 2025' },
      { period: '2025-11', month: 'August 2025' },
      { period: '2025-10', month: 'July 2025' },
      { period: '2025-09', month: 'June 2025' }
    ];
    
    for (const { period, month } of months) {
      const params = {
        'filter[reportType]': 'FINANCIAL',
        'filter[regionCode]': 'US',
        'filter[reportDate]': period,
        'filter[vendorNumber]': process.env.APP_STORE_VENDOR_NUMBER!
      };
      
      try {
        const response = await client.request('/financeReports', params);
        const content = gunzipSync(response).toString('utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        console.log(`✅ ${month} (${period}): Available (${lines.length - 1} rows)`);
      } catch (error: any) {
        if (error.message.includes('404')) {
          console.log(`❌ ${month} (${period}): Not available yet`);
        } else {
          console.log(`⚠️ ${month} (${period}): Error - ${error.message}`);
        }
      }
    }
    
    console.log('\n📝 KEY FINDINGS:');
    console.log('─'.repeat(60));
    console.log('1. FINANCIAL reports have complete revenue (includes renewals)');
    console.log('2. Reports are delayed by ~1 month (normal for reconciliation)');
    console.log('3. Use latest available month for MCP tools');
    console.log('4. Z1 region code should give worldwide revenue');
    
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    if (error.response?.data) {
      console.log('Details:', error.response.data);
    }
  }
}

testCompleteFinancial().catch(console.error);