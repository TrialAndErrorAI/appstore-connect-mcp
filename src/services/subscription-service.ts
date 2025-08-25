import { AppStoreClient } from '../api/client.js';
import { gunzipSync } from 'zlib';

/**
 * Dedicated service for handling App Store subscription metrics
 * Focuses on renewal tracking and subscription-specific analytics
 */
export class SubscriptionService {
  constructor(
    private client: AppStoreClient,
    private vendorNumber?: string
  ) {}

  /**
   * Get subscription renewal metrics
   * Attempts to access renewal data through various report types
   */
  async getSubscriptionRenewals(date?: string): Promise<any> {
    if (!this.vendorNumber) {
      throw new Error('Vendor number required for subscription reports');
    }

    const targetDate = date || this.getYesterdayDate();
    
    // Try multiple approaches to get renewal data
    const results = {
      date: targetDate,
      renewalData: null as any,
      newSubscriptions: null as any,
      salesData: null as any,
      totalRenewals: 0,
      totalNewSubscriptions: 0,
      estimatedMRR: 0,
      dataSource: 'none'
    };

    // 1. Try SUBSCRIPTION report with different parameters
    const subscriptionParams = [
      { reportType: 'SUBSCRIPTION', reportSubType: 'SUMMARY', version: '1_2' },
      { reportType: 'SUBSCRIPTION', reportSubType: 'DETAILED', version: '1_2' },
      { reportType: 'SUBSCRIPTION_EVENT', reportSubType: 'SUMMARY', version: '1_2' },
      { reportType: 'SUBSCRIBER', reportSubType: 'DETAILED', version: '1_3' }
    ];

    for (const params of subscriptionParams) {
      try {
        const fullParams: any = {
          'filter[vendorNumber]': this.vendorNumber,
          'filter[reportType]': params.reportType,
          'filter[reportSubType]': params.reportSubType,
          'filter[frequency]': 'DAILY',
          'filter[reportDate]': targetDate,
          'filter[version]': params.version
        };

        const response = await this.client.request('/salesReports', fullParams);
        const decompressed = this.decompressIfNeeded(response);
        const parsed = this.parseCSVReport(decompressed, params.reportType);
        
        if (parsed.rows && parsed.rows.length > 0) {
          results.renewalData = this.analyzeSubscriptionData(parsed);
          results.dataSource = params.reportType;
          break;
        }
      } catch (error) {
        // Continue to next attempt
      }
    }

    // 2. Analyze SALES data for subscription patterns
    try {
      const salesParams = {
        'filter[vendorNumber]': this.vendorNumber,
        'filter[reportType]': 'SALES',
        'filter[reportSubType]': 'SUMMARY',
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': targetDate,
        'filter[version]': '1_1'
      };

      const salesResponse = await this.client.request('/salesReports', salesParams);
      const salesDecompressed = this.decompressIfNeeded(salesResponse);
      const salesParsed = this.parseCSVReport(salesDecompressed, 'SALES');
      
      if (salesParsed.rows && salesParsed.rows.length > 0) {
        results.salesData = this.extractSubscriptionFromSales(salesParsed);
        results.totalNewSubscriptions = results.salesData.newSubscriptions || 0;
        
        if (!results.renewalData) {
          results.dataSource = 'SALES_INFERRED';
        }
      }
    } catch (error) {
      // Sales data not available
    }

    // 3. Calculate estimated MRR
    results.estimatedMRR = this.calculateEstimatedMRR(results);

    return results;
  }

