# RFC-001: App Store Connect MCP Server Architecture

**RFC Number**: 001  
**Title**: App Store Connect MCP Server Architecture  
**Author**: Sid Sarasvati  
**Status**: Draft  
**Created**: August 21, 2025  
**Updated**: August 21, 2025  

## Summary

This RFC proposes the technical architecture for `appstore-connect-mcp`, a Model Context Protocol server that bridges App Store Connect API with AI assistants. The design prioritizes simplicity, reliability, and AI-optimized responses while maintaining security and performance.

## Motivation

As documented in the PRFAQ, iOS developers need seamless access to App Store Connect data through AI assistants. Current solutions are broken, non-existent, or require extensive manual integration. This RFC defines how we build a production-ready solution in minimal time with maximum reliability.

## Detailed Design

### System Architecture

```
┌─────────────────┐     MCP Protocol    ┌─────────────────┐
│                 │◄──────────────────►  │                 │
│  Claude/AI      │                      │   MCP Server    │
│  Assistant      │                      │   (Our Code)    │
└─────────────────┘                      └────────┬────────┘
                                                   │
                                          JWT Auth │ HTTPS
                                                   ▼
                                         ┌─────────────────┐
                                         │  App Store      │
                                         │  Connect API    │
                                         │  (v3.2)         │
                                         └─────────────────┘
```

### Core Components

#### 1. Authentication Module (`src/auth/`)

```typescript
// src/auth/jwt-manager.ts
export class JWTManager {
  private privateKey: string;
  private keyId: string;
  private issuerId: string;
  private tokenCache: Map<string, {token: string, expiry: Date}>;
  
  constructor(config: AuthConfig) {
    this.privateKey = this.loadP8Key(config.p8Path);
    this.keyId = config.keyId;
    this.issuerId = config.issuerId;
    this.tokenCache = new Map();
  }
  
  async getToken(): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get('primary');
    if (cached && cached.expiry > new Date()) {
      return cached.token;
    }
    
    // Generate new token
    const token = this.generateJWT();
    this.tokenCache.set('primary', {
      token,
      expiry: new Date(Date.now() + 19 * 60 * 1000) // 19 minutes
    });
    
    return token;
  }
  
  private generateJWT(): string {
    const payload = {
      iss: this.issuerId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (20 * 60), // 20 minutes
      aud: 'appstoreconnect-v1',
      scope: ['GET']
    };
    
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'ES256',
      keyid: this.keyId
    });
  }
}
```

**Key Decisions**:
- JWT tokens cached for 19 minutes (1 minute buffer before 20-minute expiry)
- Automatic refresh on expiry
- P8 key loaded once at startup
- Thread-safe token generation

#### 2. API Client (`src/api/`)

```typescript
// src/api/client.ts
export class AppStoreClient {
  private baseURL = 'https://api.appstoreconnect.apple.com/v1';
  private auth: JWTManager;
  private rateLimiter: RateLimiter;
  
  constructor(auth: JWTManager) {
    this.auth = auth;
    this.rateLimiter = new RateLimiter({
      maxRequests: 3600,
      perHour: true
    });
  }
  
  async request<T>(endpoint: string, params?: any): Promise<T> {
    await this.rateLimiter.acquire();
    
    const token = await this.auth.getToken();
    
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - exponential backoff
        await this.handleRateLimit();
        return this.request(endpoint, params);
      }
      throw this.wrapError(error);
    }
  }
  
  async paginate<T>(endpoint: string, params?: any): AsyncGenerator<T> {
    let nextUrl: string | null = endpoint;
    
    while (nextUrl) {
      const response = await this.request<PagedResponse<T>>(nextUrl, params);
      
      for (const item of response.data) {
        yield item;
      }
      
      nextUrl = response.links?.next || null;
      params = undefined; // Clear params after first request
    }
  }
}
```

**Key Decisions**:
- Built-in rate limiting (3600 requests/hour Apple limit)
- Automatic pagination with async generators
- Exponential backoff for rate limit handling
- Generic typing for all responses

#### 3. Domain Services (`src/services/`)

