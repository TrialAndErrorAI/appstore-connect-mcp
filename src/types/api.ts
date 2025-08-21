/**
 * App Store Connect API type definitions
 */

// Base response structure
export interface PagedResponse<T> {
  data: T[];
  links?: {
    self?: string;
    next?: string;
    first?: string;
  };
  meta?: {
    paging?: {
      total?: number;
      limit?: number;
    };
  };
}

// App types
export interface App {
  type: 'apps';
  id: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
    isOrEverWasMadeForKids: boolean;
    subscriptionStatusUrl?: string;
    subscriptionStatusUrlVersion?: string;
    subscriptionStatusUrlForSandbox?: string;
    subscriptionStatusUrlVersionForSandbox?: string;
    contentRightsDeclaration?: string;
  };
  relationships?: {
    appInfos?: Relationship;
    appStoreVersions?: Relationship;
    preReleaseVersions?: Relationship;
    betaGroups?: Relationship;
    builds?: Relationship;
    betaTesters?: Relationship;
  };
}

export interface Relationship {
  links?: {
    self?: string;
    related?: string;
  };
  data?: {
    type: string;
    id: string;
  }[] | {
    type: string;
    id: string;
  };
}

// Sales Report types
export interface SalesReport {
  reportType: string;
  reportSubType: string;
  reportDate: string;
  vendor: string;
  data: SalesReportRow[];
}

export interface SalesReportRow {
  provider: string;
  providerCountry: string;
  sku: string;
  developer: string;
  title: string;
  version: string;
  productTypeIdentifier: string;
  units: number;
  developerProceeds: number;
  beginDate: string;
  endDate: string;
  customerCurrency: string;
  countryCode: string;
  currency: string;
  appleIdentifier: string;
  customerPrice: number;
  promoCode?: string;
  parentIdentifier?: string;
  subscription?: string;
  period?: string;
}

// Analytics types
export interface AnalyticsReport {
  reportType: 'APP_USAGE' | 'APP_STORE_ENGAGEMENT' | 'COMMERCE' | 'PERFORMANCE';
  date: string;
  name: string;
  category: string;
  data: any; // Varies by report type
}

// Beta Tester types
export interface BetaTester {
  type: 'betaTesters';
  id: string;
  attributes: {
    firstName?: string;
    lastName?: string;
    email?: string;
    inviteType: 'EMAIL' | 'PUBLIC_LINK';
    state: 'INVITED' | 'ACCEPTED' | 'INSTALLED' | 'SESSION_STARTED';
  };
}

// Error response
export interface AppStoreError {
  errors: Array<{
    id?: string;
    status: string;
    code: string;
    title: string;
    detail?: string;
    source?: {
      parameter?: string;
      pointer?: string;
    };
  }>;
}