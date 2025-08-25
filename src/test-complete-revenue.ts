#!/usr/bin/env tsx
/**
 * Test combining SALES + SUBSCRIPTION reports to get complete revenue
 * Based on Apple docs: SALES has new purchases, SUBSCRIPTION has renewals
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { gunzipSync } from 'zlib';

dotenv.config();

async function testCompleteRevenue() {
  console.log('💰 TESTING COMPLETE REVENUE CAPTURE\n');
  console.log('Strategy: Combine SALES + SUBSCRIPTION reports\n');

  const keyId = process.env.APP_STORE_KEY_ID!;
  const issuerId = process.env.APP_STORE_ISSUER_ID!;
  const p8Path = process.env.APP_STORE_P8_PATH!;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER!;

  const auth = new JWTManager({ keyId, issuerId, p8Path });
  const client = new AppStoreClient(auth);

  const testDate = '2025-07-15';
  console.log(`Testing date: ${testDate}\n`);

  // Helper to decompress response
  function decompress(data: any): string {
    if (Buffer.isBuffer(data)) {
      if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        return gunzipSync(data).toString('utf-8');
      }
      return data.toString('utf-8');
    }
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  // Helper to parse CSV
  function parseCSV(csv: string): any[] {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });
      rows.push(row);
    }
    return rows;
  }

  // Test 1: SALES Report (New purchases)
  console.log('📊 1. SALES REPORT (New Purchases):\n');
  try {
    const salesParams = {
      'filter[vendorNumber]': vendorNumber,
      'filter[reportType]': 'SALES',
      'filter[reportSubType]': 'SUMMARY',
      'filter[frequency]': 'DAILY',
      'filter[reportDate]': testDate,
      'filter[version]': '1_1'
    };

    const salesResponse = await client.request('/salesReports', salesParams);
    const salesCSV = decompress(salesResponse);
    const salesRows = parseCSV(salesCSV);
    
    let salesRevenue = 0;
    salesRows.forEach(row => {
      const proceeds = parseFloat(row['Developer Proceeds'] || '0');
      // Check if proceeds need currency conversion
      const currency = row['Customer Currency'] || 'USD';
      if (currency === 'USD') {
        salesRevenue += proceeds;
      } else {
        // Apply conversion for non-USD
        const rates: Record<string, number> = {
          VND: 0.0000406,
          IDR: 0.000065,
          TZS: 0.00039,
          CLP: 0.0011,
          // Add more as needed
        };
        salesRevenue += proceeds * (rates[currency] || 1);
      }
    });
    
    console.log(`  Transactions: ${salesRows.length}`);
    console.log(`  Revenue: $${salesRevenue.toFixed(2)}`);
    console.log('  Type: New subscriptions + one-time purchases\n');
    
  } catch (error: any) {
    console.log(`  Error: ${error.message}\n`);
  }

  // Test 2: SUBSCRIPTION Report (Active/Renewals)
  console.log('📊 2. SUBSCRIPTION REPORT (Renewals):\n');
  
  const subscriptionConfigs = [
    { version: '1_3', subType: 'SUMMARY' },
    { version: '1_4', subType: 'SUMMARY' },
    { version: '1_2', subType: 'SUMMARY' }
  ];
  
  let subscriptionRevenue = 0;
  let subscriptionWorked = false;
  
  for (const config of subscriptionConfigs) {
    try {
      const subParams = {
        'filter[vendorNumber]': vendorNumber,
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[reportSubType]': config.subType,
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': testDate,
        'filter[version]': config.version
      };

      const subResponse = await client.request('/salesReports', subParams);
      const subCSV = decompress(subResponse);
      const subRows = parseCSV(subCSV);
      
      // Look for renewal revenue fields
      subRows.forEach(row => {
        // Check various proceeds fields
        const proceeds = parseFloat(row['Developer Proceeds'] || 
                                   row['Proceeds'] || 
                                   row['Renewal Revenue'] ||
                                   row['Subscription Revenue'] || '0');
        
        const currency = row['Customer Currency'] || row['Currency'] || 'USD';
        if (currency === 'USD') {
          subscriptionRevenue += proceeds;
        } else {
          const rates: Record<string, number> = {
            VND: 0.0000406,
            IDR: 0.000065,
            TZS: 0.00039,
            CLP: 0.0011,
          };
          subscriptionRevenue += proceeds * (rates[currency] || 1);
        }
      });
      
      console.log(`  Version ${config.version}: SUCCESS`);
      console.log(`  Transactions: ${subRows.length}`);
      console.log(`  Revenue: $${subscriptionRevenue.toFixed(2)}`);
      
      // Sample first row to see fields
      if (subRows.length > 0) {
        console.log('\n  Available fields:');
        const sampleFields = Object.keys(subRows[0]).slice(0, 10);
        sampleFields.forEach(field => {
          if (subRows[0][field]) {
            console.log(`    ${field}: "${subRows[0][field]}"`);
          }
        });
      }
      
      subscriptionWorked = true;
      break;
      
    } catch (error: any) {
      console.log(`  Version ${config.version}: ${error.message}`);
    }
  }
  
  if (!subscriptionWorked) {
    console.log('  ❌ No subscription report worked\n');
  }

  // Test 3: SUBSCRIPTION_EVENT Report
  console.log('\n📊 3. SUBSCRIPTION_EVENT REPORT:\n');
  try {
    const eventParams = {
      'filter[vendorNumber]': vendorNumber,
      'filter[reportType]': 'SUBSCRIPTION_EVENT',
      'filter[reportSubType]': 'SUMMARY',
      'filter[frequency]': 'DAILY',
      'filter[reportDate]': testDate,
      'filter[version]': '1_2'
    };

    const eventResponse = await client.request('/salesReports', eventParams);
    const eventCSV = decompress(eventResponse);
    const eventRows = parseCSV(eventCSV);
    
    console.log(`  Transactions: ${eventRows.length}`);
    
    if (eventRows.length > 0) {
      console.log('  Sample fields:');
      Object.keys(eventRows[0]).slice(0, 8).forEach(field => {
        console.log(`    ${field}: "${eventRows[0][field]}"`);
      });
    }
    
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }

  // Test 4: SUBSCRIBER Report
  console.log('\n📊 4. SUBSCRIBER REPORT:\n');
  try {
    const subscriberParams = {
      'filter[vendorNumber]': vendorNumber,
      'filter[reportType]': 'SUBSCRIBER',
      'filter[reportSubType]': 'DETAILED',
      'filter[frequency]': 'DAILY',
      'filter[reportDate]': testDate,
      'filter[version]': '1_3'
    };

    const subscriberResponse = await client.request('/salesReports', subscriberParams);
    const subscriberCSV = decompress(subscriberResponse);
    const subscriberRows = parseCSV(subscriberCSV);
    
    let subscriberRevenue = 0;
    subscriberRows.forEach(row => {
      const proceeds = parseFloat(row['Customer Price'] || row['Developer Proceeds'] || '0');
      const currency = row['Customer Currency'] || 'USD';
      
      if (currency === 'USD') {
        subscriberRevenue += proceeds;
      } else {
        const rates: Record<string, number> = {
          VND: 0.0000406,
          IDR: 0.000065,
          TZS: 0.00039,
          CLP: 0.0011,
        };
        subscriberRevenue += proceeds * (rates[currency] || 1);
      }
    });
    
    console.log(`  Transactions: ${subscriberRows.length}`);
    console.log(`  Revenue: $${subscriberRevenue.toFixed(2)}`);
    
    if (subscriberRows.length > 0) {
      console.log('  Sample fields:');
      Object.keys(subscriberRows[0]).slice(0, 8).forEach(field => {
        if (subscriberRows[0][field]) {
          console.log(`    ${field}: "${subscriberRows[0][field]}"`);
        }
      });
    }
    
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('💡 ANALYSIS:');
  console.log('─'.repeat(60));
  
  console.log('\nBased on Apple documentation:');
  console.log('• SALES report: New purchases only (not renewals)');
  console.log('• SUBSCRIPTION report: Should contain renewal data');
  console.log('• SUBSCRIPTION_EVENT: Individual renewal events');
  console.log('• SUBSCRIBER: Detailed subscriber activity');
  
  console.log('\n🎯 SOLUTION:');
  console.log('To get complete $220K revenue, you need to:');
  console.log('1. Sum SALES report (new purchases)');
  console.log('2. Add SUBSCRIPTION renewals (if accessible)');
  console.log('3. Or use Analytics API for complete metrics');
}

testCompleteRevenue().catch(console.error);