```typescript
// src/services/analytics.ts
export class AnalyticsService {
  constructor(private client: AppStoreClient) {}
  
  async getAppAnalytics(appId: string, options: AnalyticsOptions) {
    // Transform high-level request to API calls
    const reports = await this.client.request('/analyticsReportRequests', {
      'filter[app]': appId,
      'filter[frequency]': options.frequency || 'DAILY',
      'filter[reportType]': options.type,
      'filter[reportDate]': options.date
    });
    
    // Process and format for AI consumption
    return this.formatForAI(reports);
  }
  
  private formatForAI(data: any): AIFormattedResponse {
    // Convert Apple's complex structure to simple AI-friendly format
    return {
      summary: this.generateSummary(data),
      metrics: this.extractKeyMetrics(data),
      insights: this.generateInsights(data),
      rawData: data // Include for completeness
    };
  }
}
```

**Services to Implement**:
- `AnalyticsService`: User metrics, engagement, retention
- `FinanceService`: Sales, subscriptions, proceeds
- `AppService`: App metadata, versions, pricing
- `BetaService`: TestFlight management
- `ReviewService`: Ratings and reviews

#### 4. MCP Server (`src/server/`)

```typescript
// src/server/mcp-server.ts
export class AppStoreMCPServer {
  private server: Server;
  private services: ServiceRegistry;
  
  constructor(config: ServerConfig) {
    this.server = new Server({
      name: 'appstore-connect-mcp',
      version: '1.0.0'
    });
    
    this.services = this.initializeServices(config);
    this.registerTools();
  }
  
  private registerTools() {
    // Financial tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_ios_revenue',
          description: 'Get iOS app revenue metrics (ARR, MRR, etc)',
          inputSchema: {
            type: 'object',
            properties: {
              appId: { type: 'string', description: 'App ID (optional, all apps if omitted)' },
              period: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
              metric: { type: 'string', enum: ['revenue', 'units', 'proceeds'] }
            }
          }
        },
        {
          name: 'get_subscription_metrics',
          description: 'Get subscription analytics (churn, LTV, retention)',
          inputSchema: {
            type: 'object',
            properties: {
              appId: { type: 'string' },
              cohort: { type: 'string', description: 'Cohort period' }
            }
          }
        },
        // ... more tools
      ]
    }));
    
    // Tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.executeTools(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `Error: ${error.message}` 
          }],
          isError: true 
        };
      }
    });
  }
}
```

### Data Flow

1. **AI Request**: "What's our iOS monthly recurring revenue?"
2. **MCP Server**: Receives tool call `get_ios_revenue({period: 'month', metric: 'revenue'})`
3. **Service Layer**: Routes to FinanceService
4. **API Client**: Generates JWT, makes authenticated request
5. **Apple API**: Returns raw financial data
6. **Service Layer**: Formats response for AI consumption
7. **MCP Server**: Returns formatted response to AI
8. **AI Response**: "Your iOS MRR is $127,853 across 8,421 active subscriptions"

### Error Handling Strategy

```typescript
enum ErrorClass {
  AUTH = 'Authentication failed',
  RATE_LIMIT = 'Rate limited',
  NOT_FOUND = 'Resource not found',
  PERMISSION = 'Insufficient permissions',
  NETWORK = 'Network error',
  UNKNOWN = 'Unknown error'
}

class AppStoreError extends Error {
  constructor(
    public code: ErrorClass,
    public message: string,
    public retry: boolean,
    public details?: any
  ) {
    super(message);
  }
}
```

**Error Responses for AI**:
- Clear, actionable error messages
- Suggest fixes where possible
- Include retry information
- Log full details for debugging

### Security Considerations

1. **Credential Storage**:
   - P8 keys only via file path, never in config
   - Environment variables for sensitive data
   - File permissions validation (600 recommended)

2. **Runtime Security**:
   - No credential logging
   - Sanitized error messages
   - Request/response validation
   - TLS for all Apple API calls

3. **Access Control**:
   - Read-only API scope by default
   - Optional write scope (explicit config)
   - Per-tool permission model

### Performance Optimizations

1. **Caching**:
   ```typescript
   class ResponseCache {
     private cache: LRUCache<string, CachedResponse>;
     
     constructor() {
       this.cache = new LRUCache({
         max: 1000,
         ttl: 5 * 60 * 1000 // 5 minutes default
       });
     }
     
     getCacheKey(tool: string, args: any): string {
       return `${tool}:${JSON.stringify(args)}`;
     }
   }
   ```

2. **Parallel Requests**:
   - Batch compatible requests
   - Promise.all for independent calls
   - Connection pooling

