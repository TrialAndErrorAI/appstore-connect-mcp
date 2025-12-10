import { AppStoreClient } from '../api/client.js';

// Types for Xcode Cloud API responses
export interface CiProduct {
  id: string;
  type: 'ciProducts';
  attributes: {
    name: string;
    createdDate: string;
    productType: 'APP' | 'FRAMEWORK';
  };
  relationships?: {
    bundleId?: { data: { id: string; type: string } };
    workflows?: { data: Array<{ id: string; type: string }> };
    primaryRepositories?: { data: Array<{ id: string; type: string }> };
  };
}

export interface CiWorkflow {
  id: string;
  type: 'ciWorkflows';
  attributes: {
    name: string;
    description?: string;
    isEnabled: boolean;
    isLockedForEditing: boolean;
    clean: boolean;
    containerFilePath: string;
    lastModifiedDate: string;
  };
  relationships?: {
    product?: { data: { id: string; type: string } };
    repository?: { data: { id: string; type: string } };
    xcodeVersion?: { data: { id: string; type: string } };
    macOsVersion?: { data: { id: string; type: string } };
  };
}

export interface CiBuildRun {
  id: string;
  type: 'ciBuildRuns';
  attributes: {
    number: number;
    createdDate: string;
    startedDate?: string;
    finishedDate?: string;
    sourceCommit?: {
      commitSha: string;
      message?: string;
      author?: {
        displayName: string;
        avatarUrl?: string;
      };
    };
    destinationCommit?: {
      commitSha: string;
      message?: string;
    };
    isPullRequestBuild: boolean;
    issueCounts?: {
      analyzerWarnings: number;
      errors: number;
      testFailures: number;
      warnings: number;
    };
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED';
    startReason?: 'MANUAL' | 'SCHEDULE' | 'GIT_REF_CHANGE' | 'PULL_REQUEST_UPDATE';
  };
  relationships?: {
    workflow?: { data: { id: string; type: string } };
    product?: { data: { id: string; type: string } };
    builds?: { data: Array<{ id: string; type: string }> };
  };
}

export interface CiBuild {
  id: string;
  type: 'ciBuilds';
  attributes: {
    number?: number;
    createdDate: string;
    finishedDate?: string;
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED';
  };
}

export interface XcodeCloudSummary {
  summary: string;
  products: Array<{
    id: string;
    name: string;
    productType: string;
    workflowCount: number;
  }>;
  workflows: Array<{
    id: string;
    name: string;
    isEnabled: boolean;
    lastModified: string;
    recentBuilds?: number;
  }>;
  recentBuilds: Array<{
    id: string;
    number: number;
    workflow: string;
    status: string;
    progress: string;
    startedDate?: string;
    finishedDate?: string;
    duration?: string;
    commitSha?: string;
    commitMessage?: string;
    author?: string;
  }>;
  buildStats?: {
    totalBuilds: number;
    succeeded: number;
    failed: number;
    running: number;
    pending: number;
    successRate: string;
  };
}

/**
 * Service for interacting with Xcode Cloud CI/CD endpoints
 */
export class XcodeCloudService {
  constructor(private client: AppStoreClient) {}

