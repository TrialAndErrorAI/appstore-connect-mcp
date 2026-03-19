import { AppStoreClient } from '../api/client.js';

export interface AnalyticsMetrics {
  appId: string;
  metrics: {
    users?: number;
    sessions?: number;
    crashes?: number;
    retention?: {
      day1: number;
      day7: number;
      day30: number;
    };
    engagement?: {
      avgSessionLength: number;
      sessionsPerUser: number;
    };
  };
  period: string;
}

export interface AnalyticsRequest {
  appId: string;
  metricType: 'USERS' | 'SESSIONS' | 'CRASHES' | 'RETENTION' | 'ENGAGEMENT';
  startDate?: string;
  endDate?: string;
  granularity?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export class AnalyticsService {
  constructor(private client: AppStoreClient) {}

  /**
   * Get analytics for a specific app
   * Note: Apple's Analytics Reports API requires creating report requests
   * and polling for results. This is a different flow than other endpoints.
   */
  async getAppAnalytics(request: AnalyticsRequest): Promise<AnalyticsMetrics> {
    if (!request.appId) {
      throw new Error('App ID is required for analytics');
    }

    // Try to get analytics via the report request flow
    const analyticsData = await this.getAnalyticsReportRequest(request);
    return this.formatAnalyticsData(analyticsData, request);
  }

  /**
   * Create and retrieve analytics report request
   */
  private async getAnalyticsReportRequest(request: AnalyticsRequest): Promise<any> {
    // First, check for existing report requests
    try {
      const existing = await this.client.request(
        `/apps/${request.appId}/analyticsReportRequests`,
        { limit: 10 }
      );

      if (existing.data && existing.data.length > 0) {
        // Use existing report request
        const reportId = existing.data[0].id;
        const instances = await this.client.request(
          `/analyticsReportRequests/${reportId}/reports`
        );
        return instances;
      }
    } catch {
      // No existing reports, try to create one
    }

    // Create a new report request
    const reportRequest = {
      data: {
        type: 'analyticsReportRequests',
        attributes: {
          accessType: 'ONGOING'
        },
        relationships: {
          app: {
            data: {
              type: 'apps',
              id: request.appId
            }
          }
        }
      }
    };

    const response = await this.client.request(
      '/analyticsReportRequests',
      reportRequest
    );

    if (response.data && response.data.id) {
      const instances = await this.client.request(
        `/analyticsReportRequests/${response.data.id}/reports`
      );
      return instances;
    }

    throw new Error('Analytics Reports API: No report data available. Apple Analytics reports require enrollment and may take up to 24 hours to generate after first request.');
  }

  /**
   * Format analytics data for AI consumption
   */
  private formatAnalyticsData(rawData: any, request: AnalyticsRequest): AnalyticsMetrics {
    const metrics: AnalyticsMetrics = {
      appId: request.appId,
      metrics: {},
      period: request.granularity || 'DAILY'
    };

    if (rawData && rawData.data) {
      const data = Array.isArray(rawData.data) ? rawData.data : [rawData.data];

      for (const item of data) {
        if (item.attributes) {
          const attrs = item.attributes;

          switch (request.metricType) {
            case 'USERS':
              metrics.metrics.users = attrs.uniqueDevices || attrs.activeDevices || 0;
              break;
            case 'SESSIONS':
              metrics.metrics.sessions = attrs.sessions || 0;
              if (attrs.averageSessionDuration) {
                metrics.metrics.engagement = {
                  avgSessionLength: attrs.averageSessionDuration,
                  sessionsPerUser: attrs.sessionsPerActiveDevice || 0
                };
              }
              break;
            case 'CRASHES':
              metrics.metrics.crashes = attrs.crashes || attrs.crashCount || 0;
              break;
            case 'RETENTION':
              metrics.metrics.retention = {
                day1: attrs.day1Retention || 0,
                day7: attrs.day7Retention || 0,
                day30: attrs.day30Retention || 0
              };
              break;
            case 'ENGAGEMENT':
              metrics.metrics.engagement = {
                avgSessionLength: attrs.averageSessionDuration || 0,
                sessionsPerUser: attrs.sessionsPerActiveDevice || 0
              };
              break;
          }
        }
      }
    }

    return metrics;
  }
}
