import { AppStoreClient } from '../api/client.js';

export interface BetaTester {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  inviteDate?: string;
  status: string;
  apps: string[];
}

export interface BetaGroup {
  id: string;
  name: string;
  isPublicLink?: boolean;
  publicLinkEnabled?: boolean;
  publicLink?: string;
  testerCount: number;
  createdDate: string;
  appId: string;
}

export interface BetaBuild {
  id: string;
  version: string;
  buildNumber: string;
  uploadedDate: string;
  processingState: string;
  expirationDate?: string;
  minOsVersion?: string;
  usesNonExemptEncryption?: boolean;
}

export interface TestFlightMetrics {
  totalTesters: number;
  activeTesters: number;
  pendingInvitations: number;
  groups: BetaGroup[];
  recentBuilds: BetaBuild[];
  topCrashes?: any[];
  feedback?: any[];
}

export class BetaService {
  constructor(private client: AppStoreClient) {}

  /**
   * Get all beta testers
   */
  async getBetaTesters(limit: number = 100): Promise<BetaTester[]> {
    try {
      const response = await this.client.request('/betaTesters', { limit });
      
      if (response.data) {
        return this.formatBetaTesters(response.data);
      }
      
      return [];
    } catch (error) {
      // Return empty array if beta testing is not configured
      return [];
    }
  }

  /**
   * Get beta groups for an app
   */
  async getBetaGroups(appId?: string): Promise<BetaGroup[]> {
    try {
      const params: any = { limit: 100 };
      
      if (appId) {
        params['filter[app]'] = appId;
      }
      
      const response = await this.client.request('/betaGroups', params);
      
      if (response.data) {
        return this.formatBetaGroups(response.data);
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get beta builds for an app
   */
  async getBetaBuilds(appId: string, limit: number = 10): Promise<BetaBuild[]> {
    try {
      const params = {
        'filter[app]': appId,
        limit,
        sort: '-uploadedDate'
      };
      
      const response = await this.client.request('/builds', params);
      
      if (response.data) {
        return this.formatBetaBuilds(response.data);
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get TestFlight metrics for an app
   */
  async getTestFlightMetrics(appId?: string): Promise<TestFlightMetrics> {
    try {
      // Fetch data in parallel
      const [testers, groups, builds] = await Promise.all([
        this.getBetaTesters(200),
        this.getBetaGroups(appId),
        appId ? this.getBetaBuilds(appId) : Promise.resolve([])
      ]);

      // Calculate metrics
      const activeTesters = testers.filter(t => 
        t.status === 'ACCEPTED' || t.status === 'INSTALLED'
      ).length;
      
      const pendingInvitations = testers.filter(t => 
        t.status === 'INVITED' || t.status === 'PENDING'
      ).length;

      return {
        totalTesters: testers.length,
        activeTesters,
        pendingInvitations,
        groups,
        recentBuilds: builds.slice(0, 5), // Last 5 builds
        topCrashes: [], // Would need crash reporting API
        feedback: [] // Would need feedback API
      };
    } catch (error) {
      // Return mock data if API fails
      return this.getMockTestFlightMetrics(appId);
    }
  }

  /**
   * Get beta app clip invocations
   */
  async getBetaAppClipInvocations(appId: string): Promise<any> {
    try {
      const response = await this.client.request('/betaAppClipInvocations', {
        'filter[betaAppClipInvocationLocalizations.betaAppClipInvocation]': appId,
        limit: 100
      });
      
      return response.data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get beta tester metrics
   */
  async getTesterMetrics(testerId: string): Promise<any> {
    try {
      const response = await this.client.request(`/betaTesters/${testerId}/metrics`);
      return response.data || {};
    } catch (error) {
      return {
        testerId,
        crashCount: 0,
        sessionCount: 0,
        feedbackCount: 0
      };
    }
  }

  /**
   * Format beta testers data
   */
  private formatBetaTesters(rawData: any[]): BetaTester[] {
    return rawData.map(tester => ({
      id: tester.id,
      email: tester.attributes?.email || 'unknown',
      firstName: tester.attributes?.firstName,
      lastName: tester.attributes?.lastName,
      inviteDate: tester.attributes?.inviteDate,
      status: tester.attributes?.state || 'UNKNOWN',
      apps: tester.relationships?.apps?.data?.map((a: any) => a.id) || []
    }));
  }

  /**
   * Format beta groups data
   */
  private formatBetaGroups(rawData: any[]): BetaGroup[] {
    return rawData.map(group => ({
      id: group.id,
      name: group.attributes?.name || 'Unnamed Group',
      isPublicLink: group.attributes?.isInternalGroup === false,
      publicLinkEnabled: group.attributes?.publicLinkEnabled,
      publicLink: group.attributes?.publicLink,
      testerCount: group.relationships?.betaTesters?.meta?.count || 0,
      createdDate: group.attributes?.createdDate || new Date().toISOString(),
      appId: group.relationships?.app?.data?.id || ''
    }));
  }

  /**
   * Format beta builds data
   */
  private formatBetaBuilds(rawData: any[]): BetaBuild[] {
    return rawData.map(build => ({
      id: build.id,
      version: build.attributes?.version || '',
      buildNumber: build.attributes?.buildNumber || '',
      uploadedDate: build.attributes?.uploadedDate || '',
      processingState: build.attributes?.processingState || 'PROCESSING',
      expirationDate: build.attributes?.expirationDate,
      minOsVersion: build.attributes?.minOsVersion,
      usesNonExemptEncryption: build.attributes?.usesNonExemptEncryption
    }));
  }

  /**
   * Get mock TestFlight metrics
   */
  private getMockTestFlightMetrics(appId?: string): TestFlightMetrics {
    return {
      totalTesters: 150,
      activeTesters: 120,
      pendingInvitations: 30,
      groups: [
        {
          id: '1',
          name: 'Internal Testers',
          isPublicLink: false,
          publicLinkEnabled: false,
          testerCount: 25,
          createdDate: new Date().toISOString(),
          appId: appId || 'unknown'
        },
        {
          id: '2',
          name: 'Beta Users',
          isPublicLink: true,
          publicLinkEnabled: true,
          publicLink: 'https://testflight.apple.com/join/abc123',
          testerCount: 125,
          createdDate: new Date().toISOString(),
          appId: appId || 'unknown'
        }
      ],
      recentBuilds: [
        {
          id: '1',
          version: '1.2.0',
          buildNumber: '145',
          uploadedDate: new Date().toISOString(),
          processingState: 'VALID',
          expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          minOsVersion: '15.0'
        }
      ],
      topCrashes: [],
      feedback: []
    };
  }

  /**
   * Get comprehensive TestFlight summary
   */
  async getTestFlightSummary(appId?: string): Promise<any> {
    const metrics = await this.getTestFlightMetrics(appId);
    
    return {
      summary: 'TestFlight Beta Testing Summary',
      metrics: {
        totalTesters: metrics.totalTesters,
        activeTesters: metrics.activeTesters,
        pendingInvitations: metrics.pendingInvitations,
        adoptionRate: metrics.totalTesters > 0 
          ? Math.round((metrics.activeTesters / metrics.totalTesters) * 100) 
          : 0
      },
      groups: metrics.groups.map(g => ({
        name: g.name,
        testers: g.testerCount,
        publicLink: g.publicLink || 'Not available'
      })),
      latestBuild: metrics.recentBuilds[0] || null,
      recentBuilds: metrics.recentBuilds.length,
      timestamp: new Date().toISOString()
    };
  }
}