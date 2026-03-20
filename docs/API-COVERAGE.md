# App Store Connect API Coverage Map

> **923 endpoints in 191 categories. All accessible through 2 tools (search + execute).**
> Apple's official OpenAPI 3.0.1 spec, API v4.3. Bundled at `src/spec/openapi.json`.

---

## ASO Growth (our core need)

| Group | Endpoints | What It Gives Us |
|-------|-----------|-----------------|
| **App Metadata** | appInfos (19), appInfoLocalizations (2), appStoreVersionLocalizations (8) | Title, subtitle, keywords, description — READ + WRITE |
| **Analytics** | analyticsReportRequests (4), analyticsReports (3), analyticsReportInstances (3) | Impressions, page views, downloads, source attribution |
| **Sales & Finance** | salesReports (1), financeReports (1) | Revenue, units, proceeds by country |
| **Customer Reviews** | customerReviews (3), customerReviewResponses (2) | Ratings, review text, respond to reviews |
| **Versions** | appStoreVersions (26), appStoreVersionPhasedReleases (2) | Version management, phased rollout |
| **Screenshots/Previews** | appScreenshotSets (4), appScreenshots (2), appPreviewSets (4), appPreviews (2) | ASO visuals |
| **A/B Testing** | appStoreVersionExperiments (8), appStoreVersionExperimentTreatments (4) | Product page experiments |
| **Custom Product Pages** | appCustomProductPages (4), appCustomProductPageVersions (4), appCustomProductPageLocalizations (8) | Custom landing pages for ad campaigns |

## Subscription/Revenue Intelligence

| Group | Endpoints | What It Gives Us |
|-------|-----------|-----------------|
| **Subscriptions** | subscriptions (24), subscriptionGroups (6) | Sub management, pricing |
| **IAP** | inAppPurchases (21), inAppPurchaseOfferCodes (8) | IAP + offer codes |
| **Pricing** | appPriceSchedules (8), appPricePoints (3) | Per-territory pricing |
| **Win-back** | winBackOffers (4) | Re-engage churned users |

## App Operations

| Group | Endpoints | What It Gives Us |
|-------|-----------|-----------------|
| **Builds** | builds (25), buildBetaDetails (4) | Build management |
| **TestFlight** | betaGroups (14), betaTesters (9) | Beta testing |
| **Review Submission** | reviewSubmissions (4), appStoreReviewDetails (4) | App review pipeline |
| **Performance** | diagnosticSignatures (1) | Crash data |
| **Xcode Cloud** | ciProducts (12), ciBuildRuns (6), ciWorkflows (6), ciBuildActions (9) | CI/CD pipeline |

## Provisioning & Certificates

| Group | Endpoints | What It Gives Us |
|-------|-----------|-----------------|
| **Bundle IDs** | bundleIds (8), bundleIdCapabilities (2) | App identifiers |
| **Certificates** | certificates (4) | Signing certificates |
| **Profiles** | profiles (8) | Provisioning profiles |
| **Devices** | devices (2) | Registered devices |

## Users & Access

| Group | Endpoints | What It Gives Us |
|-------|-----------|-----------------|
| **Users** | users (4), userInvitations (4) | Team management |
| **Sandbox** | sandboxTesters (2) | Test accounts |

## Skip (not relevant for RenovateAI)

| Group | Endpoints | Why Skip |
|-------|-----------|----------|
| **Game Center** | ~150+ endpoints | Not a game |
| **Alternative Distribution** | ~15 endpoints | EU DMA only |
| **App Clips** | ~20 endpoints | Not using |
| **Marketplace** | ~4 endpoints | Not relevant |

---

## Analytics Report Types (Apple's API)

Apple's Analytics Reports API provides 5 categories:

1. **App Store Engagement**: impressions, product page views, taps, source attribution
2. **App Store Commerce**: purchases, proceeds, paying users, pre-orders
3. **App Usage**: installations, sessions, active devices, crashes, deletions, retention
4. **Frameworks Usage**: API/framework interaction data
5. **Performance**: crash rates, hang rates, disk writes, launch times

Plus legacy **Sales & Trends** reports:
- Summary Sales (daily/weekly/monthly/yearly)
- Subscription (daily)
- Subscription Event (daily)
- Subscriber (daily)
- Subscription Offer Code Redemption (daily)

And **Financial Reports** for final proceeds/accounting.

---

## NOT Available from App Store Connect API

| Data | Where It Lives |
|------|---------------|
| **Keyword rankings** | Third-party (AppTweak, Sensor Tower, DataForSEO, FoxData) |
| **Competitor intelligence** | Third-party scraping |
| **Search volume estimates** | Third-party models |
| **Category rankings** | Public App Store (scrapeable) |
| **Similar apps** | Public App Store |

---

## Competitive Landscape

| Server | Tools | Architecture | Differentiator |
|--------|-------|-------------|----------------|
| **Ours (T&E)** | 3 | Code mode (search + execute) | 923 endpoints, ~1K tokens, zero new tools per endpoint |
| zelentsov-dev/asc-mcp | 208 | Traditional (1 tool per operation) | Most comprehensive, Swift |
| JoshuaRileyDev | ~40 | Traditional | Most popular (305 stars), archived |
| SardorbekR | ~40 | Traditional | Per-territory pricing |
| gjeltep | ~30 | Traditional, spec-driven | Xcode Cloud, Python |

**Our advantage**: They maintain 40-208 tool definitions. We maintain 0. The spec IS the implementation.

---

*"923 endpoints. 2 tools. The agent writes the query."*
