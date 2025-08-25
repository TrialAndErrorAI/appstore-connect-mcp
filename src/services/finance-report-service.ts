/**
 * Service for handling Apple Finance Reports
 * These reports contain COMPLETE revenue including renewals
 */

import { AppStoreClient } from '../api/client.js';
import { gunzipSync } from 'zlib';

interface FinanceReportParams {
  reportType: 'FINANCIAL' | 'FINANCE_DETAIL';
  regionCode: string;  // 'US', 'Z1' (all regions), etc
  fiscalPeriod: string; // '2025-10' for July 2025 (Apple fiscal calendar)
  vendorNumber?: string;
}

interface ParsedFinanceReport {
  headers: string[];
  rows: any[];
  totalRevenue: number;
  rowCount: number;
  metadata: {
    reportType: string;
    regionCode: string;
    fiscalPeriod: string;
  };
}

export class FinanceReportService {
  constructor(
    private client: AppStoreClient,
    private vendorNumber: string
  ) {}

  /**
   * Get financial report (aggregated monthly data)
   */
  async getFinancialReport(params: {
    fiscalPeriod: string;  // e.g., '2025-10' for July 2025
    regionCode?: string;   // Default to 'US'
  }): Promise<ParsedFinanceReport> {
    const reportParams = {
      'filter[reportType]': 'FINANCIAL',
      'filter[regionCode]': params.regionCode || 'US',
      'filter[reportDate]': params.fiscalPeriod,
      'filter[vendorNumber]': this.vendorNumber
    };

    const response = await this.client.request('/financeReports', reportParams);
    
    return this.parseFinanceReport(response, {
      reportType: 'FINANCIAL',
      regionCode: params.regionCode || 'US',
      fiscalPeriod: params.fiscalPeriod
    });
  }

  /**
   * Get detailed finance report (transaction-level data)
   */
  async getFinanceDetailReport(params: {
    fiscalPeriod: string;  // e.g., '2025-10' for July 2025
    regionCode?: string;   // Default to 'Z1' (all regions)
  }): Promise<ParsedFinanceReport> {
    const reportParams = {
      'filter[reportType]': 'FINANCE_DETAIL',
      'filter[regionCode]': params.regionCode || 'Z1',
      'filter[reportDate]': params.fiscalPeriod,
      'filter[vendorNumber]': this.vendorNumber
    };

    const response = await this.client.request('/financeReports', reportParams);
    
    return this.parseFinanceReport(response, {
      reportType: 'FINANCE_DETAIL',
      regionCode: params.regionCode || 'Z1',
      fiscalPeriod: params.fiscalPeriod
    });
  }

