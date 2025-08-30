import { UserFeedback, FeedbackCategory } from '../../types/aiLogging';
import { EnhancedLogStorageService } from '../database/repositories/EnhancedLogStorageService';

/**
 * Service for analyzing user feedback and generating improvement suggestions
 */
export class FeedbackAnalysisService {
  private logStorageService: EnhancedLogStorageService;

  constructor() {
    this.logStorageService = new EnhancedLogStorageService();
  }

  /**
   * Analyze feedback patterns and generate improvement suggestions
   */
  async analyzeFeedbackPatterns(timeRange?: {
    startDate: Date;
    endDate: Date;
  }): Promise<FeedbackAnalysis> {
    try {
      // Get logs with feedback in the specified time range
      const logs = await this.logStorageService.getEnhancedLogs({
        startDate: timeRange?.startDate,
        endDate: timeRange?.endDate,
        limit: 1000,
      });

      // Filter logs that have feedback
      const logsWithFeedback = logs.filter(log => log.userFeedback);

      if (logsWithFeedback.length === 0) {
        return this.createEmptyAnalysis();
      }

      const feedbacks = logsWithFeedback.map(log => log.userFeedback!);

      // Calculate overall metrics
      const overallMetrics = this.calculateOverallMetrics(feedbacks);

      // Analyze category performance
      const categoryAnalysis = this.analyzeCategoryPerformance(feedbacks);

      // Identify trends
      const trends = this.identifyTrends(
        logsWithFeedback.map(log => ({
          userFeedback: log.userFeedback!,
          timestamp: log.createdAt,
        }))
      );

      // Generate improvement suggestions
      const suggestions = this.generateImprovementSuggestions(
        overallMetrics,
        categoryAnalysis,
        trends
      );

      // Analyze common feedback themes
      const commonThemes = this.analyzeCommonThemes(feedbacks);

      return {
        overallMetrics,
        categoryAnalysis,
        trends,
        suggestions,
        commonThemes,
        totalFeedbacks: feedbacks.length,
        timeRange: timeRange || {
          startDate: new Date(
            Math.min(...logsWithFeedback.map(log => log.timestamp.getTime()))
          ),
          endDate: new Date(
            Math.max(...logsWithFeedback.map(log => log.timestamp.getTime()))
          ),
        },
      };
    } catch (error) {
      console.error('Failed to analyze feedback patterns:', error);
      throw new Error(`Feedback analysis failed: ${error}`);
    }
  }

  /**
   * Get feedback summary for a specific time period
   */
  async getFeedbackSummary(days: number = 7): Promise<FeedbackSummary> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const analysis = await this.analyzeFeedbackPatterns({
        startDate,
        endDate,
      });

