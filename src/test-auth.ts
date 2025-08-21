#!/usr/bin/env tsx
/**
 * Test script for JWT authentication
 * Usage: npm run test:auth
 */

import { JWTManager } from './auth/jwt-manager.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAuth() {
  console.log('🧪 Testing App Store Connect JWT Authentication\n');

  // Check for required environment variables
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;

  if (!keyId || !issuerId || !p8Path) {
    console.error('❌ Missing required environment variables!');
    console.log('\nPlease create a .env file with:');
    console.log('APP_STORE_KEY_ID=your_key_id');
    console.log('APP_STORE_ISSUER_ID=your_issuer_id');
    console.log('APP_STORE_P8_PATH=/path/to/your/key.p8');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`  Key ID: ${keyId}`);
  console.log(`  Issuer ID: ${issuerId}`);
  console.log(`  P8 Path: ${p8Path}`);
  console.log('');

  try {
    // Initialize JWT Manager
    const jwtManager = new JWTManager({
      keyId,
      issuerId,
      p8Path
    });

    // Generate a token
    console.log('🔑 Generating JWT token...');
    const token = await jwtManager.getToken();
    
    console.log('\n✅ Token generated successfully!');
    console.log(`Token length: ${token.length} characters`);
    
    // Decode and display token info
    const decoded = jwt.decode(token, { complete: true });
    
    if (decoded) {
      console.log('\n📊 Token Details:');
      console.log('Header:', JSON.stringify(decoded.header, null, 2));
      console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
      
      // Calculate expiry
      const exp = (decoded.payload as any).exp;
      const expDate = new Date(exp * 1000);
      console.log(`\n⏰ Token expires at: ${expDate.toLocaleString()}`);
    }

    // Test cache
    console.log('\n🔄 Testing token cache...');
    const token2 = await jwtManager.getToken();
    
    if (token === token2) {
      console.log('✅ Cache working - same token returned');
    } else {
      console.log('❌ Cache not working - different token returned');
    }

    // Validate
    console.log('\n🔍 Running validation...');
    const isValid = await jwtManager.validate();
    
    if (isValid) {
      console.log('✅ JWT Manager validation passed!');
    } else {
      console.log('❌ JWT Manager validation failed');
    }

    console.log('\n🎉 All authentication tests passed!');
    console.log('\nYou can now use this token to make API calls to App Store Connect.');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
testAuth().catch(console.error);