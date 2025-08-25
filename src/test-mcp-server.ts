#!/usr/bin/env tsx
/**
 * Test MCP Server - simulates what Claude Desktop sees
 * This tests the actual MCP server protocol
 */

import { AppStoreMCPServer } from './server/mcp-server.js';
import { ServerConfig } from './types/config.js';

async function testMCPServer() {
  console.log('🔧 Testing MCP Server Protocol v1.1.0\n');
  console.log('This simulates what Claude Desktop will see...\n');

  // Load config from environment
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;

  if (!keyId || !issuerId || !p8Path) {
    console.error('❌ Missing required environment variables!');
    console.error('   Please set: APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_P8_PATH');
    process.exit(1);
  }

  const config: ServerConfig = {
    auth: {
      keyId,
      issuerId,
      p8Path
    },
    vendorNumber,
    debug: false
  };

  try {
    console.log('🚀 Creating MCP Server instance...');
    const server = new AppStoreMCPServer(config);
    
    // Access the private server to get tool definitions
    // In production, this would be done through the MCP protocol
    const serverInstance = (server as any).server;
    
    console.log('✅ Server created successfully!\n');
    
    console.log('📋 AVAILABLE TOOLS FOR CLAUDE:\n');
    
    // Get tool definitions (simulating ListToolsRequest)
    const tools = (server as any).getToolDefinitions();
    
    console.log(`Total tools available: ${tools.length}\n`);
    
    // List each tool with its description
    tools.forEach((tool: any, index: number) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   📝 ${tool.description}`);
      
      // Show input parameters
      if (tool.inputSchema?.properties) {
        const params = Object.keys(tool.inputSchema.properties);
        if (params.length > 0) {
          console.log(`   📥 Parameters: ${params.join(', ')}`);
        } else {
          console.log('   📥 No parameters required');
        }
      }
      console.log();
    });

    console.log('─'.repeat(60));
    console.log('\n🎯 TOOL CATEGORIES:\n');
    
    // Categorize tools
    const categories = {
      'App Management': ['list_apps', 'get_app'],
      'Financial': ['get_sales_report', 'get_revenue_metrics', 'get_subscription_metrics'],
      'Analytics': ['get_app_analytics'],
      'Beta Testing': ['get_testflight_metrics', 'get_beta_testers'],
      'Reviews': ['get_customer_reviews', 'get_review_metrics'],
      'Utility': ['test_connection', 'get_api_stats']
    };
    
    Object.entries(categories).forEach(([category, toolNames]) => {
      const availableTools = toolNames.filter(name => 
        tools.some((t: any) => t.name === name)
      );
      console.log(`📦 ${category}: ${availableTools.length} tools`);
      availableTools.forEach(name => {
        console.log(`   • ${name}`);
      });
    });

    console.log('\n─'.repeat(60));
    console.log('\n🔍 TESTING TOOL EXECUTION:\n');

    // Test executing a tool (simulating CallToolRequest)
    console.log('Testing: test_connection...');
    try {
      const result = await (server as any).executeTool('test_connection', {});
      console.log('✅ Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Error:', error);
    }

    console.log('\nTesting: get_api_stats...');
    try {
      const result = await (server as any).executeTool('get_api_stats', {});
      console.log('✅ Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Error:', error);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ MCP SERVER READY FOR CLAUDE DESKTOP!\n');
    console.log('The server exposes:');
    console.log(`  • ${tools.length} tools total`);
    console.log(`  • ${Object.keys(categories).length} categories`);
    console.log(`  • Version: 1.1.0`);
    console.log('\nTo use in Claude Desktop, ensure your config includes:');
    console.log('```json');
    console.log(JSON.stringify({
      "appstore-connect": {
        "command": "node",
        "args": ["dist/index.js"],
        "env": {
          "APP_STORE_KEY_ID": "YOUR_KEY_ID",
          "APP_STORE_ISSUER_ID": "YOUR_ISSUER_ID",
          "APP_STORE_P8_PATH": "/path/to/AuthKey.p8",
          "APP_STORE_VENDOR_NUMBER": "YOUR_VENDOR_NUMBER"
        }
      }
    }, null, 2));
    console.log('```');

    console.log('\n🎉 Server test complete!');

  } catch (error) {
    console.error('\n❌ Server test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Run the test
testMCPServer().catch(console.error);