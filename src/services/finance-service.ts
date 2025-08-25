import { AppStoreClient } from '../api/client.js';
import { gunzipSync } from 'zlib';

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
    
    // Apple returns gzipped CSV data, need to decompress
    const decompressed = this.decompressIfNeeded(response);
    return this.parseCSVReport(decompressed, options.reportType || 'SALES');
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
      'filter[fiscalPeriod]': String(month).padStart(2, '0'),
      'filter[version]': '1_0' // Required version for financial reports
    };

    const response = await this.client.request('/financeReports', params);
    
    // Decompress and parse the financial report
    const decompressed = this.decompressIfNeeded(response);
    return this.parseCSVReport(decompressed, 'FINANCIAL');
  }

  /**
   * Calculate MRR and ARR from current data
   */
  async getRevenueMetrics(appId?: string): Promise<RevenueMetrics> {
    try {
      // Get subscription report for MRR/ARR calculation
      const salesData = await this.getSalesReport({
        reportType: 'SUBSCRIPTION',
        reportSubType: 'SUMMARY',
        dateType: 'MONTHLY',
        date: this.getCurrentMonthDate()
      });

      // Calculate metrics from parsed data
      return this.calculateRevenueMetricsFromData(salesData);
    } catch (error) {
      // If subscription report fails, try regular sales report
      const salesData = await this.getSalesReport({
        reportType: 'SALES',
        reportSubType: 'SUMMARY',
        dateType: 'MONTHLY',
        date: this.getCurrentMonthDate()
      });
      
      return this.calculateRevenueMetricsFromData(salesData);
    }
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(): Promise<any> {
    if (!this.vendorNumber) {
      throw new Error('Vendor number required for subscription reports');
    }

    // Try different parameter combinations until one works
    const parameterSets = [
      // Try version 1_2 first (might work better)
      {
        'filter[vendorNumber]': this.vendorNumber,
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[reportSubType]': 'SUMMARY',
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': this.getYesterdayDate(),
        'filter[version]': '1_2'
      },
      // Try without version (let API choose)
      {
        'filter[vendorNumber]': this.vendorNumber,
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[reportSubType]': 'SUMMARY',
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': this.getYesterdayDate()
      },
      // Try DETAILED subtype
      {
        'filter[vendorNumber]': this.vendorNumber,
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[reportSubType]': 'DETAILED',
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': this.getYesterdayDate(),
        'filter[version]': '1_3'
      },
      // Original failing params (kept as fallback)
      {
        'filter[vendorNumber]': this.vendorNumber,
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[reportSubType]': 'SUMMARY',
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': this.getYesterdayDate(),
        'filter[version]': '1_3'
      }
    ];

    let lastError: any = null;
    
    // Try each parameter set until one works
    for (const params of parameterSets) {
      try {
        const response = await this.client.request('/salesReports', params);
        
        // If we get here, request succeeded
        const decompressed = this.decompressIfNeeded(response);
        const parsedData = this.parseCSVReport(decompressed, 'SUBSCRIPTION');
        
        // Format for AI consumption
        return this.formatSubscriptionData(parsedData);
      } catch (error: any) {
        lastError = error;
        // Continue to next parameter set
      }
    }
    
    // If all parameter sets failed, throw the last error
    throw lastError || new Error('Failed to fetch subscription metrics');
  }

  /**
   * Detect if response is gzipped and decompress if needed
   */
  private decompressIfNeeded(data: any): string {
    // Handle Buffer (from arraybuffer response)
    if (Buffer.isBuffer(data)) {
      // Check for gzip magic bytes
      if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        try {
          const decompressed = gunzipSync(data);
          return decompressed.toString('utf-8');
        } catch (error) {
          // If decompression fails, return as string
          return data.toString('utf-8');
        }
      }
      // Not gzipped, convert to string
      return data.toString('utf-8');
    }
    
    // Handle string data (legacy path)
    if (typeof data === 'string') {
      // Check for gzip magic bytes in string
      const firstChar = data.charCodeAt(0);
      const secondChar = data.charCodeAt(1);
      
      if (firstChar === 0x1f && secondChar === 0x8b) {
        try {
          const buffer = Buffer.from(data, 'binary');
          const decompressed = gunzipSync(buffer);
          return decompressed.toString('utf-8');
        } catch (error) {
          return data;
        }
      }
      return data;
    }
    
    // Return JSON stringified for other types
    return JSON.stringify(data);
  }

  /**
   * Parse CSV report data
   */
  private parseCSVReport(csvData: string, reportType: string): any {
    if (!csvData || csvData.length === 0) {
      return { rows: [], summary: 'No data available' };
    }

    // Split CSV into lines
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { rows: [], summary: 'Empty report' };
    }

    // Parse header
    const headers = lines[0].split('\t').map(h => h.trim());
    
    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });
      
      rows.push(row);
    }

    // Add currency info to rows if available
    const enhancedRows = rows.map(row => {
      const customerCurrency = row['Customer Currency'] || 'USD';
      const proceedsRaw = parseFloat(row['Developer Proceeds'] || row['Proceeds'] || '0');
      const customerPrice = parseFloat(row['Customer Price'] || '0');
      
      // CRITICAL FIX: Developer Proceeds currency varies by region!
      // For certain currencies (IDR, VND, TZS), Developer Proceeds is in local currency
      // For others (USD, EUR, etc), it may already be converted
      // We need to check the magnitude to determine if conversion is needed
      
      let proceedsUSD = proceedsRaw;
      
      // High-value currency detection: If proceeds value is suspiciously high for the currency,
      // it's likely in local currency and needs conversion
      const highValueCurrencies = ['IDR', 'VND', 'TZS', 'KRW', 'CLP', 'COP'];
      
      if (highValueCurrencies.includes(customerCurrency)) {
        // These currencies have very high exchange rates
        // If proceeds > 1000, it's likely in local currency
        if (proceedsRaw > 1000) {
          proceedsUSD = this.convertToUSD(proceedsRaw, customerCurrency);
        }
      } else if (customerCurrency !== 'USD') {
        // For other non-USD currencies, check if the value seems reasonable
        // If proceeds is much higher than customer price, it might need conversion
        if (proceedsRaw > customerPrice * 2) {
          // Likely already in USD, no conversion needed
          proceedsUSD = proceedsRaw;
        } else {
          // Might be in local currency, convert it
          proceedsUSD = this.convertToUSD(proceedsRaw, customerCurrency);
        }
      }
      
      return {
        ...row,
        _customerCurrency: customerCurrency,
        _customerPrice: customerPrice,
        _proceedsRaw: proceedsRaw,
        _proceedsUSD: proceedsUSD
      };
    });
    
    return {
      reportType,
      headers,
      rows: enhancedRows,
      rowCount: rows.length,
      summary: `Parsed ${rows.length} rows from ${reportType} report`
    };
  }

  /**
   * Currency conversion rates (approximate)
   */
  private readonly currencyRates: Record<string, number> = {
    USD: 1,
    EUR: 1.1,
    GBP: 1.27,
    CAD: 0.74,
    AUD: 0.65,
    MXN: 0.059,
    BRL: 0.20,
    IDR: 0.000065,  // Indonesian Rupiah
    INR: 0.012,     // Indian Rupee
    JPY: 0.0067,    // Japanese Yen
    KRW: 0.00075,   // Korean Won
    CNY: 0.14,      // Chinese Yuan
    THB: 0.028,     // Thai Baht
    PHP: 0.018,     // Philippine Peso
    VND: 0.000041,  // Vietnamese Dong
    MYR: 0.21,      // Malaysian Ringgit
    SGD: 0.74,      // Singapore Dollar
    HKD: 0.13,      // Hong Kong Dollar
    TWD: 0.031,     // Taiwan Dollar
    NZD: 0.61,      // New Zealand Dollar
    CHF: 1.13,      // Swiss Franc
    SEK: 0.095,     // Swedish Krona
    NOK: 0.093,     // Norwegian Krone
    DKK: 0.15,      // Danish Krone
    PLN: 0.25,      // Polish Zloty
    RUB: 0.011,     // Russian Ruble
    TRY: 0.03,      // Turkish Lira
    TZS: 0.00039,   // Tanzanian Shilling
    AED: 0.27,      // UAE Dirham
    SAR: 0.27,      // Saudi Riyal
    ZAR: 0.053,     // South African Rand
    ILS: 0.27,      // Israeli Shekel
    EGP: 0.021,     // Egyptian Pound
    NGN: 0.00065,   // Nigerian Naira
    KES: 0.0078,    // Kenyan Shilling
    PEN: 0.27,      // Peruvian Sol
    COP: 0.00024,   // Colombian Peso
    CLP: 0.0011,    // Chilean Peso
    ARS: 0.001,     // Argentine Peso
    RON: 0.22,      // Romanian Leu (was missing!)
  };

  /**
   * Convert amount from currency to USD
   */
  private convertToUSD(amount: number, currency: string): number {
    const rate = this.currencyRates[currency?.toUpperCase()] || 1;
    return amount * rate;
  }

  /**
   * Calculate revenue metrics from parsed data
   */
  private calculateRevenueMetricsFromData(parsedData: any): RevenueMetrics {
    const metrics: RevenueMetrics = {
      totalRevenue: 0,
      totalUnits: 0,
      byProduct: [],
      byCountry: [],
      subscriptions: undefined
    };

    if (!parsedData.rows || parsedData.rows.length === 0) {
      return metrics;
    }

    // Aggregate metrics from rows
    const productMap = new Map<string, { revenue: number; units: number; title: string }>();
    const countryMap = new Map<string, { revenue: number; units: number }>();
    
    let activeSubscribers = 0;
    let newSubscribers = 0;
    
    for (const row of parsedData.rows) {
      // Common fields across report types
      // Use the pre-converted USD value from parseCSVReport
      const revenue = row._proceedsUSD || parseFloat(row['Developer Proceeds'] || row['Proceeds'] || '0');
      
      const units = parseInt(row['Units'] || row['Unit Sales'] || '0', 10);
      const product = row['SKU'] || row['Product'] || 'Unknown';
      const title = row['Title'] || row['Product Title'] || product;
      const country = row['Country Code'] || row['Territory'] || 'Unknown';
      
      // Subscription specific fields
      if (row['Active Standard Price Subscriptions']) {
        activeSubscribers += parseInt(row['Active Standard Price Subscriptions'], 10) || 0;
      }
      if (row['New Standard Price Subscriptions']) {
        newSubscribers += parseInt(row['New Standard Price Subscriptions'], 10) || 0;
      }

      // Only add if revenue is positive and reasonable (filter out bad conversions)
      if (revenue > 0 && revenue < 1000000) {  // Sanity check: single transaction shouldn't be > $1M
        metrics.totalRevenue += revenue;
        metrics.totalUnits += units;
      }

      // Aggregate by product
      if (!productMap.has(product)) {
        productMap.set(product, { revenue: 0, units: 0, title });
      }
      const productData = productMap.get(product)!;
      productData.revenue += revenue;
      productData.units += units;

      // Aggregate by country
      if (!countryMap.has(country)) {
        countryMap.set(country, { revenue: 0, units: 0 });
      }
      const countryData = countryMap.get(country)!;
      countryData.revenue += revenue;
      countryData.units += units;
    }

    // Convert maps to arrays
    metrics.byProduct = Array.from(productMap.entries())
      .map(([sku, data]) => ({ sku, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 products

    metrics.byCountry = Array.from(countryMap.entries())
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 countries

    // Calculate subscription metrics if available
    if (parsedData.reportType === 'SUBSCRIPTION' || activeSubscribers > 0) {
      const mrr = metrics.totalRevenue; // Monthly recurring revenue
      metrics.subscriptions = {
        activeCount: activeSubscribers,
        newCount: newSubscribers,
        cancelledCount: 0, // Would need cancellation report
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100 // Annual recurring revenue
      };
    }

    return metrics;
  }

  /**
   * Format subscription data for AI
   */
  /**
   * Get aggregated monthly revenue by summing all daily reports
   */
  async getMonthlyRevenue(year: number, month: number): Promise<any> {
    if (!this.vendorNumber) {
      throw new Error('Vendor number required for revenue reports');
    }

    const monthlyData = {
      year,
      month,
      monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
      totalRevenue: 0,
      totalTransactions: 0,
      daysWithData: 0,
      dailyRevenues: [] as number[],
      countryBreakdown: new Map<string, number>(),
      productBreakdown: new Map<string, number>(),
      currencyBreakdown: new Map<string, number>(),
      highRevenueDays: [] as any[]
    };

    // Get all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dates.push(dateStr);
    }

    // Process each day
    for (const dateStr of dates) {
      try {
        const report = await this.getSalesReport({
          reportType: 'SALES',
          dateType: 'DAILY',
          date: dateStr
        });
        
        if (report.rows && report.rows.length > 0) {
          monthlyData.daysWithData++;
          monthlyData.totalTransactions += report.rows.length;
          
          let dailyTotal = 0;
          
          report.rows.forEach((row: any) => {
            // Use pre-converted USD value
            const revenue = row._proceedsUSD || 0;
            const country = row['Country Code'] || 'Unknown';
            const product = row['Title'] || row['Product Title'] || 'Unknown';
            const currency = row['Customer Currency'] || 'USD';
            
            dailyTotal += revenue;
            
            // Track by country
            const currentCountry = monthlyData.countryBreakdown.get(country) || 0;
            monthlyData.countryBreakdown.set(country, currentCountry + revenue);
            
            // Track by product
            const currentProduct = monthlyData.productBreakdown.get(product) || 0;
            monthlyData.productBreakdown.set(product, currentProduct + revenue);
            
            // Track by currency
            const currentCurrency = monthlyData.currencyBreakdown.get(currency) || 0;
            monthlyData.currencyBreakdown.set(currency, currentCurrency + revenue);
          });
          
          monthlyData.totalRevenue += dailyTotal;
          monthlyData.dailyRevenues.push(dailyTotal);
          
          // Track high revenue days (>$10K)
          if (dailyTotal > 10000) {
            monthlyData.highRevenueDays.push({
              date: dateStr,
              revenue: dailyTotal,
              transactions: report.rows.length
            });
          }
        }
      } catch (error: any) {
        // 404 is expected for days with no data
        if (!error.message.includes('404')) {
          console.error(`Error fetching data for ${dateStr}:`, error.message);
        }
      }
    }

    // Calculate statistics
    const stats: any = {
      ...monthlyData,
      dailyAverage: monthlyData.daysWithData > 0 ? monthlyData.totalRevenue / monthlyData.daysWithData : 0,
      perTransaction: monthlyData.totalTransactions > 0 ? monthlyData.totalRevenue / monthlyData.totalTransactions : 0
    };

    if (monthlyData.dailyRevenues.length > 0) {
      const sorted = [...monthlyData.dailyRevenues].sort((a, b) => a - b);
      stats.dailyMin = Math.min(...monthlyData.dailyRevenues);
      stats.dailyMax = Math.max(...monthlyData.dailyRevenues);
      stats.dailyMedian = sorted[Math.floor(sorted.length / 2)];
    }

    // Convert maps to sorted arrays for response
    stats.topCountries = Array.from(monthlyData.countryBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, revenue]) => ({
        country,
        revenue,
        percentage: (revenue / monthlyData.totalRevenue * 100).toFixed(1)
      }));

    stats.topProducts = Array.from(monthlyData.productBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([product, revenue]) => ({
        product,
        revenue,
        percentage: (revenue / monthlyData.totalRevenue * 100).toFixed(1)
      }));

    stats.currencyBreakdown = Array.from(monthlyData.currencyBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([currency, revenue]) => ({
        currency,
        revenue,
        percentage: (revenue / monthlyData.totalRevenue * 100).toFixed(1)
      }));

    // Sort high revenue days
    stats.highRevenueDays = monthlyData.highRevenueDays
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Clean up internal tracking
    delete stats.countryBreakdown;
    delete stats.productBreakdown;
    delete stats.dailyRevenues;

    return stats;
  }

  private formatSubscriptionData(parsedData: any): any {
    const metrics = this.calculateRevenueMetricsFromData(parsedData);
    
    return {
      summary: 'Subscription metrics calculated from report data',
      metrics: {
        activeSubscribers: metrics.subscriptions?.activeCount || 0,
        newSubscribers: metrics.subscriptions?.newCount || 0,
        mrr: metrics.subscriptions?.mrr || 0,
        arr: metrics.subscriptions?.arr || 0,
        churnRate: 0, // Would need historical data to calculate
        avgSubscriptionLength: 0, // Would need additional data
        topProducts: metrics.byProduct.slice(0, 5),
        topCountries: metrics.byCountry.slice(0, 5)
      },
      totalRevenue: metrics.totalRevenue,
      totalUnits: metrics.totalUnits
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