  /**
   * Get comprehensive subscription analytics for a month
   */
  async getMonthlySubscriptionAnalytics(year: number, month: number): Promise<any> {
    const analytics = {
      year,
      month,
      monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
      totalNewSubscriptions: 0,
      totalRenewals: 0,
      totalChurn: 0,
      netSubscriberGrowth: 0,
      subscriptionRevenue: 0,
      oneTimeRevenue: 0,
      averageSubscriptionValue: 0,
      subscriptionTypes: new Map<string, number>(),
      geographicDistribution: new Map<string, number>(),
      dailyMetrics: [] as any[]
    };

    // Get all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      try {
        const dailyData = await this.getSubscriptionRenewals(dateStr);
        
        if (dailyData) {
          analytics.totalNewSubscriptions += dailyData.totalNewSubscriptions || 0;
          analytics.totalRenewals += dailyData.totalRenewals || 0;
          
          if (dailyData.salesData) {
            analytics.subscriptionRevenue += dailyData.salesData.subscriptionRevenue || 0;
            analytics.oneTimeRevenue += dailyData.salesData.oneTimeRevenue || 0;
            
            // Track subscription types
            if (dailyData.salesData.subscriptionTypes) {
              for (const [type, count] of Object.entries(dailyData.salesData.subscriptionTypes)) {
                const current = analytics.subscriptionTypes.get(type) || 0;
                analytics.subscriptionTypes.set(type, current + (count as number));
              }
            }
            
            // Track geographic distribution
            if (dailyData.salesData.countries) {
              for (const [country, revenue] of Object.entries(dailyData.salesData.countries)) {
                const current = analytics.geographicDistribution.get(country) || 0;
                analytics.geographicDistribution.set(country, current + (revenue as number));
              }
            }
          }
          
          analytics.dailyMetrics.push({
            date: dateStr,
            newSubscriptions: dailyData.totalNewSubscriptions,
            renewals: dailyData.totalRenewals,
            estimatedMRR: dailyData.estimatedMRR
          });
        }
      } catch (error) {
        // Continue with next day
      }
    }

    // Calculate derived metrics
    analytics.netSubscriberGrowth = analytics.totalNewSubscriptions - analytics.totalChurn;
    
    if (analytics.totalNewSubscriptions > 0) {
      analytics.averageSubscriptionValue = 
        analytics.subscriptionRevenue / analytics.totalNewSubscriptions;
    }

    // Convert maps to sorted arrays
    const sortedTypes = Array.from(analytics.subscriptionTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
    
    const sortedCountries = Array.from(analytics.geographicDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, revenue]) => ({ 
        country, 
        revenue,
        percentage: (revenue / analytics.subscriptionRevenue * 100).toFixed(1)
      }));

    return {
      ...analytics,
      subscriptionTypes: sortedTypes,
      topCountries: sortedCountries,
      summary: {
        totalRevenue: analytics.subscriptionRevenue + analytics.oneTimeRevenue,
        subscriptionPercentage: 
          ((analytics.subscriptionRevenue / (analytics.subscriptionRevenue + analytics.oneTimeRevenue)) * 100).toFixed(1),
        estimatedActiveSubscribers: analytics.totalNewSubscriptions + analytics.totalRenewals - analytics.totalChurn,
        averageSubscriptionValue: analytics.averageSubscriptionValue.toFixed(2)
      }
    };
  }

  /**
   * Analyze subscription data from parsed report
   */
  private analyzeSubscriptionData(parsedData: any): any {
    const analysis = {
      totalSubscribers: 0,
      activeSubscribers: 0,
      newSubscribers: 0,
      canceledSubscribers: 0,
      revenue: 0,
      averagePrice: 0,
      subscriptionsByProduct: new Map<string, number>(),
      subscriptionsByCountry: new Map<string, number>()
    };

    for (const row of parsedData.rows) {
      // Common subscription fields across different report types
      const active = parseInt(row['Active Standard Price Subscriptions'] || '0', 10);
      const newSubs = parseInt(row['New Standard Price Subscriptions'] || '0', 10);
      const canceled = parseInt(row['Canceled Subscriptions'] || '0', 10);
      const revenue = parseFloat(row['Developer Proceeds'] || row['Proceeds'] || '0');
      const product = row['SKU'] || row['Product'] || 'Unknown';
      const country = row['Country Code'] || 'Unknown';

      analysis.activeSubscribers += active;
      analysis.newSubscribers += newSubs;
      analysis.canceledSubscribers += canceled;
      analysis.revenue += revenue;

      if (product !== 'Unknown') {
        const current = analysis.subscriptionsByProduct.get(product) || 0;
        analysis.subscriptionsByProduct.set(product, current + active);
      }

      if (country !== 'Unknown') {
        const current = analysis.subscriptionsByCountry.get(country) || 0;
        analysis.subscriptionsByCountry.set(country, current + active);
      }
    }

    analysis.totalSubscribers = analysis.activeSubscribers;
    
    if (analysis.activeSubscribers > 0) {
      analysis.averagePrice = analysis.revenue / analysis.activeSubscribers;
    }

    return analysis;
  }

  /**
   * Extract subscription information from SALES report
   */
  private extractSubscriptionFromSales(parsedData: any): any {
    const extracted = {
      subscriptionRevenue: 0,
      oneTimeRevenue: 0,
      newSubscriptions: 0,
      subscriptionTypes: {} as Record<string, number>,
      countries: {} as Record<string, number>,
      products: [] as any[]
    };

    for (const row of parsedData.rows) {
      const productType = row['Product Type Identifier'] || '';
      const revenue = row._proceedsUSD || 0;
      const units = parseInt(row['Units'] || '0', 10);
      const product = row['Title'] || row['Product Title'] || 'Unknown';
      const country = row['Country Code'] || 'Unknown';
      const sku = row['SKU'] || '';

      // Identify subscription products
      const isSubscription = 
        productType.includes('Auto-Renewable') ||
        productType.includes('Subscription') ||
        product.toLowerCase().includes('subscription') ||
        product.toLowerCase().includes('monthly') ||
        product.toLowerCase().includes('yearly') ||
        product.toLowerCase().includes('annual');

      if (isSubscription) {
        extracted.subscriptionRevenue += revenue;
        extracted.newSubscriptions += units;
        
        if (!extracted.subscriptionTypes[productType]) {
          extracted.subscriptionTypes[productType] = 0;
        }
        extracted.subscriptionTypes[productType] += units;
      } else {
        extracted.oneTimeRevenue += revenue;
      }

      // Track by country
      if (!extracted.countries[country]) {
        extracted.countries[country] = 0;
      }
      extracted.countries[country] += revenue;

      // Track products
      if (isSubscription && units > 0) {
        extracted.products.push({
          sku,
          product,
          units,
          revenue,
          averagePrice: revenue / units
        });
      }
    }

    // Sort products by revenue
    extracted.products.sort((a, b) => b.revenue - a.revenue);

    return extracted;
  }

  /**
   * Calculate estimated MRR from available data
   */
  private calculateEstimatedMRR(data: any): number {
    let estimatedMRR = 0;

    // If we have renewal data, use it
    if (data.renewalData && data.renewalData.activeSubscribers > 0) {
      estimatedMRR = data.renewalData.activeSubscribers * data.renewalData.averagePrice;
    } 
    // Otherwise, estimate from sales data
    else if (data.salesData) {
      // Assume new subscriptions represent about 10% of total active base
      // This is a rough estimate when renewal data is not available
      const estimatedActiveBase = data.salesData.newSubscriptions * 10;
      const averagePrice = data.salesData.subscriptionRevenue / data.salesData.newSubscriptions;
      estimatedMRR = estimatedActiveBase * averagePrice;
    }

    return estimatedMRR;
  }

  /**
   * Detect if response is gzipped and decompress if needed
   */
  private decompressIfNeeded(data: any): string {
    if (Buffer.isBuffer(data)) {
      if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        try {
          const decompressed = gunzipSync(data);
          return decompressed.toString('utf-8');
        } catch (error) {
          return data.toString('utf-8');
        }
      }
      return data.toString('utf-8');
    }
    
    if (typeof data === 'string') {
      if (data.length > 2 && data.charCodeAt(0) === 0x1f && data.charCodeAt(1) === 0x8b) {
        try {
          const buffer = Buffer.from(data, 'binary');
          const decompressed = gunzipSync(buffer);
          return decompressed.toString('utf-8');
        } catch (error) {
          return data;
        }
      }
    }
    
    return JSON.stringify(data);
  }

  /**
   * Parse CSV report data
   */
  private parseCSVReport(csvData: string, reportType: string): any {
    if (!csvData || csvData.length === 0) {
      return { rows: [], summary: 'No data available' };
    }

    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { rows: [], summary: 'Empty report' };
    }

    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });
      
      // Add USD proceeds (already converted by Apple)
      const proceedsUSD = parseFloat(row['Developer Proceeds'] || row['Proceeds'] || '0');
      row._proceedsUSD = proceedsUSD;
      
      rows.push(row);
    }
    
    return {
      reportType,
      headers,
      rows,
      rowCount: rows.length,
      summary: `Parsed ${rows.length} rows from ${reportType} report`
    };
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}