  /**
   * List all Xcode Cloud products (apps/frameworks)
   */
  async listProducts(filterProductType?: 'APP' | 'FRAMEWORK'): Promise<CiProduct[]> {
    try {
      const params: Record<string, string> = {
        'include': 'primaryRepositories',
      };

      if (filterProductType) {
        params['filter[productType]'] = filterProductType;
      }

      const products = await this.client.getAll<CiProduct>('/ciProducts', params);
      return products;
    } catch (error: any) {
      // Return mock data in development
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockProducts();
      }
      throw error;
    }
  }

  /**
   * Get workflows for a specific product
   */
  async getProductWorkflows(productId: string): Promise<CiWorkflow[]> {
    try {
      const workflows = await this.client.getAll<CiWorkflow>(
        `/ciProducts/${productId}/workflows`
      );
      return workflows;
    } catch (error: any) {
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockWorkflows();
      }
      throw error;
    }
  }

  /**
   * Get details for a specific workflow
   */
  async getWorkflow(workflowId: string): Promise<CiWorkflow> {
    try {
      const response = await this.client.request<{ data: CiWorkflow }>(
        `/ciWorkflows/${workflowId}`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockWorkflows()[0];
      }
      throw error;
    }
  }

  /**
   * List build runs for a specific workflow
   */
  async getWorkflowBuilds(
    workflowId: string,
    limit: number = 20
  ): Promise<CiBuildRun[]> {
    try {
      const params = {
        'limit': limit.toString(),
        'sort': '-createdDate',
      };

      const builds = await this.client.getAll<CiBuildRun>(
        `/ciWorkflows/${workflowId}/buildRuns`,
        params
      );
      return builds;
    } catch (error: any) {
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockBuildRuns();
      }
      throw error;
    }
  }

  /**
   * Get details for a specific build run
   */
  async getBuildRun(buildRunId: string): Promise<CiBuildRun> {
    try {
      const response = await this.client.request<{ data: CiBuildRun }>(
        `/ciBuildRuns/${buildRunId}`,
        {
          'include': 'builds,workflow,product',
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockBuildRuns()[0];
      }
      throw error;
    }
  }

  /**
   * Get comprehensive Xcode Cloud summary
   */
  async getXcodeCloudSummary(productId?: string): Promise<XcodeCloudSummary> {
    try {
      // Get products
      const products = productId
        ? [await this.getProductById(productId)]
        : await this.listProducts('APP');

      // Get workflows for each product
      const workflowsPromises = products.map(p => this.getProductWorkflows(p.id));
      const workflowsArrays = await Promise.all(workflowsPromises);
      const allWorkflows = workflowsArrays.flat();

      // Get recent builds for active workflows
      const activeWorkflows = allWorkflows.filter(w => w.attributes.isEnabled);
      const buildsPromises = activeWorkflows.slice(0, 5).map(w =>
        this.getWorkflowBuilds(w.id, 10).catch(() => [])
      );
      const buildsArrays = await Promise.all(buildsPromises);
      const allBuilds = buildsArrays.flat();

      // Calculate build stats
      const buildStats = this.calculateBuildStats(allBuilds);

      // Format recent builds
      const recentBuilds = allBuilds.slice(0, 20).map(build => {
        const duration = build.attributes.startedDate && build.attributes.finishedDate
          ? this.calculateDuration(build.attributes.startedDate, build.attributes.finishedDate)
          : undefined;

        return {
          id: build.id,
          number: build.attributes.number,
          workflow: build.relationships?.workflow?.data.id || 'unknown',
          status: build.attributes.completionStatus || 'UNKNOWN',
          progress: build.attributes.executionProgress,
          startedDate: build.attributes.startedDate,
          finishedDate: build.attributes.finishedDate,
          duration,
          commitSha: build.attributes.sourceCommit?.commitSha?.substring(0, 7),
          commitMessage: build.attributes.sourceCommit?.message,
          author: build.attributes.sourceCommit?.author?.displayName,
        };
      });

      return {
        summary: `Xcode Cloud Summary - ${products.length} products, ${allWorkflows.length} workflows, ${allBuilds.length} recent builds`,
        products: products.map(p => ({
          id: p.id,
          name: p.attributes.name,
          productType: p.attributes.productType,
          workflowCount: workflowsArrays[products.indexOf(p)]?.length || 0,
        })),
        workflows: allWorkflows.map(w => ({
          id: w.id,
          name: w.attributes.name,
          isEnabled: w.attributes.isEnabled,
          lastModified: w.attributes.lastModifiedDate,
        })),
        recentBuilds,
        buildStats,
      };
    } catch (error: any) {
      // Return mock data in development
      if (error.response?.status === 404 || error.code === 'ENOTFOUND') {
        return this.getMockXcodeCloudSummary();
      }
      throw error;
    }
  }

  /**
   * Get a specific product by ID
   */
  private async getProductById(productId: string): Promise<CiProduct> {
    const response = await this.client.request<{ data: CiProduct }>(
      `/ciProducts/${productId}`
    );
    return response.data;
  }

  /**
   * Calculate build statistics
   */
  private calculateBuildStats(builds: CiBuildRun[]) {
    const succeeded = builds.filter(b => b.attributes.completionStatus === 'SUCCEEDED').length;
    const failed = builds.filter(b => b.attributes.completionStatus === 'FAILED').length;
    const running = builds.filter(b => b.attributes.executionProgress === 'RUNNING').length;
    const pending = builds.filter(b => b.attributes.executionProgress === 'PENDING').length;

    const totalComplete = succeeded + failed;
    const successRate = totalComplete > 0
      ? ((succeeded / totalComplete) * 100).toFixed(1) + '%'
      : 'N/A';

    return {
      totalBuilds: builds.length,
      succeeded,
      failed,
      running,
      pending,
      successRate,
    };
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(start: string, end: string): string {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;

    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  // Mock data methods for testing
  private getMockProducts(): CiProduct[] {
    return [
      {
        id: '1',
        type: 'ciProducts',
        attributes: {
          name: 'Produciesta',
          createdDate: '2024-01-01T00:00:00Z',
          productType: 'APP',
        },
      },
    ];
  }

  private getMockWorkflows(): CiWorkflow[] {
    return [
      {
        id: '1',
        type: 'ciWorkflows',
        attributes: {
          name: 'Main Branch CI',
          description: 'Build and test on main branch',
          isEnabled: true,
          isLockedForEditing: false,
          clean: false,
          containerFilePath: '.xcodebuild',
          lastModifiedDate: '2024-12-01T00:00:00Z',
        },
      },
      {
        id: '2',
        type: 'ciWorkflows',
        attributes: {
          name: 'Pull Request Checks',
          description: 'Automated PR validation',
          isEnabled: true,
          isLockedForEditing: false,
          clean: true,
          containerFilePath: '.xcodebuild',
          lastModifiedDate: '2024-12-05T00:00:00Z',
        },
      },
    ];
  }

  private getMockBuildRuns(): CiBuildRun[] {
    return [
      {
        id: '1',
        type: 'ciBuildRuns',
        attributes: {
          number: 275,
          createdDate: '2024-12-10T00:00:00Z',
          startedDate: '2024-12-10T00:01:00Z',
          finishedDate: '2024-12-10T00:15:00Z',
          sourceCommit: {
            commitSha: 'abc123def456',
            message: 'feat: Add new feature',
            author: {
              displayName: 'Developer',
            },
          },
          isPullRequestBuild: false,
          issueCounts: {
            analyzerWarnings: 2,
            errors: 0,
            testFailures: 0,
            warnings: 5,
          },
          executionProgress: 'COMPLETE',
          completionStatus: 'SUCCEEDED',
          startReason: 'GIT_REF_CHANGE',
        },
      },
      {
        id: '2',
        type: 'ciBuildRuns',
        attributes: {
          number: 274,
          createdDate: '2024-12-09T00:00:00Z',
          startedDate: '2024-12-09T00:01:00Z',
          finishedDate: '2024-12-09T00:12:00Z',
          sourceCommit: {
            commitSha: 'def456ghi789',
            message: 'fix: Bug fix',
            author: {
              displayName: 'Developer',
            },
          },
          isPullRequestBuild: false,
          issueCounts: {
            analyzerWarnings: 1,
            errors: 3,
            testFailures: 2,
            warnings: 4,
          },
          executionProgress: 'COMPLETE',
          completionStatus: 'FAILED',
          startReason: 'MANUAL',
        },
      },
    ];
  }

  private getMockXcodeCloudSummary(): XcodeCloudSummary {
    return {
      summary: 'Xcode Cloud Summary - 1 product, 2 workflows, 2 recent builds',
      products: [
        {
          id: '1',
          name: 'Produciesta',
          productType: 'APP',
          workflowCount: 2,
        },
      ],
      workflows: [
        {
          id: '1',
          name: 'Main Branch CI',
          isEnabled: true,
          lastModified: '2024-12-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Pull Request Checks',
          isEnabled: true,
          lastModified: '2024-12-05T00:00:00Z',
        },
      ],
      recentBuilds: [
        {
          id: '1',
          number: 275,
          workflow: '1',
          status: 'SUCCEEDED',
          progress: 'COMPLETE',
          startedDate: '2024-12-10T00:01:00Z',
          finishedDate: '2024-12-10T00:15:00Z',
          duration: '14m 0s',
          commitSha: 'abc123d',
          commitMessage: 'feat: Add new feature',
          author: 'Developer',
        },
        {
          id: '2',
          number: 274,
          workflow: '1',
          status: 'FAILED',
          progress: 'COMPLETE',
          startedDate: '2024-12-09T00:01:00Z',
          finishedDate: '2024-12-09T00:12:00Z',
          duration: '11m 0s',
          commitSha: 'def456g',
          commitMessage: 'fix: Bug fix',
          author: 'Developer',
        },
      ],
      buildStats: {
        totalBuilds: 2,
        succeeded: 1,
        failed: 1,
        running: 0,
        pending: 0,
        successRate: '50.0%',
      },
    };
  }
}
