import {
  EmotionalTone,
  EmotionalContext,
  SupportResponse,
  MoodLevel,
  StressIndicator,
  Achievement,
} from '../../types';
import type { UserPreferences } from '../../types';

/**
 * Service for managing AI personality and supportive responses
 * Handles dynamic tone adjustment, encouragement templates, and stress detection
 */
export class PersonalityService {
  private preferences: UserPreferences['aiSettings'];

  constructor(preferences: UserPreferences['aiSettings']) {
    this.preferences = preferences;
  }

  /**
   * Updates personality preferences
   */
  updatePreferences(preferences: UserPreferences['aiSettings']): void {
    this.preferences = preferences;
  }

  /**
   * Calculates emotional tone based on user mood and personality settings
   */
  calculateEmotionalTone(
    userMood: MoodLevel,
    emotionalContext: EmotionalContext
  ): EmotionalTone {
    const personalitySettings = this.preferences.personalitySettings || {
      warmth: 6,
      enthusiasm: 5,
      supportiveness: 7,
      humor: 4,
    };

    let { warmth, enthusiasm, supportiveness } = personalitySettings;
    let formality = this.getBaseFormality();

    // Adjust tone based on user's current mood
    if (userMood.stress > 7) {
      // High stress: increase warmth and supportiveness, reduce enthusiasm
      warmth = Math.min(10, warmth + 2);
      supportiveness = Math.min(10, supportiveness + 3);
      enthusiasm = Math.max(1, enthusiasm - 2);
      formality = Math.max(1, formality - 1); // More casual when stressed
    }

    if (userMood.energy < 3) {
      // Low energy: gentle encouragement
      warmth = Math.min(10, warmth + 1);
      supportiveness = Math.min(10, supportiveness + 2);
      enthusiasm = Math.max(1, enthusiasm - 1);
    }

    if (userMood.motivation < 4) {
      // Low motivation: boost enthusiasm and supportiveness
      enthusiasm = Math.min(10, enthusiasm + 2);
      supportiveness = Math.min(10, supportiveness + 2);
    }

    // Adjust based on recent achievements
    if (emotionalContext.recentAchievements.length > 0) {
      const totalSignificance = emotionalContext.recentAchievements.reduce(
        (sum, ach) => sum + ach.significance,
        0
      );

      if (totalSignificance > 15) {
        // Major achievements: celebrate with enthusiasm
        enthusiasm = Math.min(10, enthusiasm + 3);
        warmth = Math.min(10, warmth + 2);
      }
    }

    // Adjust based on stress indicators
    if (emotionalContext.stressIndicators.length > 2) {
      // Multiple stress indicators: be more supportive and gentle
      supportiveness = Math.min(10, supportiveness + 2);
      warmth = Math.min(10, warmth + 1);
      enthusiasm = Math.max(1, enthusiasm - 1);
    }

    return {
      warmth,
      enthusiasm,
      supportiveness,
      formality,
    };
  }

  /**
   * Generates supportive response based on emotional context and tone
   */
  generateSupportiveResponse(
    emotionalContext: EmotionalContext,
    _userMessage: string,
    tone: EmotionalTone
  ): SupportResponse {
    const { currentMood, stressIndicators, recentAchievements, supportNeeds } =
      emotionalContext;

    let message = '';
    const suggestedActions: string[] = [];
    const followUpQuestions: string[] = [];

    // Handle achievements first (positive reinforcement)
    if (recentAchievements.length > 0) {
      message += this.generateCelebrationMessage(recentAchievements, tone);

      if (tone.enthusiasm > 6) {
        followUpQuestions.push('What would you like to tackle next?');
      }
    }

    // Address stress and challenges
    if (stressIndicators.length > 0 || currentMood.stress > 6) {
      if (message) {
        message += ' ';
      }
      message += this.generateStressSupportMessage(
        stressIndicators,
        currentMood,
        tone
      );

      suggestedActions.push(...this.getStressReliefActions(stressIndicators));
      followUpQuestions.push(
        "What's been the most challenging part of your day?"
      );
    }

    // Provide motivation boost if needed
    if (currentMood.motivation < 4) {
      if (message) {
        message += ' ';
      }
      message += this.generateMotivationMessage(tone);

      suggestedActions.push(...this.getMotivationActions());
      followUpQuestions.push('What usually helps you feel more motivated?');
    }

    // Energy support
    if (currentMood.energy < 4) {
      suggestedActions.push(...this.getEnergyBoostActions());
    }

    // Add support need actions
    supportNeeds.forEach(need => {
      if (need.suggestedActions) {
        suggestedActions.push(...need.suggestedActions);
      }
    });

    // Default supportive message if nothing specific
    if (!message) {
      message = this.generateDefaultSupportMessage(tone);
    }

    return {
      message,
      tone,
      suggestedActions: [...new Set(suggestedActions)], // Remove duplicates
      followUpQuestions: followUpQuestions.slice(0, 2), // Limit to 2 questions
      emotionalSupport: true,
    };
  }