      return {
        averageRating: analysis.overallMetrics.averageRating,
        totalFeedbacks: analysis.totalFeedbacks,
        satisfactionRate: analysis.overallMetrics.satisfactionRate,
        topIssues: analysis.suggestions
          .filter(s => s.priority === 'high')
          .slice(0, 3)
          .map(s => s.issue),
        improvementAreas: analysis.categoryAnalysis
          .filter(c => c.averageRating < 3.5)
          .map(c => c.category),
        period: { days, startDate, endDate },
      };
    } catch (error) {
      console.error('Failed to get feedback summary:', error);
      return this.createEmptyFeedbackSummary(days, startDate, endDate);
    }
  }

  /**
   * Generate personalized response improvement suggestions
   */
  generateResponseImprovements(
    feedback: UserFeedback,
    _aiResponse: string
  ): ResponseImprovement[] {
    const improvements: ResponseImprovement[] = [];

    // Analyze rating and categories
    if (feedback.rating <= 2) {
      improvements.push({
        type: 'overall',
        suggestion: 'Consider providing more helpful and accurate information',
        priority: 'high',
        category: 'helpfulness',
      });
    }

    // Analyze category-specific feedback
    feedback.categories.forEach(category => {
      if (category.rating <= 2) {
        switch (category.category) {
          case 'helpfulness':
            improvements.push({
              type: 'content',
              suggestion: 'Provide more actionable and relevant suggestions',
              priority: 'high',
              category: 'helpfulness',
            });
            break;
          case 'accuracy':
            improvements.push({
              type: 'content',
              suggestion:
                'Verify information accuracy and provide sources when possible',
              priority: 'high',
              category: 'accuracy',
            });
            break;
          case 'clarity':
            improvements.push({
              type: 'communication',
              suggestion: 'Use clearer language and better structure responses',
              priority: 'medium',
              category: 'clarity',
            });
            break;
          case 'speed':
            improvements.push({
              type: 'performance',
              suggestion: 'Optimize response generation for faster replies',
              priority: 'medium',
              category: 'speed',
            });
            break;
          case 'personality':
            improvements.push({
              type: 'communication',
              suggestion: 'Adjust tone and personality to be more engaging',
              priority: 'low',
              category: 'personality',
            });
            break;
        }
      }
    });

    // Analyze comment for specific issues
    if (feedback.comment) {
      const comment = feedback.comment.toLowerCase();

      if (comment.includes('too long') || comment.includes('verbose')) {
        improvements.push({
          type: 'communication',
          suggestion: 'Make responses more concise and to the point',
          priority: 'medium',
          category: 'clarity',
        });
      }

      if (comment.includes('too short') || comment.includes('more detail')) {
        improvements.push({
          type: 'content',
          suggestion: 'Provide more detailed explanations and examples',
          priority: 'medium',
          category: 'helpfulness',
        });
      }

      if (comment.includes('slow') || comment.includes('taking too long')) {
        improvements.push({
          type: 'performance',
          suggestion: 'Improve response time and processing speed',
          priority: 'high',
          category: 'speed',
        });
      }
    }

    return improvements;
  }

  private calculateOverallMetrics(feedbacks: UserFeedback[]): OverallMetrics {
    const ratings = feedbacks.map(f => f.rating);
    const averageRating =
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const satisfactionRate =
      ratings.filter(rating => rating >= 4).length / ratings.length;

    const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: ratings.filter(r => r === rating).length,
      percentage:
        (ratings.filter(r => r === rating).length / ratings.length) * 100,
    }));

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      satisfactionRate: Math.round(satisfactionRate * 100) / 100,
      ratingDistribution,
      totalResponses: feedbacks.length,
    };
  }

  private analyzeCategoryPerformance(
    feedbacks: UserFeedback[]
  ): CategoryAnalysis[] {
    const categories = [
      'helpfulness',
      'accuracy',
      'clarity',
      'speed',
      'personality',
    ] as const;

    return categories.map(category => {
      const categoryRatings = feedbacks
        .flatMap(f => f.categories)
        .filter(c => c.category === category)
        .map(c => c.rating);

      if (categoryRatings.length === 0) {
        return {
          category,
          averageRating: 0,
          totalRatings: 0,
          trend: 'stable' as const,
        };
      }

      const averageRating =
        categoryRatings.reduce((sum, rating) => sum + rating, 0) /
        categoryRatings.length;

      return {
        category,
        averageRating: Math.round(averageRating * 100) / 100,
        totalRatings: categoryRatings.length,
        trend: 'stable' as const, // Would need historical data for real trend analysis
      };
    });
  }

  private identifyTrends(
    logsWithFeedback: Array<{ userFeedback: UserFeedback; timestamp: Date }>
  ): FeedbackTrend[] {
    // Simple trend analysis - in a real implementation, this would be more sophisticated
    const trends: FeedbackTrend[] = [];

    if (logsWithFeedback.length < 10) {
      return trends;
    }

    // Analyze recent vs older feedback
    const midpoint = Math.floor(logsWithFeedback.length / 2);
    const recentLogs = logsWithFeedback.slice(midpoint);
    const olderLogs = logsWithFeedback.slice(0, midpoint);

    const recentAvg =
      recentLogs.reduce((sum, log) => sum + log.userFeedback!.rating, 0) /
      recentLogs.length;
    const olderAvg =
      olderLogs.reduce((sum, log) => sum + log.userFeedback!.rating, 0) /
      olderLogs.length;

    if (recentAvg > olderAvg + 0.5) {
      trends.push({
        type: 'improvement',
        description: 'User satisfaction has been improving recently',
        confidence: 0.7,
        timeframe: 'recent',
      });
    } else if (recentAvg < olderAvg - 0.5) {
      trends.push({
        type: 'decline',
        description: 'User satisfaction has been declining recently',
        confidence: 0.7,
        timeframe: 'recent',
      });
    }

    return trends;
  }

  private generateImprovementSuggestions(
    overallMetrics: OverallMetrics,
    categoryAnalysis: CategoryAnalysis[],
    trends: FeedbackTrend[]
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // Overall rating suggestions
    if (overallMetrics.averageRating < 3.0) {
      suggestions.push({
        issue: 'Low overall satisfaction',
        suggestion: 'Focus on improving response quality and helpfulness',
        priority: 'high',
        category: 'overall',
        impact: 'high',
      });
    }

    // Category-specific suggestions
    categoryAnalysis.forEach(category => {
      if (category.averageRating < 3.0 && category.totalRatings > 0) {
        suggestions.push({
          issue: `Low ${category.category} ratings`,
          suggestion: this.getCategorySuggestion(category.category),
          priority: category.averageRating < 2.5 ? 'high' : 'medium',
          category: category.category,
          impact: 'medium',
        });
      }
    });

    // Trend-based suggestions
    trends.forEach(trend => {
      if (trend.type === 'decline') {
        suggestions.push({
          issue: 'Declining user satisfaction',
          suggestion:
            'Investigate recent changes and gather more detailed feedback',
          priority: 'high',
          category: 'overall',
          impact: 'high',
        });
      }
    });

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private getCategorySuggestion(category: string): string {
    switch (category) {
      case 'helpfulness':
        return 'Provide more actionable advice and relevant suggestions';
      case 'accuracy':
        return 'Improve fact-checking and provide reliable information sources';
      case 'clarity':
        return 'Use clearer language and better structure responses';
      case 'speed':
        return 'Optimize response generation for faster performance';
      case 'personality':
        return 'Adjust communication style to be more engaging and personable';
      default:
        return 'Focus on improving this aspect based on user feedback';
    }
  }

  private analyzeCommonThemes(feedbacks: UserFeedback[]): CommonTheme[] {
    const themes: Record<string, { count: number; examples: string[] }> = {};

    feedbacks.forEach(feedback => {
      if (feedback.comment) {
        const comment = feedback.comment.toLowerCase();

        // Simple keyword-based theme detection
        const keywords = [
          {
            theme: 'response_length',
            keywords: ['too long', 'verbose', 'concise', 'brief'],
          },
          {
            theme: 'response_speed',
            keywords: ['slow', 'fast', 'quick', 'time'],
          },
          {
            theme: 'accuracy',
            keywords: ['wrong', 'correct', 'accurate', 'mistake'],
          },
          {
            theme: 'helpfulness',
            keywords: ['helpful', 'useful', 'useless', 'not helpful'],
          },
          {
            theme: 'personality',
            keywords: ['friendly', 'rude', 'tone', 'personality'],
          },
        ];

        keywords.forEach(({ theme, keywords: themeKeywords }) => {
          if (themeKeywords.some(keyword => comment.includes(keyword))) {
            if (!themes[theme]) {
              themes[theme] = { count: 0, examples: [] };
            }
            themes[theme].count++;
            if (themes[theme].examples.length < 3 && feedback.comment) {
              themes[theme].examples.push(feedback.comment);
            }
          }
        });
      }
    });

    return Object.entries(themes)
      .map(([theme, data]) => ({
        theme,
        frequency: data.count,
        examples: data.examples,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }

  private createEmptyAnalysis(): FeedbackAnalysis {
    return {
      overallMetrics: {
        averageRating: 0,
        satisfactionRate: 0,
        ratingDistribution: [],
        totalResponses: 0,
      },
      categoryAnalysis: [],
      trends: [],
      suggestions: [],
      commonThemes: [],
      totalFeedbacks: 0,
      timeRange: {
        startDate: new Date(),
        endDate: new Date(),
      },
    };
  }

  private createEmptyFeedbackSummary(
    days: number,
    startDate: Date,
    endDate: Date
  ): FeedbackSummary {
    return {
      averageRating: 0,
      totalFeedbacks: 0,
      satisfactionRate: 0,
      topIssues: [],
      improvementAreas: [],
      period: { days, startDate, endDate },
    };
  }
}

// Type definitions for feedback analysis
export interface FeedbackAnalysis {
  overallMetrics: OverallMetrics;
  categoryAnalysis: CategoryAnalysis[];
  trends: FeedbackTrend[];
  suggestions: ImprovementSuggestion[];
  commonThemes: CommonTheme[];
  totalFeedbacks: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface OverallMetrics {
  averageRating: number;
  satisfactionRate: number;
  ratingDistribution: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  totalResponses: number;
}

export interface CategoryAnalysis {
  category: FeedbackCategory['category'];
  averageRating: number;
  totalRatings: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface FeedbackTrend {
  type: 'improvement' | 'decline' | 'stable';
  description: string;
  confidence: number;
  timeframe: 'recent' | 'long_term';
}

export interface ImprovementSuggestion {
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  impact: 'high' | 'medium' | 'low';
}

export interface CommonTheme {
  theme: string;
  frequency: number;
  examples: string[];
}

export interface FeedbackSummary {
  averageRating: number;
  totalFeedbacks: number;
  satisfactionRate: number;
  topIssues: string[];
  improvementAreas: string[];
  period: {
    days: number;
    startDate: Date;
    endDate: Date;
  };
}

export interface ResponseImprovement {
  type: 'content' | 'communication' | 'performance' | 'overall';
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

// Singleton instance
let feedbackAnalysisServiceInstance: FeedbackAnalysisService | null = null;

/**
 * Get FeedbackAnalysisService singleton instance
 */
export function getFeedbackAnalysisService(): FeedbackAnalysisService {
  if (!feedbackAnalysisServiceInstance) {
    feedbackAnalysisServiceInstance = new FeedbackAnalysisService();
  }
  return feedbackAnalysisServiceInstance;
}
