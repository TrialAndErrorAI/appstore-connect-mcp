#!/usr/bin/env node
/**
 * App Store Connect MCP Server
 * Main entry point
 */

import dotenv from 'dotenv';
import { AppStoreMCPServer } from './server/mcp-server.js';
import { ServerConfig } from './types/config.js';

// Suppress ALL console output for MCP server
console.log = () => {};
console.error = process.stderr.write.bind(process.stderr);
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

// Load environment variables (will be silent now)
dotenv.config();

async function main() {
  // MCP servers must not output to stdout - only JSON-RPC messages allowed

  // Get configuration from environment
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const p8Path = process.env.APP_STORE_P8_PATH;
  const vendorNumber = process.env.APP_STORE_VENDOR_NUMBER;
  const debug = process.env.DEBUG === 'true';

  // Validate required configuration
  if (!keyId || !issuerId || !p8Path) {
    // MCP servers should fail silently or use stderr for errors
    process.stderr.write('Missing required environment variables: APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_P8_PATH\n');
    process.exit(1);
  }

  // Build configuration
  const config: ServerConfig = {
    auth: {
      keyId,
      issuerId,
      p8Path
    },
    vendorNumber,
    debug
  };

  // Debug output to stderr only
  if (debug) {
    process.stderr.write(`Debug: keyId=${keyId.substring(0, 4)}***, issuerId=${issuerId.substring(0, 8)}***\n`);
  }

  try {
    // Create and start server
    const server = new AppStoreMCPServer(config);
    await server.start();
    
    // Keep the process alive
    process.on('SIGINT', () => {
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      process.exit(0);
    });

  } catch (error) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  process.stderr.write(`Uncaught exception: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason}\n`);
  process.exit(1);
});

// Run the server
main().catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});