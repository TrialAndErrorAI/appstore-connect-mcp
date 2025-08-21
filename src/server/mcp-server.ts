import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { JWTManager } from '../auth/jwt-manager.js';
import { AppStoreClient } from '../api/client.js';
import { AppService } from '../services/app-service.js';
import { FinanceService } from '../services/finance-service.js';
import { ServerConfig } from '../types/config.js';

export class AppStoreMCPServer {
  private server: Server;
  private auth: JWTManager;
  private client: AppStoreClient;
  private appService: AppService;
  private financeService: FinanceService;

  constructor(config: ServerConfig) {
    // Initialize server
    this.server = new Server(
      {
        name: 'appstore-connect-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize auth and services
    this.auth = new JWTManager(config.auth);
    this.client = new AppStoreClient(this.auth);
    this.appService = new AppService(this.client);
    this.financeService = new FinanceService(this.client, config.vendorNumber);

    // Register handlers
    this.registerHandlers();
  }

  private registerHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions()
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.executeTool(name, args || {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private getToolDefinitions(): any[] {
    return [
      // App tools
      {
        name: 'list_apps',
        description: 'Get list of all apps in your App Store Connect account',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_app',
        description: 'Get detailed information about a specific app',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The App Store Connect app ID'
            },
            bundleId: {
              type: 'string',
              description: 'Alternative: find app by bundle ID'
            }
          }
        }
      },
      
      // Financial tools
      {
        name: 'get_sales_report',
        description: 'Get sales report for your apps',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format (defaults to yesterday)'
            },
            reportType: {
              type: 'string',
              enum: ['SALES', 'SUBSCRIPTION'],
              description: 'Type of report'
            }
          }
        }
      },
      {
        name: 'get_revenue_metrics',
        description: 'Get calculated revenue metrics (MRR, ARR, etc)',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'Optional: specific app ID to filter'
            }
          }
        }
      },
      {
        name: 'get_subscription_metrics',
        description: 'Get subscription-specific metrics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      // Analytics tools
      {
        name: 'get_app_analytics',
        description: 'Get app usage analytics',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'App ID to get analytics for'
            },
            metricType: {
              type: 'string',
              enum: ['USERS', 'SESSIONS', 'CRASHES', 'RETENTION'],
              description: 'Type of metric to retrieve'
            }
          }
        }
      },

      // Utility tools
      {
        name: 'test_connection',
        description: 'Test connection to App Store Connect API',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_api_stats',
        description: 'Get API usage statistics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  private async executeTool(name: string, args: any): Promise<any> {
    
    switch (name) {
      // App tools
      case 'list_apps':
        return await this.appService.getAllAppsSummary();
      
      case 'get_app':
        if (args.bundleId) {
          return await this.appService.getAppByBundleId(args.bundleId);
        } else if (args.appId) {
          return await this.appService.getAppSummary(args.appId);
        } else {
          throw new Error('Either appId or bundleId is required');
        }
      
      // Financial tools
      case 'get_sales_report':
        return await this.financeService.getSalesReport({
          date: args.date,
          reportType: args.reportType
        });
      
      case 'get_revenue_metrics':
        return await this.financeService.getRevenueMetrics(args.appId);
      
      case 'get_subscription_metrics':
        return await this.financeService.getSubscriptionMetrics();
      
      // Analytics tools
      case 'get_app_analytics':
        // Would implement analytics service
        return {
          message: 'Analytics service not yet implemented',
          appId: args.appId,
          metricType: args.metricType
        };
      
      // Utility tools
      case 'test_connection':
        const connected = await this.client.testConnection();
        return {
          connected,
          message: connected ? 'Successfully connected to App Store Connect' : 'Connection failed'
        };
      
      case 'get_api_stats':
        return this.client.getStats();
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}