  /**
   * Parse finance report response
   */
  private parseFinanceReport(data: any, metadata: any): ParsedFinanceReport {
    // Decompress if gzipped
    let content: string;
    if (Buffer.isBuffer(data)) {
      if (data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        content = gunzipSync(data).toString('utf-8');
      } else {
        content = data.toString('utf-8');
      }
    } else {
      content = typeof data === 'string' ? data : JSON.stringify(data);
    }

    // Parse TSV content
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRevenue: 0,
        rowCount: 0,
        metadata
      };
    }

    // Parse headers
    const headers = lines[0].split('\t').map(h => h.trim());
    
    // Parse data rows
    const rows: any[] = [];
    let totalRevenue = 0;
    
    // Find key column indices
    const quantityIdx = headers.findIndex(h => 
      h.toLowerCase().includes('quantity') || h === 'Units'
    );
    const extendedShareIdx = headers.findIndex(h => 
      h === 'Extended Partner Share' || h.includes('Extended')
    );
    const partnerShareIdx = headers.findIndex(h => 
      h === 'Partner Share' || h.includes('Partner Share')
    );
    const salesReturnIdx = headers.findIndex(h => 
      h === 'Sales or Return' || h.includes('Sales')
    );
    const currencyIdx = headers.findIndex(h =>
      h === 'Partner Share Currency' || h.includes('Currency')
    );
    
    // Determine which column has the revenue
    const revenueIdx = extendedShareIdx >= 0 ? extendedShareIdx : partnerShareIdx;
    
    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ? values[idx].trim() : '';
      });
      
      // Calculate revenue
      if (revenueIdx >= 0) {
        const revenueValue = parseFloat(values[revenueIdx] || '0');
        
        // Check if it's a sale or return
        if (salesReturnIdx >= 0) {
          const salesOrReturn = values[salesReturnIdx];
          if (salesOrReturn === 'S') {
            totalRevenue += revenueValue;
          } else if (salesOrReturn === 'R') {
            totalRevenue -= revenueValue; // Returns reduce revenue
          }
        } else {
          totalRevenue += revenueValue;
        }
        
        row._revenue = revenueValue;
      }
      
      rows.push(row);
    }
    
    return {
      headers,
      rows,
      totalRevenue,
      rowCount: rows.length,
      metadata
    };
  }

  /**
   * Get monthly revenue summary - aggregates ALL regions
   */
  async getMonthlySummary(year: number, month: number): Promise<{
    totalRevenue: number;
    byProduct: Map<string, number>;
    byRegion: Map<string, number>;
    salesVsReturns: { sales: number; returns: number };
    metadata: {
      fiscalPeriod: string;
      month: string;
      year: number;
      isLatestAvailable: boolean;
    };
  }> {
    const fiscalPeriod = this.getFiscalPeriod(year, month);
    
    // FINANCIAL reports require aggregating specific regions
    // Z1 doesn't work, must fetch each region separately
    const regions = [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
      { code: 'EU', name: 'Europe' },
      { code: 'JP', name: 'Japan' },
      { code: 'AU', name: 'Australia' },
      { code: 'WW', name: 'Rest of World' }
    ];
    
    let totalRevenue = 0;
    const byProduct = new Map<string, number>();
    const byRegion = new Map<string, number>();
    let salesRevenue = 0;
    let returnsRevenue = 0;
    let hasData = false;
    
    // Fetch and aggregate all regions
    for (const { code, name } of regions) {
      try {
        const report = await this.getFinancialReport({
          fiscalPeriod,
          regionCode: code
        });
        
        if (report.totalRevenue > 0) {
          hasData = true;
          totalRevenue += report.totalRevenue;
          byRegion.set(name, report.totalRevenue);
          
          // Aggregate product data
          report.rows.forEach(row => {
            const productIdx = report.headers.findIndex(h => 
              h === 'Vendor Identifier' || h === 'SKU'
            );
            const salesReturnIdx = report.headers.findIndex(h =>
              h === 'Sales or Return'
            );
            
            if (productIdx >= 0) {
              const product = row[report.headers[productIdx]] || 'Unknown';
              const revenue = row._revenue || 0;
              byProduct.set(product, (byProduct.get(product) || 0) + revenue);
              
              if (salesReturnIdx >= 0) {
                const salesOrReturn = row[report.headers[salesReturnIdx]];
                if (salesOrReturn === 'S') {
                  salesRevenue += revenue;
                } else if (salesOrReturn === 'R') {
                  returnsRevenue += Math.abs(revenue);
                }
              }
            }
          });
        }
      } catch (error: any) {
        // 404 is expected for regions without data
        if (!error.message.includes('404')) {
          console.error(`Error fetching ${name} data:`, error.message);
        }
      }
    }
    
    // Check if this is the latest available month
    const isLatestAvailable = await this.isLatestAvailableMonth(fiscalPeriod);
    
    return {
      totalRevenue,
      byProduct,
      byRegion,
      salesVsReturns: { sales: salesRevenue, returns: returnsRevenue },
      metadata: {
        fiscalPeriod,
        month: `${year}-${String(month).padStart(2, '0')}`,
        year,
        isLatestAvailable
      }
    };
  }
  
  /**
   * Get the latest available financial report
   */
  async getLatestAvailable(): Promise<{
    totalRevenue: number;
    byRegion: Map<string, number>;
    metadata: {
      fiscalPeriod: string;
      month: string;
    };
  }> {
    // Try last 3 months to find latest available
    const now = new Date();
    
    for (let i = 0; i < 3; i++) {
      const testDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = testDate.getFullYear();
      const month = testDate.getMonth() + 1;
      const fiscalPeriod = this.getFiscalPeriod(year, month);
      
      try {
        // Test with US region first (most likely to have data)
        await this.getFinancialReport({
          fiscalPeriod,
          regionCode: 'US'
        });
        
        // If successful, get full summary
        const summary = await this.getMonthlySummary(year, month);
        
        if (summary.totalRevenue > 0) {
          return {
            totalRevenue: summary.totalRevenue,
            byRegion: summary.byRegion,
            metadata: {
              fiscalPeriod,
              month: `${year}-${String(month).padStart(2, '0')}`
            }
          };
        }
      } catch (error) {
        // Continue to next month
      }
    }
    
    throw new Error('No financial reports available in the last 3 months');
  }
  
  /**
   * Check if a fiscal period is the latest available
   */
  private async isLatestAvailableMonth(fiscalPeriod: string): Promise<boolean> {
    // Parse fiscal period (e.g., "2025-10" -> year 2025, fiscal month 10)
    const [fiscalYear, fiscalMonth] = fiscalPeriod.split('-').map(Number);
    
    // Try next fiscal period
    const nextFiscalMonth = fiscalMonth === 12 ? 1 : fiscalMonth + 1;
    const nextFiscalYear = fiscalMonth === 12 ? fiscalYear + 1 : fiscalYear;
    const nextPeriod = `${nextFiscalYear}-${String(nextFiscalMonth).padStart(2, '0')}`;
    
    try {
      // Check if next month is available
      await this.getFinancialReport({
        fiscalPeriod: nextPeriod,
        regionCode: 'US'
      });
      return false; // Next month exists, so this isn't latest
    } catch (error) {
      return true; // Next month doesn't exist, so this is latest
    }
  }

  /**
   * Convert regular calendar month/year to Apple fiscal period
   */
  private getFiscalPeriod(year: number, month: number): string {
    // Apple fiscal year starts in October
    // Oct=1, Nov=2, Dec=3, Jan=4, Feb=5, Mar=6, Apr=7, May=8, Jun=9, Jul=10, Aug=11, Sep=12
    const fiscalMonthMap: { [key: number]: number } = {
      10: 1,  // October
      11: 2,  // November
      12: 3,  // December
      1: 4,   // January
      2: 5,   // February
      3: 6,   // March
      4: 7,   // April
      5: 8,   // May
      6: 9,   // June
      7: 10,  // July
      8: 11,  // August
      9: 12   // September
    };
    
    const fiscalMonth = fiscalMonthMap[month];
    const fiscalYear = month >= 10 ? year + 1 : year;
    
    return `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}`;
  }
}