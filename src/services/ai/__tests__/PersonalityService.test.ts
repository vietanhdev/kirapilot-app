import { PersonalityService } from '../PersonalityService';
import {
  EmotionalTone,
  EmotionalContext,
  MoodLevel,
  StressIndicator,
  Achievement,
} from '../../../types';
import type { UserPreferences } from '../../../types';

describe('PersonalityService', () => {
  let personalityService: PersonalityService;
  let mockAISettings: UserPreferences['aiSettings'];

  beforeEach(() => {
    mockAISettings = {
      conversationHistory: true,
      autoSuggestions: true,
      toolPermissions: true,
      responseStyle: 'balanced',
      suggestionFrequency: 'moderate',
      showInteractionLogs: false,
      personalitySettings: {
        warmth: 7,
        enthusiasm: 6,
        supportiveness: 8,
        humor: 5,
      },
      interactionStyle: 'friendly',
      emojiUsage: 'moderate',
      emotionalFeatures: {
        dailyMoodTracking: true,
        stressDetection: true,
        encouragementFrequency: 'medium',
        celebrationStyle: 'enthusiastic',
      },
    };

    personalityService = new PersonalityService(mockAISettings);
  });

  describe('calculateEmotionalTone', () => {
    it('should adjust tone based on user stress level', () => {
      const highStressMood: MoodLevel = {
        energy: 3,
        focus: 4,
        motivation: 3,
        stress: 9,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: highStressMood,
        stressIndicators: [],
        recentAchievements: [],
        supportNeeds: [],
      };

      const tone = personalityService.calculateEmotionalTone(
        highStressMood,
        emotionalContext
      );

      // Should increase warmth and supportiveness, decrease enthusiasm
      expect(tone.warmth).toBeGreaterThanOrEqual(
        mockAISettings.personalitySettings!.warmth
      );
      expect(tone.supportiveness).toBeGreaterThanOrEqual(
        mockAISettings.personalitySettings!.supportiveness
      );
      expect(tone.enthusiasm).toBeLessThanOrEqual(
        mockAISettings.personalitySettings!.enthusiasm
      );
    });

    it('should boost enthusiasm for achievements', () => {
      const normalMood: MoodLevel = {
        energy: 6,
        focus: 6,
        motivation: 6,
        stress: 4,
        timestamp: new Date(),
      };

      const achievement: Achievement = {
        id: '1',
        type: 'task_completion',
        title: 'Completed important task',
        description: 'Successfully finished a major project',
        significance: 8,
        achievedAt: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: normalMood,
        stressIndicators: [],
        recentAchievements: [achievement],
        supportNeeds: [],
      };

      const tone = personalityService.calculateEmotionalTone(
        normalMood,
        emotionalContext
      );

      // Should increase enthusiasm and warmth for achievements
      expect(tone.enthusiasm).toBeGreaterThanOrEqual(
        mockAISettings.personalitySettings!.enthusiasm
      );
      expect(tone.warmth).toBeGreaterThanOrEqual(
        mockAISettings.personalitySettings!.warmth
      );
    });

    it('should adjust formality based on interaction style', () => {
      const professionalSettings = {
        ...mockAISettings,
        interactionStyle: 'professional' as const,
      };

      const professionalService = new PersonalityService(professionalSettings);

      const normalMood: MoodLevel = {
        energy: 5,
        focus: 5,
        motivation: 5,
        stress: 5,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: normalMood,
        stressIndicators: [],
        recentAchievements: [],
        supportNeeds: [],
      };

      const tone = professionalService.calculateEmotionalTone(
        normalMood,
        emotionalContext
      );

      // Professional style should have higher formality
      expect(tone.formality).toBe(7);
    });
  });

  describe('generateSupportiveResponse', () => {
    it('should provide stress support when stress indicators are present', () => {
      const stressIndicator: StressIndicator = {
        type: 'task_overload',
        severity: 8,
        description: 'Too many tasks created recently',
        detectedAt: new Date(),
      };

      const stressedMood: MoodLevel = {
        energy: 3,
        focus: 3,
        motivation: 4,
        stress: 8,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: stressedMood,
        stressIndicators: [stressIndicator],
        recentAchievements: [],
        supportNeeds: [],
      };

      const tone: EmotionalTone = {
        warmth: 8,
        enthusiasm: 4,
        supportiveness: 9,
        formality: 3,
      };

      const response = personalityService.generateSupportiveResponse(
        emotionalContext,
        'I have too much to do',
        tone
      );

      expect(response.message).toMatch(/(overwhelm|pressure|stress)/i);
      expect(response.suggestedActions.length).toBeGreaterThan(0);
      expect(response.emotionalSupport).toBe(true);
      expect(response.suggestedActions).toContain(
        'Review and prioritize your task list'
      );
    });

    it('should celebrate achievements', () => {
      const achievement: Achievement = {
        id: '1',
        type: 'task_completion',
        title: 'Completed project',
        description: 'Finished a major milestone',
        significance: 9,
        achievedAt: new Date(),
      };

      const happyMood: MoodLevel = {
        energy: 8,
        focus: 7,
        motivation: 8,
        stress: 2,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: happyMood,
        stressIndicators: [],
        recentAchievements: [achievement],
        supportNeeds: [],
      };

      const tone: EmotionalTone = {
        warmth: 7,
        enthusiasm: 8,
        supportiveness: 6,
        formality: 4,
      };

      const response = personalityService.generateSupportiveResponse(
        emotionalContext,
        'I just finished my project!',
        tone
      );

      expect(response.message).toMatch(/(Amazing|Great|Fantastic|Excellent)/i);
      expect(response.emotionalSupport).toBe(true);
    });

    it('should provide motivation for low motivation', () => {
      const lowMotivationMood: MoodLevel = {
        energy: 5,
        focus: 5,
        motivation: 2,
        stress: 5,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: lowMotivationMood,
        stressIndicators: [],
        recentAchievements: [],
        supportNeeds: [],
      };

      const tone: EmotionalTone = {
        warmth: 7,
        enthusiasm: 5,
        supportiveness: 8,
        formality: 4,
      };

      const response = personalityService.generateSupportiveResponse(
        emotionalContext,
        "I don't feel like doing anything",
        tone
      );

      expect(response.message).toMatch(/(believe|momentum|boost)/i);
      expect(response.suggestedActions).toContain(
        'Review your goals and why they matter to you'
      );
      expect(response.followUpQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('detectStressTriggers', () => {
    it('should detect stress keywords in user message', () => {
      const result = personalityService.detectStressTriggers(
        'I feel overwhelmed and stressed about my deadlines',
        [],
        {
          energy: 4,
          focus: 3,
          motivation: 3,
          stress: 7,
          timestamp: new Date(),
        }
      );

      expect(result.triggers.length).toBeGreaterThan(0);
      expect(
        result.triggers.some(t => t.description.includes('overwhelmed'))
      ).toBe(true);
      expect(
        result.triggers.some(t => t.description.includes('stressed'))
      ).toBe(true);
      expect(result.supportResponse).toContain('stress');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should detect time pressure indicators', () => {
      const result = personalityService.detectStressTriggers(
        'I need this done ASAP, the deadline is tomorrow',
        [],
        {
          energy: 5,
          focus: 6,
          motivation: 7,
          stress: 6,
          timestamp: new Date(),
        }
      );

      expect(result.triggers.some(t => t.type === 'time_pressure')).toBe(true);
      expect(
        result.triggers.some(t => t.description.includes('Time pressure'))
      ).toBe(true);
    });

    it('should detect task overload from activity', () => {
      const recentActivity = Array.from({ length: 10 }, (_, i) => ({
        type: 'task_created',
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000), // Last 10 hours
        data: { taskId: `task-${i}` },
      }));

      const result = personalityService.detectStressTriggers(
        'I have so many tasks to do',
        recentActivity,
        {
          energy: 4,
          focus: 4,
          motivation: 5,
          stress: 6,
          timestamp: new Date(),
        }
      );

      expect(result.triggers.some(t => t.type === 'task_overload')).toBe(true);
      expect(result.suggestedActions).toContain(
        'Review and prioritize your task list'
      );
    });
  });

  describe('generateEncouragementTemplates', () => {
    it('should generate appropriate templates for different contexts', () => {
      const tone: EmotionalTone = {
        warmth: 7,
        enthusiasm: 6,
        supportiveness: 8,
        formality: 4,
      };

      const lowMotivationTemplates =
        personalityService.generateEncouragementTemplates(
          'low_motivation',
          tone
        );

      expect(lowMotivationTemplates.length).toBeGreaterThan(0);
      expect(lowMotivationTemplates.every(t => typeof t === 'string')).toBe(
        true
      );
      expect(
        lowMotivationTemplates.some(
          t => t.includes('believe') || t.includes('momentum')
        )
      ).toBe(true);

      const completionTemplates =
        personalityService.generateEncouragementTemplates(
          'task_completion',
          tone
        );

      expect(completionTemplates.length).toBeGreaterThan(0);
      expect(
        completionTemplates.some(
          t => t.includes('Fantastic') || t.includes('Excellent')
        )
      ).toBe(true);
    });

    it('should adjust templates based on emoji usage setting', () => {
      const minimalEmojiSettings = {
        ...mockAISettings,
        emojiUsage: 'minimal' as const,
      };

      const minimalService = new PersonalityService(minimalEmojiSettings);

      const tone: EmotionalTone = {
        warmth: 7,
        enthusiasm: 8,
        supportiveness: 7,
        formality: 4,
      };

      const templates = minimalService.generateEncouragementTemplates(
        'task_completion',
        tone
      );

      // With minimal emoji usage, templates should have fewer or no emojis
      const hasEmojis = templates.some(t =>
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
          t
        )
      );
      expect(hasEmojis).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update personality settings', () => {
      const newSettings = {
        ...mockAISettings,
        personalitySettings: {
          warmth: 9,
          enthusiasm: 8,
          supportiveness: 10,
          humor: 7,
        },
        interactionStyle: 'casual' as const,
      };

      personalityService.updatePreferences(newSettings);

      const normalMood: MoodLevel = {
        energy: 5,
        focus: 5,
        motivation: 5,
        stress: 5,
        timestamp: new Date(),
      };

      const emotionalContext: EmotionalContext = {
        currentMood: normalMood,
        stressIndicators: [],
        recentAchievements: [],
        supportNeeds: [],
      };

      const tone = personalityService.calculateEmotionalTone(
        normalMood,
        emotionalContext
      );

      // Should reflect the new settings
      expect(tone.warmth).toBe(9);
      expect(tone.enthusiasm).toBe(8);
      expect(tone.supportiveness).toBe(10);
      expect(tone.formality).toBe(2); // Casual style
    });
  });
});
