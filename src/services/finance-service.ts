import { AppStoreClient } from '../api/client.js';

export interface FinanceReportRequest {
  vendorNumber: string;
  reportType: 'SALES' | 'SUBSCRIPTION' | 'SUBSCRIPTION_EVENT' | 'SUBSCRIBER';
  reportSubType: 'SUMMARY' | 'DETAILED' | 'SUMMARY_BY_SKU';
  dateType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  date: string; // Format: YYYY-MM-DD
}

export interface RevenueMetrics {
  totalRevenue: number;
  totalUnits: number;
  byProduct: Array<{
    sku: string;
    title: string;
    revenue: number;
    units: number;
  }>;
  byCountry: Array<{
    country: string;
    revenue: number;
    units: number;
  }>;
  subscriptions?: {
    activeCount: number;
    newCount: number;
    cancelledCount: number;
    mrr: number;
    arr: number;
  };
}

export class FinanceService {
  constructor(
    private client: AppStoreClient,
    private vendorNumber?: string
  ) {}

  /**
   * Get sales report for a specific date
   */
  async getSalesReport(options: Partial<FinanceReportRequest>): Promise<any> {
    if (!this.vendorNumber && !options.vendorNumber) {
      throw new Error('Vendor number required for financial reports. Set APP_STORE_VENDOR_NUMBER');
    }

    const params: any = {
      'filter[vendorNumber]': options.vendorNumber || this.vendorNumber,
      'filter[reportType]': options.reportType || 'SALES',
      'filter[reportSubType]': options.reportSubType || 'SUMMARY',
      'filter[frequency]': options.dateType || 'DAILY',
      'filter[reportDate]': options.date || this.getYesterdayDate(),
      'filter[version]': '1_1' // Latest version for sales reports per Apple
    };

    const response = await this.client.request('/salesReports', params);
    return response;
  }

  /**
   * Get financial reports (more detailed than sales)
   */
  async getFinancialReport(year: number, month: number): Promise<any> {
    if (!this.vendorNumber) {
      throw new Error('Vendor number required for financial reports');
    }

    const params: any = {
      'filter[vendorNumber]': this.vendorNumber,
      'filter[regionCode]': 'ZZ', // All regions
      'filter[reportType]': 'FINANCIAL',
      'filter[fiscalYear]': year,
      'filter[fiscalPeriod]': month,
      'filter[version]': '1_0' // Required version for financial reports
    };

    const response = await this.client.request('/financeReports', params);
    return response;
  }

  /**
   * Calculate MRR and ARR from current data
   */
  async getRevenueMetrics(appId?: string): Promise<RevenueMetrics> {
    
    // This would need to aggregate data from multiple reports
    // For now, returning a structure that can be filled
    
    const salesData = await this.getSalesReport({
      reportType: 'SUBSCRIPTION',
      reportSubType: 'SUMMARY',
      dateType: 'MONTHLY',
      date: this.getCurrentMonthDate()
    });

    // Parse and calculate metrics
    // This is where we'd process the actual report data
    
    return {
      totalRevenue: 0, // Calculate from sales data
      totalUnits: 0,
      byProduct: [],
      byCountry: [],
      subscriptions: {
        activeCount: 0,
        newCount: 0,
        cancelledCount: 0,
        mrr: 0,
        arr: 0
      }
    };
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(): Promise<any> {
    if (!this.vendorNumber) {
      throw new Error('Vendor number required for subscription reports');
    }

    const params: any = {
      'filter[vendorNumber]': this.vendorNumber,
      'filter[reportType]': 'SUBSCRIPTION',
      'filter[reportSubType]': 'SUMMARY',
      'filter[frequency]': 'DAILY',
      'filter[reportDate]': this.getYesterdayDate(),
      'filter[version]': '1_3' // Version for subscription reports
    };

    const response = await this.client.request('/salesReports', params);
    
    // Format for AI consumption
    return this.formatSubscriptionData(response);
  }

  /**
   * Format subscription data for AI
   */
  private formatSubscriptionData(rawData: any): any {
    // Parse the raw CSV or JSON data from Apple
    // Return formatted metrics
    
    return {
      summary: 'Subscription metrics retrieved',
      metrics: {
        // This would be populated from actual data
        activeSubscribers: 0,
        mrr: 0,
        arr: 0,
        churnRate: 0,
        avgSubscriptionLength: 0
      },
      rawData: rawData
    };
  }

  /**
   * Helper to get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper to get current month in YYYY-MM format
   */
  private getCurrentMonthDate(): string {
    const date = new Date();
    return date.toISOString().slice(0, 7);
  }
}