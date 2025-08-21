import { AppStoreClient } from '../api/client.js';
import { App } from '../types/api.js';

export class AppService {
  constructor(private client: AppStoreClient) {}

  /**
   * Get all apps
   */
  async listApps(): Promise<App[]> {
    const apps = await this.client.getAll<App>('/apps');
    return apps;
  }

  /**
   * Get a specific app by ID
   */
  async getApp(appId: string): Promise<App> {
    const response = await this.client.request<{ data: App }>(`/apps/${appId}`);
    return response.data;
  }

  /**
   * Get app by bundle ID
   */
  async getAppByBundleId(bundleId: string): Promise<App | null> {
    const response = await this.client.request<{ data: App[] }>('/apps', {
      'filter[bundleId]': bundleId
    });
    
    if (response.data.length === 0) {
      return null;
    }
    
    return response.data[0];
  }

  /**
   * Get formatted app summary for AI consumption
   */
  async getAppSummary(appId: string): Promise<any> {
    const app = await this.getApp(appId);
    
    return {
      id: app.id,
      name: app.attributes.name,
      bundleId: app.attributes.bundleId,
      sku: app.attributes.sku,
      primaryLocale: app.attributes.primaryLocale,
      kidsApp: app.attributes.isOrEverWasMadeForKids,
      // Add more formatted fields as needed
    };
  }

  /**
   * Get all apps with their basic info
   */
  async getAllAppsSummary(): Promise<any[]> {
    const apps = await this.listApps();
    
    return apps.map(app => ({
      id: app.id,
      name: app.attributes.name,
      bundleId: app.attributes.bundleId,
      sku: app.attributes.sku
    }));
  }
}