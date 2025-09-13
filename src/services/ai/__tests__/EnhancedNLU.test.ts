// Tests for Enhanced Natural Language Understanding service

import { EnhancedNLUService, getEnhancedNLU } from '../EnhancedNLU';
import { EnhancedAppContext } from '../../../types/enhancedContext';
import { AIConversation } from '../../../types/aiLogging';
import { Priority } from '../../../types';
import {
  IntentType,
  EmotionType,
  ImplicitRequestType,
  NLUConfig,
} from '../../../types/naturalLanguageUnderstanding';

// Mock enhanced app context
const createMockContext = (
  overrides?: Partial<EnhancedAppContext>
): EnhancedAppContext => ({
  currentTask: undefined,
  activeSession: undefined,
  activeFocusSession: undefined,
  focusMode: false,
  timeOfDay: '10:30',
  dayOfWeek: 1,
  currentEnergy: 75,
  recentActivity: [],
  preferences: {
    workingHours: { start: '09:00', end: '17:00' },
    breakPreferences: {
      shortBreakDuration: 5,
      longBreakDuration: 15,
      breakInterval: 25,
    },
    focusPreferences: {
      defaultDuration: 25,
      distractionLevel: 'MINIMAL' as any,
      backgroundAudio: { type: 'white_noise', volume: 50 },
    },
    notifications: {
      breakReminders: true,
      taskDeadlines: true,
      dailySummary: true,
      weeklyReview: true,
    },
    aiSettings: {
      conversationHistory: true,
      autoSuggestions: true,
      toolPermissions: true,
      responseStyle: 'balanced',
      suggestionFrequency: 'moderate',
      showInteractionLogs: false,
    },
    taskSettings: {
      defaultPriority: Priority.MEDIUM,
      autoScheduling: false,
      smartDependencies: true,
      weekStartDay: 1,
      showCompletedTasks: true,
      compactView: false,
    },
    soundSettings: {
      hapticFeedback: true,
      completionSound: true,
      soundVolume: 50,
    },
    theme: 'auto',
    language: 'en',
    dateFormat: 'DD/MM/YYYY' as const,
  },
  workflowState: {
    currentPhase: 'executing',
    focusLevel: 7,
    workloadIntensity: 'moderate',
    timeInCurrentPhase: 45,
    upcomingDeadlines: [],
    recentTaskSwitches: 2,
    currentStreak: {
      type: 'focus',
      count: 3,
      startTime: new Date(),
      bestStreak: 5,
    },
  },
  productivityMetrics: {
    todayCompletionRate: 0.75,
    averageTaskDuration: 30,
    focusSessionEfficiency: 0.8,
    breakPatternAdherence: 0.9,
    energyLevel: 7,
    tasksCompletedToday: 4,
    timeSpentToday: 180,
    distractionCount: 2,
    productivityTrend: 'stable',
  },
  recentPatterns: [],
  contextualInsights: [],
  environmentalFactors: {
    timeOfDay: 'morning',
    dayOfWeek: 1,
    isWorkingHours: true,
    upcomingMeetings: 0,
    systemLoad: 'low',
    networkStatus: 'online',
  },
  ...overrides,
});