  /**
   * Detects stress triggers and generates appropriate responses
   */
  detectStressTriggers(
    userMessage: string,
    recentActivity: Array<{
      type: string;
      timestamp: Date;
      data?: Record<string, unknown>;
    }>,
    _currentMood: MoodLevel
  ): {
    triggers: StressIndicator[];
    supportResponse: string;
    suggestedActions: string[];
  } {
    const triggers: StressIndicator[] = [];
    const lowerMessage = userMessage.toLowerCase();

    // Detect stress keywords in message
    const stressKeywords = [
      'overwhelmed',
      'stressed',
      'anxious',
      'frustrated',
      'tired',
      'exhausted',
      'burned out',
      'too much',
      "can't handle",
      'pressure',
    ];

    stressKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        triggers.push({
          type: 'fatigue',
          severity: 7,
          description: `Stress language detected: "${keyword}"`,
          detectedAt: new Date(),
        });
      }
    });

    // Detect task overload from activity
    const recentTasks = recentActivity.filter(
      event =>
        event.type === 'task_created' &&
        event.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentTasks.length > 8) {
      triggers.push({
        type: 'task_overload',
        severity: Math.min(10, recentTasks.length),
        description: `High task creation rate: ${recentTasks.length} tasks in 24 hours`,
        detectedAt: new Date(),
      });
    }

    // Detect time pressure
    if (
      lowerMessage.includes('deadline') ||
      lowerMessage.includes('urgent') ||
      lowerMessage.includes('asap')
    ) {
      triggers.push({
        type: 'time_pressure',
        severity: 6,
        description: 'Time pressure indicators in message',
        detectedAt: new Date(),
      });
    }

    // Generate support response
    const supportResponse = this.generateStressTriggerResponse(triggers);
    const suggestedActions = this.getStressReliefActions(triggers);

    return {
      triggers,
      supportResponse,
      suggestedActions,
    };
  }

  /**
   * Generates encouragement templates based on context
   */
  generateEncouragementTemplates(
    context: 'low_motivation' | 'task_completion' | 'progress' | 'challenge',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      low_motivation: [
        "You've got this! Sometimes we all need a little boost to get going.",
        "I believe in you! Let's find a way to get your momentum back.",
        'Remember why you started - your goals are worth pursuing.',
        "Every small step counts. What's one tiny thing you could do right now?",
      ],
      task_completion: [
        "Fantastic work! You're making real progress.",
        "Way to go! That's another task conquered.",
        "Excellent! You're building great momentum.",
        'Nice job! You should feel proud of that accomplishment.',
      ],
      progress: [
        "Look at how far you've come! You're doing amazing.",
        'Your consistency is really paying off.',
        "I'm impressed by your dedication and progress.",
        "You're building something great, step by step.",
      ],
      challenge: [
        'Challenges are opportunities in disguise. You can handle this.',
        "This is tough, but you're tougher. Let's break it down together.",
        "Every expert was once a beginner. You're learning and growing.",
        'Difficult roads often lead to beautiful destinations.',
      ],
    };

    const contextTemplates = templates[context] || templates.low_motivation;

    // Adjust templates based on tone
    return contextTemplates.map(template => {
      let adjusted = template;

      // Add emoji based on usage preference
      const emoji = this.getAppropriateEmoji('encouragement', tone);
      if (emoji) {
        adjusted += ` ${emoji}`;
      }

      // Adjust enthusiasm level
      if (tone.enthusiasm > 7) {
        adjusted = adjusted.replace(/!$/, '!!');
      } else if (tone.enthusiasm < 4) {
        adjusted = adjusted.replace(/!/g, '.');
      }

      return adjusted;
    });
  }

  /**
   * Generates celebration messages for achievements
   */
  private generateCelebrationMessage(
    achievements: Achievement[],
    tone: EmotionalTone
  ): string {
    const celebrationStyle =
      this.preferences.emotionalFeatures?.celebrationStyle || 'enthusiastic';
    const emoji = this.getAppropriateEmoji('celebration', tone);

    if (achievements.length === 1) {
      const achievement = achievements[0];
      if (celebrationStyle === 'enthusiastic' && tone.enthusiasm > 6) {
        return `🎉 Amazing work! ${achievement.description} ${emoji}`;
      } else {
        return `Great job! ${achievement.description} ${emoji}`;
      }
    } else {
      if (celebrationStyle === 'enthusiastic' && tone.enthusiasm > 6) {
        return `🌟 Wow! You've been incredibly productive today ${emoji}`;
      } else {
        return `Nice work! You've accomplished quite a bit today ${emoji}`;
      }
    }
  }

  /**
   * Generates stress support messages
   */
  private generateStressSupportMessage(
    indicators: StressIndicator[],
    mood: MoodLevel,
    tone: EmotionalTone
  ): string {
    const emoji = this.getAppropriateEmoji('support', tone);

    if (mood.stress > 8) {
      return `I can see you're feeling quite overwhelmed right now ${emoji}. Let's take this one step at a time and find ways to ease the pressure.`;
    } else if (indicators.length > 2) {
      return `It looks like you have a lot on your plate ${emoji}. Remember, it's okay to take breaks and prioritize what's most important.`;
    } else {
      return `I notice you might be feeling some pressure ${emoji}. Let's work through this together and find some relief.`;
    }
  }

  /**
   * Generates motivation messages
   */
  private generateMotivationMessage(tone: EmotionalTone): string {
    const emoji = this.getAppropriateEmoji('encouragement', tone);

    if (tone.warmth > 7) {
      return `I believe in you! Sometimes we all need a little boost to get going ${emoji}. What's one small thing that might help you feel more motivated?`;
    } else {
      return `Let's find a way to get your momentum back ${emoji}. You've got this!`;
    }
  }

  /**
   * Generates default support message
   */
  private generateDefaultSupportMessage(tone: EmotionalTone): string {
    const emoji = this.getAppropriateEmoji('general', tone);

    if (tone.warmth > 6) {
      return `I'm here to help you stay productive and feel good about your work ${emoji}. How can I support you today?`;
    } else {
      return `Let me know how I can help you today ${emoji}.`;
    }
  }

  /**
   * Generates stress trigger response
   */
  private generateStressTriggerResponse(triggers: StressIndicator[]): string {
    if (triggers.length === 0) {
      return '';
    }

    const highSeverityTriggers = triggers.filter(t => t.severity > 7);

    if (highSeverityTriggers.length > 0) {
      return "I can see you're dealing with some significant stress right now. Let's focus on what we can control and take things one step at a time.";
    } else {
      return "I notice some stress indicators. Let's work together to find ways to make things more manageable.";
    }
  }

  /**
   * Gets stress relief actions based on triggers
   */
  private getStressReliefActions(triggers: StressIndicator[]): string[] {
    const actions: string[] = [];

    triggers.forEach(trigger => {
      switch (trigger.type) {
        case 'task_overload':
          actions.push('Review and prioritize your task list');
          actions.push('Break large tasks into smaller, manageable steps');
          break;
        case 'time_pressure':
          actions.push('Focus on the most critical tasks first');
          actions.push('Consider extending deadlines if possible');
          break;
        case 'fatigue':
          actions.push('Take a 10-15 minute break');
          actions.push('Try some deep breathing exercises');
          break;
        case 'complexity':
          actions.push('Break complex tasks into simpler components');
          actions.push('Seek help or resources for difficult areas');
          break;
        case 'interruptions':
          actions.push('Set boundaries for focused work time');
          actions.push('Use "Do Not Disturb" mode');
          break;
      }
    });

    // Add general stress relief actions
    actions.push('Take a short walk outside');
    actions.push('Practice mindfulness for 5 minutes');

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Gets motivation boost actions
   */
  private getMotivationActions(): string[] {
    return [
      'Review your goals and why they matter to you',
      'Start with a small, easy task to build momentum',
      'Celebrate a recent accomplishment',
      'Connect with your purpose and values',
      'Set a small, achievable goal for the next hour',
    ];
  }

  /**
   * Gets energy boost actions
   */
  private getEnergyBoostActions(): string[] {
    return [
      'Take a 5-10 minute walk',
      'Do some light stretching',
      'Have a healthy snack or drink water',
      'Get some fresh air',
      'Listen to energizing music',
    ];
  }

  /**
   * Gets base formality level based on interaction style
   */
  private getBaseFormality(): number {
    switch (this.preferences.interactionStyle) {
      case 'professional':
        return 7;
      case 'casual':
        return 2;
      case 'friendly':
      default:
        return 4;
    }
  }

  /**
   * Gets appropriate emoji based on context and settings
   */
  private getAppropriateEmoji(
    context: 'celebration' | 'support' | 'encouragement' | 'general',
    tone: EmotionalTone
  ): string {
    const emojiUsage = this.preferences.emojiUsage || 'moderate';

    if (emojiUsage === 'minimal') {
      return '';
    }

    const emojiMap: Record<string, string[]> = {
      celebration: ['🎉', '✨', '🌟', '👏', '🎊'],
      support: ['🤗', '💪', '🌈', '☀️', '💙'],
      encouragement: ['💪', '🚀', '⭐', '🌟', '✊'],
      general: ['😊', '👍', '🙂', '💫', '🌸'],
    };

    const options = emojiMap[context] || emojiMap.general;

    // Select emoji based on tone and usage preference
    let index = 0;
    if (emojiUsage === 'frequent' && tone.enthusiasm > 6) {
      index = 0; // Most enthusiastic emoji
    } else if (emojiUsage === 'moderate') {
      index = Math.min(1, options.length - 1);
    } else {
      index = Math.min(2, options.length - 1);
    }

    return options[index] || '';
  }
}
