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
import { FinanceReportService } from '../services/finance-report-service.js';
import { AnalyticsService } from '../services/analytics-service.js';
import { BetaService } from '../services/beta-service.js';
import { ReviewService } from '../services/review-service.js';
import { SubscriptionService } from '../services/subscription-service.js';
import { ServerConfig } from '../types/config.js';

export class AppStoreMCPServer {
  private server: Server;
  private auth: JWTManager;
  private client: AppStoreClient;
  private appService: AppService;
  private financeService: FinanceService;
  private financeReportService: FinanceReportService;
  private analyticsService: AnalyticsService;
  private betaService: BetaService;
  private reviewService: ReviewService;
  private subscriptionService: SubscriptionService;

  constructor(config: ServerConfig) {
    // Initialize server
    this.server = new Server(
      {
        name: 'appstore-connect-mcp',
        version: '1.1.0'
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
    this.financeReportService = new FinanceReportService(this.client, config.vendorNumber || '');
    this.analyticsService = new AnalyticsService(this.client);
    this.betaService = new BetaService(this.client);
    this.reviewService = new ReviewService(this.client);
    this.subscriptionService = new SubscriptionService(this.client, config.vendorNumber);

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
      {
        name: 'get_monthly_revenue',
        description: 'Get aggregated monthly revenue (sums all daily reports)',
        inputSchema: {
          type: 'object',
          properties: {
            year: {
              type: 'number',
              description: 'Year (e.g., 2025)'
            },
            month: {
              type: 'number',
              description: 'Month (1-12)'
            }
          },
          required: ['year', 'month']
        }
      },
      {
        name: 'get_subscription_renewals',
        description: 'Get subscription renewal data for a specific date',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format (optional, defaults to yesterday)'
            }
          }
        }
      },
      {
        name: 'get_monthly_subscription_analytics',
        description: 'Get comprehensive subscription analytics for a month',
        inputSchema: {
          type: 'object',
          properties: {
            year: {
              type: 'number',
              description: 'Year (e.g., 2025)'
            },
            month: {
              type: 'number',
              description: 'Month (1-12)'
            }
          },
          required: ['year', 'month']
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

      // Beta testing tools
      {
        name: 'get_testflight_metrics',
        description: 'Get TestFlight beta testing metrics',
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
        name: 'get_beta_testers',
        description: 'Get list of beta testers',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of testers to return (default: 100)'
            }
          }
        }
      },

      // Review tools
      {
        name: 'get_customer_reviews',
        description: 'Get customer reviews and ratings',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'App ID to get reviews for'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of reviews (default: 100)'
            }
          }
        }
      },
      {
        name: 'get_review_metrics',
        description: 'Get comprehensive review metrics and sentiment analysis',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'App ID to analyze reviews for'
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
        // Use FINANCIAL reports for complete revenue (includes renewals)
        try {
          const latest = await this.financeReportService.getLatestAvailable();
          const MRR = latest.totalRevenue;
          const ARR = MRR * 12;
          
          // Convert Map to object for JSON serialization
          const byRegion: { [key: string]: number } = {};
          latest.byRegion.forEach((value, key) => {
            byRegion[key] = value;
          });
          
          return {
            MRR,
            ARR,
            currency: 'USD',
            lastUpdated: latest.metadata.month,
            byRegion,
            notes: 'Complete revenue from FINANCIAL reports (includes all renewals). Reports delayed ~1 month.'
          };
        } catch (error: any) {
          // Fallback to SALES reports if FINANCIAL not available
          return await this.financeService.getRevenueMetrics(args.appId);
        }
      
      case 'get_subscription_metrics':
        return await this.financeService.getSubscriptionMetrics();
      
      case 'get_monthly_revenue':
        if (!args.year || !args.month) {
          throw new Error('Year and month are required for monthly revenue');
        }
        
        // Try FINANCIAL reports first (complete revenue)
        try {
          const summary = await this.financeReportService.getMonthlySummary(args.year, args.month);
          
          // Convert Maps to objects for JSON serialization
          const byProduct: { [key: string]: number } = {};
          summary.byProduct.forEach((value, key) => {
            byProduct[key] = value;
          });
          
          const byRegion: { [key: string]: number } = {};
          summary.byRegion.forEach((value, key) => {
            byRegion[key] = value;
          });
          
          return {
            totalRevenue: summary.totalRevenue,
            byProduct,
            byRegion,
            salesVsReturns: summary.salesVsReturns,
            metadata: summary.metadata,
            source: 'FINANCIAL',
            notes: 'Complete revenue from FINANCIAL reports (includes all renewals)'
          };
        } catch (error: any) {
          // Fallback to SALES reports if FINANCIAL not available
          const salesData = await this.financeService.getMonthlyRevenue(args.year, args.month);
          return {
            ...salesData,
            source: 'SALES',
            notes: 'From SALES reports (new purchases only, excludes renewals)'
          };
        }
      
      case 'get_subscription_renewals':
        return await this.subscriptionService.getSubscriptionRenewals(args.date);
      
      case 'get_monthly_subscription_analytics':
        if (!args.year || !args.month) {
          throw new Error('Year and month are required for subscription analytics');
        }
        return await this.subscriptionService.getMonthlySubscriptionAnalytics(args.year, args.month);
      
      // Analytics tools
      case 'get_app_analytics':
        if (!args.appId) {
          throw new Error('App ID is required for analytics');
        }
        return await this.analyticsService.getAppAnalytics({
          appId: args.appId,
          metricType: args.metricType || 'USERS'
        });
      
      // Beta testing tools
      case 'get_testflight_metrics':
        return await this.betaService.getTestFlightSummary(args.appId);
      
      case 'get_beta_testers':
        return await this.betaService.getBetaTesters(args.limit || 100);
      
      // Review tools
      case 'get_customer_reviews':
        if (!args.appId) {
          throw new Error('App ID is required for reviews');
        }
        return await this.reviewService.getCustomerReviews(args.appId, args.limit || 100);
      
      case 'get_review_metrics':
        if (!args.appId) {
          throw new Error('App ID is required for review metrics');
        }
        return await this.reviewService.getReviewSummary(args.appId);
      
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