#!/usr/bin/env tsx
/**
 * Test FINANCE REPORTS endpoint - this is where renewals should be!
 * Different from salesReports endpoint
 */

import dotenv from 'dotenv';
import { JWTManager } from './auth/jwt-manager.js';
import { AppStoreClient } from './api/client.js';
import { gunzipSync } from 'zlib';

dotenv.config();

async function testFinanceReports() {
  console.log('💰 TESTING FINANCE REPORTS ENDPOINT\n');
  console.log('This should have COMPLETE revenue including renewals!\n');

  const keyId = process.env.APP_STORE_KEY_ID!;
  const issuerId = process.env.APP_STORE_ISSUER_ID!;
  const p8Path = process.env.APP_STORE_P8_PATH!;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER!;

  const auth = new JWTManager({ keyId, issuerId, p8Path });
  const client = new AppStoreClient(auth);

  // Helper to decompress
  function decompress(data: any): string {
    if (Buffer.isBuffer(data)) {
      if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        return gunzipSync(data).toString('utf-8');
      }
      return data.toString('utf-8');
    }
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  // Note: Apple fiscal calendar starts in October
  // So fiscal period 10 = July (Oct=1, Nov=2... July=10)
  
  console.log('📊 TEST 1: FINANCIAL Report (Aggregated Monthly)\n');
  
  const financialParams = [
    { reportDate: '2025-10', description: 'July 2025 (fiscal period 10)' },
    { reportDate: '2025-09', description: 'June 2025 (fiscal period 9)' },
    { reportDate: '2025-08', description: 'May 2025 (fiscal period 8)' }
  ];
  
  for (const { reportDate, description } of financialParams) {
    console.log(`Testing: ${description}`);
    
    try {
      const params = {
        'filter[reportType]': 'FINANCIAL',
        'filter[regionCode]': 'US',  // US only
        'filter[reportDate]': reportDate,
        'filter[vendorNumber]': vendorNumber
      };

      const response = await client.request('/financeReports', params);
      const content = decompress(response);
      
      console.log(`  ✅ SUCCESS - Response length: ${content.length} bytes`);
      
      // Check if it's CSV or JSON
      if (content.startsWith('{') || content.startsWith('[')) {
        const data = JSON.parse(content);
        console.log('  Response is JSON:', JSON.stringify(data, null, 2).substring(0, 500));
      } else {
        // Parse CSV
        const lines = content.split('\n').filter(l => l.trim());
        console.log(`  Response is CSV with ${lines.length} rows`);
        
        if (lines.length > 0) {
          console.log('  Headers:', lines[0].substring(0, 200));
          if (lines.length > 1) {
            console.log('  First data row:', lines[1].substring(0, 200));
          }
        }
      }
      
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      if (error.response?.data) {
        console.log('  Details:', error.response.data);
      }
    }
    
    console.log();
  }

  console.log('📊 TEST 2: FINANCE_DETAIL Report (Detailed)\n');
  
  try {
    const detailParams = {
      'filter[reportType]': 'FINANCE_DETAIL',
      'filter[regionCode]': 'Z1',  // Z1 for detailed across regions
      'filter[reportDate]': '2025-10',  // July 2025
      'filter[vendorNumber]': vendorNumber
    };

    console.log('Testing detailed finance report for July 2025...');
    const response = await client.request('/financeReports', detailParams);
    const content = decompress(response);
    
    console.log(`✅ SUCCESS - Response length: ${content.length} bytes`);
    
    // Parse the response
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length > 0) {
      const headers = lines[0].split('\t');
      console.log(`\nColumns (${headers.length}):`);
      
      // Show revenue-related columns
      headers.forEach((h, i) => {
        if (h.toLowerCase().includes('revenue') ||
            h.toLowerCase().includes('proceed') ||
            h.toLowerCase().includes('amount') ||
            h.toLowerCase().includes('units')) {
          console.log(`  ${i}: ${h}`);
        }
      });
      
      // Calculate total revenue
      if (lines.length > 1) {
        let totalRevenue = 0;
        let usRevenue = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          
          // Look for proceeds or amount columns
          const amountIdx = headers.findIndex(h => 
            h.toLowerCase().includes('amount') || 
            h.toLowerCase().includes('proceeds')
          );
          
          const countryIdx = headers.findIndex(h => 
            h.toLowerCase().includes('country') ||
            h.toLowerCase().includes('territory')
          );
          
          if (amountIdx >= 0) {
            const amount = parseFloat(values[amountIdx] || '0');
            totalRevenue += amount;
            
            if (countryIdx >= 0 && values[countryIdx] === 'US') {
              usRevenue += amount;
            }
          }
        }
        
        console.log(`\n💰 REVENUE SUMMARY:`);
        console.log(`  Total rows: ${lines.length - 1}`);
        console.log(`  Total revenue: $${totalRevenue.toFixed(2)}`);
        console.log(`  US revenue: $${usRevenue.toFixed(2)}`);
      }
    }
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response?.status === 404) {
      console.log('Note: Report might not be available yet for this period');
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('💡 ANALYSIS:');
  console.log('─'.repeat(60));
  console.log('Finance Reports should contain COMPLETE revenue including:');
  console.log('• New subscriptions');
  console.log('• Subscription renewals');
  console.log('• One-time purchases');
  console.log('• All proceeds after Apple\'s cut');
  console.log('\nIf this shows ~$220K for US, we found the missing renewals!');
}

testFinanceReports().catch(console.error);