3. **Data Compression**:
   - Gzip requests/responses
   - Streaming for large datasets
   - Pagination limits for AI context

### Testing Strategy

```typescript
// src/test/setup.ts
export class TestSetup {
  mockServer: MockAppStoreServer;
  realServer: AppStoreMCPServer;
  
  async beforeAll() {
    // Start mock Apple API server
    this.mockServer = new MockAppStoreServer();
    await this.mockServer.start();
    
    // Initialize MCP server with mock endpoint
    this.realServer = new AppStoreMCPServer({
      apiEndpoint: this.mockServer.url,
      auth: this.getMockAuth()
    });
  }
}
```

**Test Coverage**:
- Unit tests: 90% coverage target
- Integration tests: Critical paths
- E2E tests: With real API (CI only)
- Performance tests: Response time < 2s

### Deployment Options

1. **Local Development**:
   ```bash
   npm run dev
   # Starts with hot reload, verbose logging
   ```

2. **Production Local**:
   ```bash
   npm run build
   npm start
   # Optimized, minimal logging
   ```

3. **Docker**:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY dist ./dist
   CMD ["node", "dist/index.js"]
   ```

4. **Claude Desktop Config**:
   ```json
   {
     "mcpServers": {
       "appstore-connect": {
         "command": "node",
         "args": ["/path/to/appstore-connect-mcp/dist/index.js"],
         "env": {
           "APP_STORE_KEY_ID": "${APP_STORE_KEY_ID}",
           "APP_STORE_ISSUER_ID": "${APP_STORE_ISSUER_ID}",
           "APP_STORE_P8_PATH": "${HOME}/.config/appstore-key.p8"
         }
       }
     }
   }
   ```

## Implementation Plan

### Phase 1: Core (Day 1 - 3 hours)
1. Project setup and structure (30 min)
2. Authentication module with JWT (45 min)
3. Basic API client with one endpoint (45 min)
4. Simple MCP server with one tool (30 min)
5. Local testing with Claude Desktop (30 min)

### Phase 2: Features (Day 2 - 4 hours)
1. Complete API client with pagination (1 hour)
2. All service implementations (2 hours)
3. Full tool suite for MCP (1 hour)

### Phase 3: Production (Day 3 - 3 hours)
1. Error handling and retry logic (1 hour)
2. Caching and performance (1 hour)
3. Documentation and examples (1 hour)

### Phase 4: Release (Day 4 - 2 hours)
1. GitHub repository setup (30 min)
2. NPM package publication (30 min)
3. Announcement and marketing (1 hour)

## Alternative Approaches Considered

1. **GraphQL Instead of REST**:
   - Rejected: Apple doesn't offer GraphQL API
   
2. **Proxy Server Architecture**:
   - Rejected: Adds complexity, latency, privacy concerns
   
3. **Browser Extension**:
   - Rejected: Limited to browser, complex distribution
   
4. **SaaS Model**:
   - Rejected: Privacy concerns, ongoing maintenance

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "jsonwebtoken": "^9.0.0",
    "axios": "^1.6.0",
    "lru-cache": "^10.0.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "vitest": "^1.0.0",
    "tsx": "^4.0.0"
  }
}
```

## Open Questions

1. **Should we support multiple App Store Connect accounts?**
   - Current design: Single account per server instance
   - Alternative: Multi-tenant with account switching

2. **How do we handle App Store Connect maintenance windows?**
   - Current: Fail with clear error
   - Alternative: Queue requests for retry

3. **Should we build a UI for configuration?**
   - Current: Config file only
   - Alternative: Web UI for setup

## Success Criteria

- **Functional**: All PRFAQ features working
- **Performance**: < 2s response time for common queries
- **Reliability**: 99.9% uptime (excluding Apple downtime)
- **Adoption**: 100+ stars in first week
- **Quality**: Zero critical bugs in first month

## References

- [App Store Connect API Documentation](https://developer.apple.com/documentation/appstoreconnectapi)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [Apple API Design Guidelines](https://developer.apple.com/documentation/appstoreconnectapi/api_design)

---

**Next Steps**:
1. Review and gather feedback on this RFC
2. Make necessary adjustments
3. Begin Phase 1 implementation
4. Daily progress updates in Linear (SID-XXX)

---

*RFC Version 1.0 - Ready for Review*