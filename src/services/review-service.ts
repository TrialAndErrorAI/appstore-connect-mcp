import { AppStoreClient } from '../api/client.js';

export interface CustomerReview {
  id: string;
  rating: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate: string;
  territory?: string;
  appVersionString?: string;
}

export interface ReviewResponse {
  id: string;
  responseBody: string;
  lastModifiedDate: string;
  state: 'PUBLISHED' | 'PENDING_PUBLISH' | 'DRAFT';
}

export interface ReviewMetrics {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
  recentReviews: CustomerReview[];
  topPositiveReviews: CustomerReview[];
  topCriticalReviews: CustomerReview[];
  responseRate: number;
}

export class ReviewService {
  constructor(private client: AppStoreClient) {}

  /**
   * Get customer reviews for an app
   */
  async getCustomerReviews(appId: string, limit: number = 100): Promise<CustomerReview[]> {
    const response = await this.client.request(`/apps/${appId}/customerReviews`, {
      limit,
      sort: '-createdDate'
    });

    if (response.data) {
      return this.formatCustomerReviews(response.data);
    }

    return [];
  }

  /**
   * Get review responses
   */
  async getReviewResponses(appId: string): Promise<ReviewResponse[]> {
    // Get reviews with their responses included
    const response = await this.client.request(`/apps/${appId}/customerReviews`, {
      limit: 100,
      sort: '-createdDate',
      include: 'response'
    });

    if (response.included) {
      return this.formatReviewResponses(response.included.filter(
        (item: any) => item.type === 'customerReviewResponses'
      ));
    }

    return [];
  }

  /**
   * Get comprehensive review metrics
   */
  async getReviewMetrics(appId: string): Promise<ReviewMetrics> {
    const [reviews, responses] = await Promise.all([
      this.getCustomerReviews(appId, 200),
      this.getReviewResponses(appId)
    ]);

    // Calculate rating distribution
    const distribution = {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0
    };

    reviews.forEach(review => {
      switch (review.rating) {
        case 1: distribution.oneStar++; break;
        case 2: distribution.twoStar++; break;
        case 3: distribution.threeStar++; break;
        case 4: distribution.fourStar++; break;
        case 5: distribution.fiveStar++; break;
      }
    });

    const sortedByRating = [...reviews].sort((a, b) => b.rating - a.rating);
    const positiveReviews = sortedByRating.filter(r => r.rating >= 4).slice(0, 5);
    const criticalReviews = sortedByRating.filter(r => r.rating <= 2).slice(0, 5);

    const reviewsWithResponses = responses.filter(r => r.state === 'PUBLISHED').length;
    const responseRate = reviews.length > 0
      ? (reviewsWithResponses / reviews.length) * 100
      : 0;

    return {
      averageRating: this.calculateAverageRating(reviews),
      totalRatings: reviews.length,
      ratingDistribution: distribution,
      recentReviews: reviews.slice(0, 10),
      topPositiveReviews: positiveReviews,
      topCriticalReviews: criticalReviews,
      responseRate: Math.round(responseRate)
    };
  }

  /**
   * Get review sentiment analysis from real review data
   */
  async getReviewSentiment(appId: string): Promise<any> {
    const reviews = await this.getCustomerReviews(appId, 100);

    const sentiments = {
      positive: 0,
      neutral: 0,
      negative: 0,
      topics: new Map<string, number>()
    };

    const topics = ['ui', 'performance', 'feature', 'bug', 'price', 'update', 'design', 'crash', 'slow', 'subscription'];

    reviews.forEach(review => {
      if (review.rating >= 4) sentiments.positive++;
      else if (review.rating === 3) sentiments.neutral++;
      else sentiments.negative++;

      const text = `${review.title || ''} ${review.body || ''}`.toLowerCase();
      topics.forEach(topic => {
        if (text.includes(topic)) {
          sentiments.topics.set(topic, (sentiments.topics.get(topic) || 0) + 1);
        }
      });
    });

    const topTopics = Array.from(sentiments.topics.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: 'Review Sentiment Analysis',
      distribution: {
        positive: sentiments.positive,
        neutral: sentiments.neutral,
        negative: sentiments.negative
      },
      percentages: {
        positive: reviews.length > 0 ? Math.round((sentiments.positive / reviews.length) * 100) : 0,
        neutral: reviews.length > 0 ? Math.round((sentiments.neutral / reviews.length) * 100) : 0,
        negative: reviews.length > 0 ? Math.round((sentiments.negative / reviews.length) * 100) : 0
      },
      topTopics,
      sampleSize: reviews.length
    };
  }

  /**
   * Get comprehensive review summary
   */
  async getReviewSummary(appId: string): Promise<any> {
    const [metrics, sentiment] = await Promise.all([
      this.getReviewMetrics(appId),
      this.getReviewSentiment(appId)
    ]);

    return {
      summary: 'Customer Reviews and Ratings Summary',
      rating: {
        average: metrics.averageRating,
        total: metrics.totalRatings,
        distribution: metrics.ratingDistribution
      },
      sentiment: sentiment.percentages,
      topTopics: sentiment.topTopics,
      highlights: {
        responseRate: `${metrics.responseRate}%`,
        recentReviewsCount: metrics.recentReviews.length
      },
      timestamp: new Date().toISOString()
    };
  }

  private formatCustomerReviews(rawData: any[]): CustomerReview[] {
    return rawData.map(review => ({
      id: review.id,
      rating: review.attributes?.rating || 0,
      title: review.attributes?.title,
      body: review.attributes?.body,
      reviewerNickname: review.attributes?.reviewerNickname || 'Anonymous',
      createdDate: review.attributes?.createdDate || new Date().toISOString(),
      territory: review.attributes?.territory,
      appVersionString: review.attributes?.appVersionString
    }));
  }

  private formatReviewResponses(rawData: any[]): ReviewResponse[] {
    return rawData.map(response => ({
      id: response.id,
      responseBody: response.attributes?.responseBody || '',
      lastModifiedDate: response.attributes?.lastModifiedDate || new Date().toISOString(),
      state: response.attributes?.state || 'DRAFT'
    }));
  }

  private calculateAverageRating(reviews: CustomerReview[]): number {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }
}