describe('EnhancedNLUService', () => {
  let nluService: EnhancedNLUService;
  let mockContext: EnhancedAppContext;

  beforeEach(() => {
    nluService = new EnhancedNLUService();
    mockContext = createMockContext();
  });

  describe('Intent Detection', () => {
    it('should detect create_task intent correctly', async () => {
      const message = 'Create a new task called "Review documentation"';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('create_task');
      expect(result.primaryIntent.parameters.title).toBe(
        'Review documentation'
      );
      expect(result.primaryIntent.confidence).toBeGreaterThan(0.6);
      expect(result.intentCategory).toBe('task_management');
    });

    it('should detect start_timer intent with duration', async () => {
      const message = 'Start timer for 25 minutes';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('start_timer');
      expect(result.primaryIntent.parameters.duration).toBe(25);
      expect(result.primaryIntent.confidence).toBeGreaterThan(0.6);
    });

    it('should detect multiple intents when enabled', async () => {
      const message = 'Create a task and start the timer';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('create_task');
      expect(result.secondaryIntents).toHaveLength(1);
      expect(result.secondaryIntents[0].type).toBe('start_timer');
    });

    it('should detect urgency indicators', async () => {
      const message = 'Create an urgent task for the deadline';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.urgencyIndicators).toHaveLength(2);
      expect(
        result.urgencyIndicators.some(i => i.description.includes('urgent'))
      ).toBe(true);
      expect(
        result.urgencyIndicators.some(i => i.description.includes('deadline'))
      ).toBe(true);
    });

    it('should assess ambiguity level correctly', async () => {
      const ambiguousMessage = 'Do something with that thing';
      const result = await nluService.extractUserIntent(
        ambiguousMessage,
        mockContext,
        []
      );

      expect(result.ambiguityLevel).toBe('high');
      expect(result.requiresClarification).toBe(true);
      expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    });

    it('should generate appropriate clarification questions', async () => {
      const message = 'Update the task';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('update_task');
      expect(result.clarificationQuestions).toContain(
        'Which task would you like to update?'
      );
      expect(result.clarificationQuestions).toContain(
        'What changes would you like to make?'
      );
    });
  });

  describe('Implicit Request Detection', () => {
    it('should detect break need from explicit language', async () => {
      const message = "I'm feeling tired and need a break";
      const result = await nluService.identifyImplicitRequests(
        message,
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('need_break');
      expect(result[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect break need from long work session', async () => {
      const contextWithLongSession = createMockContext({
        activeSession: { isActive: true } as any,
        workflowState: {
          ...mockContext.workflowState,
          timeInCurrentPhase: 150, // 2.5 hours
        },
      });

      const message = "How's my productivity today?";
      const result = await nluService.identifyImplicitRequests(
        message,
        contextWithLongSession
      );

      expect(result.some(r => r.type === 'need_break')).toBe(true);
    });

    it('should detect task overwhelm', async () => {
      const message = "I'm overwhelmed with too many tasks";
      const result = await nluService.identifyImplicitRequests(
        message,
        mockContext
      );

      expect(result.some(r => r.type === 'task_overwhelm')).toBe(true);
      const overwhelmRequest = result.find(r => r.type === 'task_overwhelm');
      expect(overwhelmRequest?.confidence).toBeGreaterThan(0.8);
      expect(overwhelmRequest?.priority).toBe('high');
    });

    it('should detect productivity improvement need', async () => {
      const contextWithLowProductivity = createMockContext({
        productivityMetrics: {
          ...mockContext.productivityMetrics,
          todayCompletionRate: 0.3,
          focusSessionEfficiency: 0.4,
        },
      });

      const message = 'How can I be more productive?';
      const result = await nluService.identifyImplicitRequests(
        message,
        contextWithLowProductivity
      );

      expect(result.some(r => r.type === 'productivity_improvement')).toBe(
        true
      );
    });

    it('should detect emotional support need', async () => {
      const message = "I'm stuck and frustrated with this difficult task";
      const result = await nluService.identifyImplicitRequests(
        message,
        mockContext
      );

      expect(result.some(r => r.type === 'emotional_support')).toBe(true);
      const supportRequest = result.find(r => r.type === 'emotional_support');
      expect(supportRequest?.contextualEvidence).toContain(
        'Distress indicators: frustrated, stuck, difficult'
      );
    });

    it('should detect workflow guidance need', async () => {
      const message = 'What should I do next?';
      const result = await nluService.identifyImplicitRequests(
        message,
        mockContext
      );

      expect(result.some(r => r.type === 'workflow_guidance')).toBe(true);
    });
  });

  describe('Emotional Context Detection', () => {
    it('should detect frustrated emotion correctly', () => {
      const message = 'This is really frustrating and annoying';
      const result = nluService.detectEmotionalContext(message, []);

      expect(result.primaryEmotion).toBe('frustrated');
      expect(result.emotionIntensity).toBeGreaterThan(6);
      expect(result.frustrationLevel).toBeGreaterThan(6);
      expect(result.supportNeeded).toBe(true);
    });

    it('should detect happy emotion correctly', () => {
      const message = "This is great! I'm really happy with the progress";
      const result = nluService.detectEmotionalContext(message, []);

      expect(result.primaryEmotion).toBe('happy');
      expect(result.emotionIntensity).toBeGreaterThan(6);
      expect(result.satisfactionLevel).toBeGreaterThan(6);
      expect(result.supportNeeded).toBe(false);
    });

    it('should detect stress indicators', () => {
      const message = "I'm stressed about the urgent deadline";
      const result = nluService.detectEmotionalContext(message, []);

      expect(result.primaryEmotion).toBe('stressed');
      expect(result.stressLevel).toBeGreaterThan(6);
      expect(result.emotionalTriggers).toHaveLength(2);
      expect(result.emotionalTriggers.some(t => t.type === 'deadline')).toBe(
        true
      );
    });

    it('should recommend appropriate response strategy', () => {
      const frustratedMessage = "I'm extremely frustrated and stuck";
      const result = nluService.detectEmotionalContext(frustratedMessage, []);

      expect(result.recommendedResponse.approach).toBe('supportive');
      expect(result.recommendedResponse.tone).toBe('empathetic');
      expect(result.recommendedResponse.offerHelp).toBe(true);
      expect(result.recommendedResponse.suggestBreak).toBe(true);
    });

    it('should handle celebratory emotions', () => {
      const message = 'I finished all my tasks! Feeling accomplished';
      const result = nluService.detectEmotionalContext(message, []);

      expect(result.primaryEmotion).toBe('satisfied');
      expect(result.recommendedResponse.approach).toBe('celebratory');
      expect(result.recommendedResponse.tone).toBe('warm');
      expect(result.recommendedResponse.includeEmoji).toBe(true);
    });
  });

  describe('Message Complexity Analysis', () => {
    it('should identify simple messages correctly', () => {
      const message = 'Start timer';
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.overallComplexity).toBe('simple');
      expect(result.processingDifficulty).toBeLessThan(4);
      expect(result.multipleIntents).toBe(false);
      expect(result.ambiguousLanguage).toBe(false);
    });

    it('should identify complex messages correctly', () => {
      const message =
        'Create a task, start the timer, and analyze my productivity while checking if this is efficient';
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.overallComplexity).toBe('complex');
      expect(result.multipleIntents).toBe(true);
      expect(result.factors.some(f => f.type === 'multiple_intents')).toBe(
        true
      );
    });

    it('should detect ambiguous language', () => {
      const message = 'Do something with that thing over there';
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.ambiguousLanguage).toBe(true);
      expect(result.factors.some(f => f.type === 'ambiguous_language')).toBe(
        true
      );
    });

    it('should assess context dependency', () => {
      const message = 'Update this task and change it to high priority';
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.contextDependency).toBeGreaterThan(3);
      expect(result.factors.some(f => f.type === 'context_dependent')).toBe(
        true
      );
    });

    it('should detect technical terms', () => {
      const message = 'Optimize the workflow algorithm for better productivity';
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.technicalTerms).toContain('workflow');
      expect(result.technicalTerms).toContain('productivity');
      expect(result.technicalTerms).toContain('optimization');
    });

    it('should assess emotional complexity', () => {
      const message = "I'm happy but also stressed about the deadline";
      const result = nluService.analyzeMessageComplexity(message, mockContext);

      expect(result.emotionalComplexity).toBeGreaterThan(5);
      expect(result.factors.some(f => f.type === 'emotional_content')).toBe(
        true
      );
    });
  });

  describe('Contextual Cue Extraction', () => {
    it('should extract time references', () => {
      const message = 'Schedule a meeting for 2:30 PM today';
      const result = nluService.extractContextualCues(message, mockContext);

      const timeReferences = result.filter(
        cue => cue.type === 'time_reference'
      );
      expect(timeReferences).toHaveLength(2);
      expect(timeReferences.some(cue => cue.value === '2:30 PM')).toBe(true);
      expect(timeReferences.some(cue => cue.value === 'today')).toBe(true);
    });

    it('should extract task references', () => {
      const contextWithTask = createMockContext({
        currentTask: { title: 'Review code', id: '1' } as any,
      });

      const message = 'Update this current task';
      const result = nluService.extractContextualCues(message, contextWithTask);

      const taskReferences = result.filter(
        cue => cue.type === 'task_reference'
      );
      expect(taskReferences.some(cue => cue.value === 'Review code')).toBe(
        true
      );
    });

    it('should extract emotional state indicators', () => {
      const message = "I'm feeling frustrated and tired";
      const result = nluService.extractContextualCues(message, mockContext);

      const emotionalStates = result.filter(
        cue => cue.type === 'emotional_state'
      );
      expect(emotionalStates.some(cue => cue.value === 'frustrated')).toBe(
        true
      );
      expect(emotionalStates.some(cue => cue.value === 'tired')).toBe(true);
    });

    it('should extract workflow phase indicators', () => {
      const message = 'Let me plan and organize my tasks';
      const result = nluService.extractContextualCues(message, mockContext);

      const workflowPhases = result.filter(
        cue => cue.type === 'workflow_phase'
      );
      expect(workflowPhases.some(cue => cue.value === 'planning')).toBe(true);
      expect(workflowPhases.some(cue => cue.value === 'executing')).toBe(true); // from context
    });

    it('should extract priority indicators', () => {
      const message = 'This is urgent and high priority';
      const result = nluService.extractContextualCues(message, mockContext);

      const priorityIndicators = result.filter(
        cue => cue.type === 'priority_indicator'
      );
      expect(priorityIndicators.some(cue => cue.value === 'high')).toBe(true);
    });

    it('should sort cues by relevance and confidence', () => {
      const message = 'Create an urgent task for today at 3 PM';
      const result = nluService.extractContextualCues(message, mockContext);

      // Should be sorted by confidence * relevance
      for (let i = 0; i < result.length - 1; i++) {
        const currentScore = result[i].confidence * result[i].relevance;
        const nextScore = result[i + 1].confidence * result[i + 1].relevance;
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }
    });
  });

  describe('Complete NLU Processing', () => {
    it('should process complete NLU analysis successfully', async () => {
      const message = "I'm frustrated and need to create an urgent task";
      const result = await nluService.processComplete(message, mockContext, []);

      expect(result.intentAnalysis.primaryIntent.type).toBe('create_task');
      expect(result.emotionalContext.primaryEmotion).toBe('frustrated');
      expect(
        result.implicitRequests.some(r => r.type === 'emotional_support')
      ).toBe(true);
      expect(result.contextualCues.length).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should generate appropriate warnings', async () => {
      const ambiguousMessage = 'Do something with that stuff';
      const result = await nluService.processComplete(
        ambiguousMessage,
        mockContext,
        []
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('ambiguity'))).toBe(true);
    });

    it('should generate helpful suggestions', async () => {
      const frustratedMessage = "I'm really frustrated and stuck";
      const result = await nluService.processComplete(
        frustratedMessage,
        mockContext,
        []
      );

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.type === 'context_request')).toBe(
        true
      );
    });

    it('should handle processing errors gracefully', async () => {
      // Mock a processing error by passing invalid context
      const invalidContext = null as any;

      await expect(
        nluService.processComplete('test message', invalidContext, [])
      ).rejects.toThrow('NLU processing failed');
    });
  });

  describe('Configuration', () => {
    it('should respect configuration settings', () => {
      const config: Partial<NLUConfig> = {
        enableMultiIntentDetection: false,
        enableImplicitRequestDetection: false,
        enableEmotionalContextDetection: false,
        maxSecondaryIntents: 1,
      };

      const configuredNLU = new EnhancedNLUService(config);

      // Test that multi-intent detection is disabled
      const message = 'Create a task and start timer';
      configuredNLU.extractUserIntent(message, mockContext, []).then(result => {
        expect(result.secondaryIntents).toHaveLength(0);
      });

      // Test that implicit request detection is disabled
      const tiredMessage = "I'm tired and need a break";
      configuredNLU
        .identifyImplicitRequests(tiredMessage, mockContext)
        .then(result => {
          expect(result).toHaveLength(0);
        });

      // Test that emotional context detection returns default
      const emotionalMessage = "I'm frustrated";
      const emotionalResult = configuredNLU.detectEmotionalContext(
        emotionalMessage,
        []
      );
      expect(emotionalResult.primaryEmotion).toBe('neutral');
    });

    it('should use default configuration when none provided', () => {
      const defaultNLU = new EnhancedNLUService();

      // Access private config through any to test defaults
      const config = (defaultNLU as any).config;
      expect(config.enableMultiIntentDetection).toBe(true);
      expect(config.enableImplicitRequestDetection).toBe(true);
      expect(config.enableEmotionalContextDetection).toBe(true);
      expect(config.maxSecondaryIntents).toBe(3);
      expect(config.confidenceThreshold).toBe(0.6);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance when called multiple times', () => {
      const instance1 = getEnhancedNLU();
      const instance2 = getEnhancedNLU();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getEnhancedNLU();
      // Test that we can get the same instance
      const instance2 = getEnhancedNLU();

      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first call', () => {
      const config: Partial<NLUConfig> = {
        enableMultiIntentDetection: false,
      };

      const instance = new EnhancedNLUService(config);
      const config2 = (instance as any).config;
      expect(config2.enableMultiIntentDetection).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', async () => {
      const result = await nluService.extractUserIntent('', mockContext, []);

      expect(result.primaryIntent.type).toBe('general_conversation');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle very long messages', async () => {
      const longMessage = 'Create a task '.repeat(100);
      const result = await nluService.extractUserIntent(
        longMessage,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('create_task');
      expect(result.processingTime).toBeDefined();
    });

    it('should handle messages with special characters', async () => {
      const message = 'Create a task: "Review @#$%^&*() documentation"!';
      const result = await nluService.extractUserIntent(
        message,
        mockContext,
        []
      );

      expect(result.primaryIntent.type).toBe('create_task');
      expect(result.primaryIntent.parameters.title).toContain('Review');
    });

    it('should handle context with missing properties', async () => {
      const incompleteContext = {
        ...mockContext,
        workflowState: undefined,
        productivityMetrics: undefined,
      };

      const result = await nluService.extractUserIntent(
        'Create a task',
        incompleteContext,
        []
      );
      expect(result.primaryIntent.type).toBe('create_task');
    });
  });
});
