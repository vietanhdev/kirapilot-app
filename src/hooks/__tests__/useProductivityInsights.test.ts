import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useProductivityInsights,
  useWorkingStyleInsights,
} from '../useProductivityInsights';
import { ProductivityInsightsService } from '../../services/ai/ProductivityInsightsService';
import { Priority } from '../../types';

// Mock the service
jest.mock('../../services/ai/ProductivityInsightsService');

const MockedProductivityInsightsService =
  ProductivityInsightsService as jest.MockedClass<
    typeof ProductivityInsightsService
  >;

describe('useProductivityInsights', () => {
  let mockService: jest.Mocked<ProductivityInsightsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = {
      analyzeUserBehaviorPatterns: jest.fn(),
      detectWorkingStyle: jest.fn(),
      generatePersonalizedTips: jest.fn(),
      provideContextualAdvice: jest.fn(),
    } as jest.Mocked<ProductivityInsightsService>;

    MockedProductivityInsightsService.mockImplementation(() => mockService);
  });

  describe('useProductivityInsights hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      expect(result.current.workingStyle).toBeNull();
      expect(result.current.patternAnalysis).toBeNull();
      expect(result.current.personalizedTips).toEqual([]);
      expect(result.current.contextualAdvice).toEqual([]);
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.isGeneratingTips).toBe(false);
      expect(result.current.isGeneratingAdvice).toBe(false);
    });

    it('should auto-analyze when autoAnalyze is true', async () => {
      const mockPatternAnalysis = {
        userId: 'test-user',
        analysisDate: new Date(),
        productivityPatterns: [],
        energyPatterns: [],
        recommendations: [],
        insights: {
          mostProductiveTime: { start: '09:00', end: '12:00', dayOfWeek: 1 },
          leastProductiveTime: { start: '15:00', end: '17:00', dayOfWeek: 5 },
          averageTaskDuration: 45,
          completionRate: 75,
          focusEfficiency: 80,
        },
      };

      const mockWorkingStyle = {
        preferredWorkingHours: [
          { start: '09:00', end: '12:00', dayOfWeek: -1 },
        ],
        averageTaskDuration: 45,
        breakFrequency: 60,
        focusPatterns: 'morning' as const,
        taskCompletionStyle: 'distributed' as const,
        energyLevels: [],
      };

      mockService.analyzeUserBehaviorPatterns.mockResolvedValue(
        mockPatternAnalysis
      );
      mockService.detectWorkingStyle.mockResolvedValue(mockWorkingStyle);

      const { result } = renderHook(() =>
        useProductivityInsights('test-user', true)
      );

      await waitFor(() => {
        expect(mockService.analyzeUserBehaviorPatterns).toHaveBeenCalledWith(
          'test-user',
          30
        );
        expect(mockService.detectWorkingStyle).toHaveBeenCalledWith(
          'test-user'
        );
      });

      await waitFor(() => {
        expect(result.current.patternAnalysis).toEqual(mockPatternAnalysis);
        expect(result.current.workingStyle).toEqual(mockWorkingStyle);
      });
    });

    it('should handle analysis errors', async () => {
      mockService.analyzeUserBehaviorPatterns.mockRejectedValue(
        new Error('Analysis failed')
      );

      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      await act(async () => {
        await result.current.analyzePatterns();
      });

      await waitFor(() => {
        expect(result.current.analysisError).toBe('Analysis failed');
        expect(result.current.isAnalyzing).toBe(false);
      });
    });

    it('should generate personalized tips', async () => {
      const mockTips = [
        {
          id: 'tip-1',
          category: 'scheduling' as const,
          title: 'Test Tip',
          description: 'Test description',
          reasoning: 'Test reasoning',
          confidence: 85,
          estimatedImpact: 70,
          difficulty: 'easy' as const,
          timeToImplement: 5,
          actions: {
            primary: 'Test action',
          },
          personalizedFor: {
            workingStyle: {},
            recentPatterns: [],
            userPreferences: {},
          },
          createdAt: new Date(),
        },
      ];

      mockService.generatePersonalizedTips.mockResolvedValue(mockTips);

      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      await act(async () => {
        await result.current.generateTips();
      });

      await waitFor(() => {
        expect(result.current.personalizedTips).toEqual(mockTips);
        expect(result.current.isGeneratingTips).toBe(false);
      });
    });

    it('should provide contextual advice', async () => {
      const mockAdvice = [
        {
          id: 'advice-1',
          type: 'productivity' as const,
          title: 'Test Advice',
          description: 'Test advice description',
          confidence: 80,
          actionable: true,
          priority: Priority.MEDIUM,
          estimatedImpact: 65,
          reasoning: 'Test reasoning',
          createdAt: new Date(),
        },
      ];

      mockService.provideContextualAdvice.mockResolvedValue(mockAdvice);

      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      const context = {
        timeOfDay: new Date(),
        recentPerformance: 'medium' as const,
        upcomingDeadlines: [],
      };

      await act(async () => {
        await result.current.getContextualAdvice(context);
      });

      await waitFor(() => {
        expect(result.current.contextualAdvice).toEqual(mockAdvice);
        expect(result.current.isGeneratingAdvice).toBe(false);
      });
    });

    it('should clear errors', async () => {
      mockService.analyzeUserBehaviorPatterns.mockRejectedValue(
        new Error('Test error')
      );
      mockService.generatePersonalizedTips.mockRejectedValue(
        new Error('Tips error')
      );
      mockService.provideContextualAdvice.mockRejectedValue(
        new Error('Advice error')
      );

      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      // Trigger errors
      await act(async () => {
        await result.current.analyzePatterns().catch(() => {});
        await result.current.generateTips().catch(() => {});
        await result.current
          .getContextualAdvice({
            timeOfDay: new Date(),
            recentPerformance: 'medium',
            upcomingDeadlines: [],
          })
          .catch(() => {});
      });

      // Verify errors are set
      expect(result.current.analysisError).toBe('Test error');
      expect(result.current.tipsError).toBe('Tips error');
      expect(result.current.adviceError).toBe('Advice error');

      // Clear errors
      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.analysisError).toBeNull();
      expect(result.current.tipsError).toBeNull();
      expect(result.current.adviceError).toBeNull();
    });

    it('should reset all state', () => {
      const { result } = renderHook(() =>
        useProductivityInsights('test-user', false)
      );

      act(() => {
        result.current.reset();
      });

      expect(result.current.workingStyle).toBeNull();
      expect(result.current.patternAnalysis).toBeNull();
      expect(result.current.personalizedTips).toEqual([]);
      expect(result.current.contextualAdvice).toEqual([]);
      expect(result.current.analysisError).toBeNull();
      expect(result.current.tipsError).toBeNull();
      expect(result.current.adviceError).toBeNull();
    });
  });

  describe('useWorkingStyleInsights hook', () => {
    it('should provide working style utilities', async () => {
      const mockWorkingStyle = {
        preferredWorkingHours: [
          { start: '09:00', end: '12:00', dayOfWeek: -1 },
          { start: '14:00', end: '17:00', dayOfWeek: -1 },
        ],
        averageTaskDuration: 45,
        breakFrequency: 60,
        focusPatterns: 'morning' as const,
        taskCompletionStyle: 'distributed' as const,
        energyLevels: [
          {
            timeSlot: { start: '09:00', end: '10:00', dayOfWeek: -1 },
            averageEnergy: 85,
            confidence: 80,
            sampleSize: 10,
          },
          {
            timeSlot: { start: '15:00', end: '16:00', dayOfWeek: -1 },
            averageEnergy: 45,
            confidence: 75,
            sampleSize: 8,
          },
        ],
      };

      mockService.detectWorkingStyle.mockResolvedValue(mockWorkingStyle);

      const { result } = renderHook(() => useWorkingStyleInsights());

      await waitFor(() => {
        expect(result.current.workingStyle).toEqual(mockWorkingStyle);
      });

      // Test getBestWorkingHours
      const bestHours = result.current.getBestWorkingHours();
      expect(bestHours).toEqual([
        { start: '09:00', end: '12:00', dayOfWeek: -1 },
        { start: '14:00', end: '17:00', dayOfWeek: -1 },
      ]);

      // Test getEnergyRecommendation for high energy hour
      const highEnergyRec = result.current.getEnergyRecommendation(9);
      expect(highEnergyRec).toEqual({
        type: 'high-energy',
        message: 'Perfect time for challenging tasks!',
        energy: 85,
      });

      // Test getEnergyRecommendation for low energy hour
      const lowEnergyRec = result.current.getEnergyRecommendation(15);
      expect(lowEnergyRec).toEqual({
        type: 'low-energy',
        message: 'Consider lighter tasks or taking a break.',
        energy: 45,
      });

      // Test getEnergyRecommendation for unknown hour
      const unknownRec = result.current.getEnergyRecommendation(12);
      expect(unknownRec).toBeNull();
    });

    it('should handle missing working style data', () => {
      mockService.detectWorkingStyle.mockResolvedValue({
        preferredWorkingHours: [],
        averageTaskDuration: 0,
        breakFrequency: 0,
        focusPatterns: 'flexible',
        taskCompletionStyle: 'distributed',
        energyLevels: [],
      });

      const { result } = renderHook(() => useWorkingStyleInsights());

      const bestHours = result.current.getBestWorkingHours();
      expect(bestHours).toBeNull();

      const energyRec = result.current.getEnergyRecommendation(9);
      expect(energyRec).toBeNull();
    });
  });
});
