/**
 * App Store Connect MCP Server — Code Mode (v2.0)
 *
 * Two tools. 923 endpoints. Fixed token cost.
 *
 * search(code) — Agent writes JS to query the API spec
 * execute(code) — Agent writes JS to call the authenticated API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { JWTManager } from '../auth/jwt-manager.js';
import { AppStoreClient } from '../api/client.js';
import { loadSpec } from '../spec/loader.js';
import { executeInSandbox } from '../executor/sandbox.js';
import { ServerConfig } from '../types/config.js';

export class AppStoreMCPServer {
  private server: Server;
  private auth: JWTManager;
  private client: AppStoreClient;
  private spec: any;

  constructor(config: ServerConfig) {
    this.server = new Server(
      {
        name: 'appstore-connect-mcp',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.auth = new JWTManager(config.auth);
    this.client = new AppStoreClient(this.auth);

    // Load the OpenAPI spec (923 paths, pre-resolved)
    this.spec = loadSpec();

    this.registerHandlers();
  }

  private registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args || {});
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    });
  }

  private getToolDefinitions(): any[] {
    return [
      {
        name: 'search',
        description: `Write JavaScript to explore the App Store Connect API specification (${this.spec.pathCount} endpoints, ${this.spec.schemaCount} schemas, API v${this.spec.info.version}).

Available globals:
- \`spec\` — Object with all API endpoints. Structure: spec.paths['/v1/endpoint'].method

How to use:
- List all paths: Object.keys(spec.paths)
- Filter by keyword: Object.entries(spec.paths).filter(([p]) => p.includes('reviews'))
- Get endpoint details: spec.paths['/v1/apps'].get
- Check parameters: spec.paths['/v1/apps'].get.parameters
- Check response schema: spec.paths['/v1/apps'].get.responses
- Get tags: spec.paths['/v1/apps'].get.tags
- Search by tag: Object.entries(spec.paths).filter(([p, m]) => Object.values(m).some(op => op.tags?.includes('Apps')))

Return your findings as a value or use console.log().

Example — find all review-related endpoints:
  const reviews = Object.entries(spec.paths)
    .filter(([p]) => p.toLowerCase().includes('review'))
    .map(([path, methods]) => ({
      path,
      methods: Object.entries(methods).map(([m, op]) => ({ method: m.toUpperCase(), summary: op.summary }))
    }));
  return reviews;`,
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute. Has access to the `spec` object containing the full App Store Connect OpenAPI specification.'
            }
          },
          required: ['code']
        }
      },
      {
        name: 'execute',
        description: `Write JavaScript to call the App Store Connect API. Authentication is automatic (JWT injected).

Available globals:
- \`api\` — Authenticated client for App Store Connect.

Usage:
  const result = await api.request({
    method: 'GET',             // GET, POST, PATCH, DELETE
    path: '/v1/apps',          // API path (from search results)
    params: { limit: '10' },   // Query parameters (optional)
    body: { ... }              // Request body for POST/PATCH (optional)
  });

The response is parsed JSON. You can chain multiple API calls in one execution.
Use try/catch for error handling. Reports endpoints may return gzipped data — the client handles decompression.

Example — list apps then get reviews for first app:
  const apps = await api.request({ method: 'GET', path: '/v1/apps', params: { limit: '5' } });
  const appId = apps.data[0].id;
  const appName = apps.data[0].attributes.name;
  const reviews = await api.request({
    method: 'GET',
    path: '/v1/apps/' + appId + '/customerReviews',
    params: { limit: '5', sort: '-createdDate' }
  });
  return {
    app: appName,
    reviewCount: reviews.data.length,
    latest: reviews.data[0]?.attributes
  };`,
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute. Has access to the authenticated `api` client for App Store Connect.'
            }
          },
          required: ['code']
        }
      },
      {
        name: 'test_connection',
        description: 'Test connection to App Store Connect API and show server info',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  private async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'search': {
        if (!args.code) throw new Error('code is required');
        const result = await executeInSandbox(args.code, { spec: this.spec });
        if (result.error) {
          return { error: result.error, logs: result.logs };
        }
        return {
          result: result.result,
          logs: result.logs.length > 0 ? result.logs : undefined
        };
      }

      case 'execute': {
        if (!args.code) throw new Error('code is required');

        // Create a sandbox-friendly API wrapper
        const api = {
          request: async (opts: { method: string; path: string; params?: any; body?: any }) => {
            return this.client.request(opts.path, opts.params, {
              method: opts.method,
              data: opts.body
            });
          }
        };

        const result = await executeInSandbox(args.code, { api });
        if (result.error) {
          return { error: result.error, logs: result.logs };
        }
        return {
          result: result.result,
          logs: result.logs.length > 0 ? result.logs : undefined
        };
      }

      case 'test_connection': {
        const connected = await this.client.testConnection();
        return {
          connected,
          message: connected ? 'Successfully connected to App Store Connect' : 'Connection failed',
          server: 'appstore-connect-mcp',
          version: '2.0.0',
          mode: 'code-mode',
          spec: {
            apiVersion: this.spec.info.version,
            endpoints: this.spec.pathCount,
            schemas: this.spec.schemaCount
          }
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}. Available: search, execute, test_connection`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
