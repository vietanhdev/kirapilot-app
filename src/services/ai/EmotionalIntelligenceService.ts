import {
  MoodLevel,
  EmotionalContext,
  StressIndicator,
  Achievement,
  SupportType,
  MoodEntry,
  EmotionalPattern,
  SupportResponse,
  MoodDetectionResult,
  EmotionalTone,
  EmotionalIntelligenceConfig,
  AppContext,
  ActivityEvent,
} from '../../types';
import { getEmotionalIntelligenceRepository } from '../database/repositories';
import {
  getPerformanceMonitor,
  PerformanceMonitor,
} from './PerformanceMonitor';

/**
 * Service for managing emotional intelligence features in KiraPilot AI
 * Handles mood tracking, stress detection, and supportive response generation
 */
export class EmotionalIntelligenceService {
  private config: EmotionalIntelligenceConfig;
  private repository = getEmotionalIntelligenceRepository();
  private userId: string;
  private performanceMonitor: PerformanceMonitor = getPerformanceMonitor();

  constructor(config: EmotionalIntelligenceConfig, userId: string = 'default') {
    this.config = config;
    this.userId = userId;
  }

  /**
   * Updates the emotional intelligence configuration
   */
  async updateConfig(
    config: Partial<EmotionalIntelligenceConfig>
  ): Promise<void> {
    this.config = { ...this.config, ...config };

    try {
      await this.repository.storeConfig(this.userId, this.config);
    } catch (error) {
      console.error('Failed to store emotional intelligence config:', error);
    }
  }

  /**
   * Loads configuration from storage
   */
  async loadConfig(): Promise<EmotionalIntelligenceConfig> {
    try {
      const storedConfig = await this.repository.getConfig(this.userId);
      if (storedConfig) {
        this.config = storedConfig;
      }
    } catch (error) {
      console.error('Failed to load emotional intelligence config:', error);
    }

    return this.config;
  }

  /**
   * Records a mood entry for the user
   */
  async recordMoodEntry(
    mood: MoodLevel,
    notes?: string,
    context?: { taskId?: string; sessionId?: string; activityType?: string }
  ): Promise<MoodEntry> {
    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      userId: this.userId,
      mood,
      notes,
      context,
      createdAt: new Date(),
    };

    try {
      return await this.repository.storeMoodEntry(entry);
    } catch (error) {
      console.error('Failed to store mood entry:', error);
      // Return the entry even if storage fails
      return entry;
    }
  }

  /**
   * Detects mood based on user interactions and context
   */
  detectMoodFromInteraction(
    userMessage: string,
    appContext: AppContext,
    recentActivity: ActivityEvent[]
  ): MoodDetectionResult {
    const operationId = `mood-detection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.performanceMonitor.startOperation(operationId, {
      type: 'mood_detection',
      messageLength: userMessage.length,
      activityCount: recentActivity.length,
    });
    const indicators: string[] = [];
    let detectedMood: MoodLevel = {
      energy: 5,
      focus: 5,
      motivation: 5,
      stress: 5,
      timestamp: new Date(),
    };

    // Analyze message sentiment
    const messageAnalysis = this.analyzeMessageSentiment(userMessage);
    detectedMood = { ...detectedMood, ...messageAnalysis.moodAdjustments };
    indicators.push(...messageAnalysis.indicators);

    // Analyze task completion patterns
    const taskAnalysis = this.analyzeTaskPatterns(recentActivity);
    detectedMood = this.adjustMoodFromTaskAnalysis(detectedMood, taskAnalysis);
    indicators.push(...taskAnalysis.indicators);

    // Analyze time of day and energy patterns
    const timeAnalysis = this.analyzeTimeContext(appContext);
    detectedMood = this.adjustMoodFromTimeAnalysis(detectedMood, timeAnalysis);
    indicators.push(...timeAnalysis.indicators);

    const confidence = this.calculateConfidence(
      indicators.length,
      messageAnalysis.confidence
    );

    const result = {
      detectedMood,
      confidence,
      indicators,
      reasoning: this.generateMoodDetectionReasoning(indicators, detectedMood),
    };

    // End performance monitoring
    this.performanceMonitor.endOperation(operationId, {
      success: true,
      additionalMetrics: {
        indicators_found: indicators.length,
        confidence_score: confidence,
        mood_energy: detectedMood.energy,
        mood_stress: detectedMood.stress,
      },
    });

    return result;
  }

  /**
   * Analyzes current emotional context and generates appropriate support
   */
  generateEmotionalContext(
    currentMood: MoodLevel,
    recentActivity: ActivityEvent[],
    appContext: AppContext
  ): EmotionalContext {
    const stressIndicators = this.detectStressIndicators(
      currentMood,
      recentActivity,
      appContext
    );
    const recentAchievements = this.identifyRecentAchievements(recentActivity);
    const supportNeeds = this.determineSupportNeeds(
      currentMood,
      stressIndicators,
      recentAchievements
    );

    return {
      currentMood,
      stressIndicators,
      recentAchievements,
      supportNeeds,
    };
  }

  /**
   * Generates supportive response based on emotional context
   */
  generateSupportiveResponse(
    emotionalContext: EmotionalContext,
    userMessage: string,
    appContext: AppContext
  ): SupportResponse {
    const tone = this.calculateEmotionalTone(emotionalContext);
    const message = this.generateSupportiveMessage(
      emotionalContext,
      userMessage,
      tone
    );
    const suggestedActions = this.generateSuggestedActions(
      emotionalContext,
      appContext
    );
    const followUpQuestions = this.generateFollowUpQuestions(emotionalContext);

    return {
      message,
      tone,
      suggestedActions,
      followUpQuestions,
      emotionalSupport: true,
    };
  }

  /**
   * Detects stress indicators from mood and activity patterns
   */
  private detectStressIndicators(
    mood: MoodLevel,
    recentActivity: ActivityEvent[],
    appContext: AppContext
  ): StressIndicator[] {
    const indicators: StressIndicator[] = [];

    // High stress level in mood
    if (mood.stress > 7) {
      indicators.push({
        type: 'fatigue',
        severity: mood.stress,
        description: 'High stress level detected in current mood',
        detectedAt: new Date(),
      });
    }

    // Low energy with high task load
    if (mood.energy < 4 && appContext.currentTask) {
      indicators.push({
        type: 'task_overload',
        severity: Math.max(1, 10 - mood.energy),
        description: 'Low energy with active tasks may indicate overload',
        detectedAt: new Date(),
      });
    }

    // Multiple incomplete tasks
    const incompleteTasks = recentActivity.filter(
      event =>
        event.type === 'task_created' &&
        !recentActivity.some(
          completionEvent =>
            completionEvent.type === 'task_completed' &&
            completionEvent.data.taskId === event.data.taskId
        )
    );

    if (incompleteTasks.length > 5) {
      indicators.push({
        type: 'task_overload',
        severity: Math.min(10, incompleteTasks.length),
        description: `${incompleteTasks.length} incomplete tasks may be causing stress`,
        detectedAt: new Date(),
      });
    }

    return indicators;
  }

  /**
   * Identifies recent achievements from activity events
   */
  private identifyRecentAchievements(
    recentActivity: ActivityEvent[]
  ): Achievement[] {
    const achievements: Achievement[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Task completions
    const recentCompletions = recentActivity.filter(
      event => event.type === 'task_completed' && event.timestamp >= oneDayAgo
    );

    if (recentCompletions.length > 0) {
      achievements.push({
        id: crypto.randomUUID(),
        type: 'task_completion',
        title: `Completed ${recentCompletions.length} task${recentCompletions.length > 1 ? 's' : ''}`,
        description: `You've completed ${recentCompletions.length} task${recentCompletions.length > 1 ? 's' : ''} today!`,
        significance: Math.min(10, recentCompletions.length * 2),
        achievedAt: now,
      });
    }

    // Focus sessions
    const focusSessions = recentActivity.filter(
      event => event.type === 'focus_ended' && event.timestamp >= oneDayAgo
    );

    if (focusSessions.length > 0) {
      achievements.push({
        id: crypto.randomUUID(),
        type: 'productivity_milestone',
        title: 'Focused Work Sessions',
        description: `You maintained focus through ${focusSessions.length} session${focusSessions.length > 1 ? 's' : ''} today`,
        significance: Math.min(10, focusSessions.length * 3),
        achievedAt: now,
      });
    }

    return achievements;
  }

  /**
   * Determines what type of support the user needs
   */
  private determineSupportNeeds(
    mood: MoodLevel,
    stressIndicators: StressIndicator[],
    achievements: Achievement[]
  ): SupportType[] {
    const supportNeeds: SupportType[] = [];

    // Celebration for achievements
    if (achievements.length > 0) {
      const totalSignificance = achievements.reduce(
        (sum, ach) => sum + ach.significance,
        0
      );
      supportNeeds.push({
        type: 'celebration',
        priority: Math.min(10, totalSignificance),
        message: 'Your recent achievements deserve recognition!',
        actionable: false,
      });
    }

    // Stress relief for high stress
    if (stressIndicators.some(indicator => indicator.severity > 6)) {
      supportNeeds.push({
        type: 'stress_relief',
        priority: 8,
        message: 'You seem to be under some stress. Let me help you manage it.',
        actionable: true,
        suggestedActions: [
          'Take a 5-minute break',
          'Try some deep breathing exercises',
          'Review and prioritize your tasks',
        ],
      });
    }

    // Encouragement for low motivation
    if (mood.motivation < 4) {
      supportNeeds.push({
        type: 'encouragement',
        priority: 6,
        message: 'Your motivation seems low. Remember why you started!',
        actionable: true,
        suggestedActions: [
          'Review your goals',
          'Start with a small, easy task',
          'Take a short energizing break',
        ],
      });
    }

    // Break suggestion for low energy
    if (mood.energy <= 3) {
      supportNeeds.push({
        type: 'break_suggestion',
        priority: 7,
        message: 'Your energy is running low. A break might help recharge.',
        actionable: true,
        suggestedActions: [
          'Take a 10-minute walk',
          'Have a healthy snack',
          'Do some light stretching',
        ],
      });
    }

    return supportNeeds.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyzes message sentiment for mood indicators
   */
  private analyzeMessageSentiment(message: string): {
    moodAdjustments: Partial<MoodLevel>;
    indicators: string[];
    confidence: number;
  } {
    const indicators: string[] = [];
    const moodAdjustments: Partial<MoodLevel> = {};
    let confidence = 0.5;

    const lowerMessage = message.toLowerCase();

    // Stress indicators
    const stressWords = [
      'stressed',
      'overwhelmed',
      'tired',
      'exhausted',
      'frustrated',
      'anxious',
    ];
    if (stressWords.some(word => lowerMessage.includes(word))) {
      moodAdjustments.stress = 8;
      moodAdjustments.energy = 3;
      indicators.push('Stress-related language detected');
      confidence += 0.2;
    }

    // Positive indicators
    const positiveWords = [
      'great',
      'awesome',
      'excited',
      'motivated',
      'energized',
      'focused',
      'feel great',
    ];
    if (positiveWords.some(word => lowerMessage.includes(word))) {
      moodAdjustments.motivation = 8;
      moodAdjustments.energy = 7;
      indicators.push('Positive language detected');
      confidence += 0.2;
    }

    // Fatigue indicators
    const fatigueWords = ['tired', 'sleepy', 'drained', 'worn out'];
    if (fatigueWords.some(word => lowerMessage.includes(word))) {
      moodAdjustments.energy = 2;
      moodAdjustments.focus = 3;
      indicators.push('Fatigue indicators in message');
      confidence += 0.15;
    }

    return { moodAdjustments, indicators, confidence: Math.min(1, confidence) };
  }

  /**
   * Analyzes task completion patterns for mood insights
   */
  private analyzeTaskPatterns(recentActivity: ActivityEvent[]): {
    indicators: string[];
    completionRate: number;
    taskLoad: number;
  } {
    const indicators: string[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = recentActivity.filter(
      event => event.timestamp >= oneDayAgo
    );
    const completions = recentEvents.filter(
      event => event.type === 'task_completed'
    );
    const creations = recentEvents.filter(
      event => event.type === 'task_created'
    );

    const completionRate =
      creations.length > 0 ? completions.length / creations.length : 0;
    const taskLoad = creations.length;

    if (completionRate > 0.8) {
      indicators.push('High task completion rate indicates good productivity');
    } else if (completionRate < 0.3) {
      indicators.push('Low task completion rate may indicate challenges');
    }

    if (taskLoad > 10) {
      indicators.push('High task creation rate may indicate heavy workload');
    }

    return { indicators, completionRate, taskLoad };
  }

  /**
   * Analyzes time context for energy patterns
   */
  private analyzeTimeContext(appContext: AppContext): {
    indicators: string[];
    energyPrediction: number;
  } {
    const indicators: string[] = [];
    // Use timeOfDay from context if available, otherwise current hour
    const timeStr =
      appContext.timeOfDay || new Date().toTimeString().slice(0, 5);
    const hour = parseInt(timeStr.split(':')[0]);
    let energyPrediction = 5;

    // Morning energy boost
    if (hour >= 6 && hour <= 10) {
      energyPrediction = 7;
      indicators.push('Morning hours typically associated with higher energy');
    }
    // Afternoon dip
    else if (hour >= 13 && hour <= 15) {
      energyPrediction = 4;
      indicators.push('Afternoon period often associated with energy dip');
    }
    // Evening wind-down
    else if (hour >= 18 && hour <= 22) {
      energyPrediction = 3;
      indicators.push('Evening hours typically associated with lower energy');
    }

    return { indicators, energyPrediction };
  }

  /**
   * Adjusts mood based on task analysis
   */
  private adjustMoodFromTaskAnalysis(
    mood: MoodLevel,
    analysis: { completionRate: number; taskLoad: number }
  ): MoodLevel {
    const adjusted = { ...mood };

    // High completion rate boosts motivation and reduces stress
    if (analysis.completionRate > 0.8) {
      adjusted.motivation = Math.min(10, adjusted.motivation + 2);
      adjusted.stress = Math.max(1, adjusted.stress - 1);
    }

    // High task load increases stress
    if (analysis.taskLoad > 10) {
      adjusted.stress = Math.min(10, adjusted.stress + 2);
    }

    return adjusted;
  }

  /**
   * Adjusts mood based on time analysis
   */
  private adjustMoodFromTimeAnalysis(
    mood: MoodLevel,
    analysis: { energyPrediction: number }
  ): MoodLevel {
    const adjusted = { ...mood };

    // Blend predicted energy with current mood, giving more weight to detected mood
    adjusted.energy = Math.round(
      adjusted.energy * 0.7 + analysis.energyPrediction * 0.3
    );

    return adjusted;
  }

  /**
   * Calculates confidence based on available indicators
   */
  private calculateConfidence(
    indicatorCount: number,
    baseConfidence: number
  ): number {
    const indicatorBonus = Math.min(0.4, indicatorCount * 0.1);
    return Math.min(100, Math.round((baseConfidence + indicatorBonus) * 100));
  }

  /**
   * Generates reasoning for mood detection
   */
  private generateMoodDetectionReasoning(
    indicators: string[],
    mood: MoodLevel
  ): string {
    let reasoning = 'Mood analysis based on: ';
    reasoning += indicators.join(', ');
    reasoning += `. Detected levels - Energy: ${mood.energy}/10, Focus: ${mood.focus}/10, `;
    reasoning += `Motivation: ${mood.motivation}/10, Stress: ${mood.stress}/10.`;
    return reasoning;
  }

  /**
   * Calculates appropriate emotional tone for responses
   */
  private calculateEmotionalTone(context: EmotionalContext): EmotionalTone {
    const { currentMood, recentAchievements } = context;

    let warmth = this.config.personalitySettings.warmth;
    let enthusiasm = this.config.personalitySettings.enthusiasm;
    let supportiveness = this.config.personalitySettings.supportiveness;
    let formality = 3; // Default to casual-friendly

    // Adjust based on mood
    if (currentMood.stress > 6) {
      warmth = Math.min(10, warmth + 2);
      supportiveness = Math.min(10, supportiveness + 3);
      enthusiasm = Math.max(1, enthusiasm - 2);
    }

    if (recentAchievements.length > 0) {
      enthusiasm = Math.min(10, enthusiasm + 3);
      warmth = Math.min(10, warmth + 1);
    }

    // Adjust based on interaction style
    switch (this.config.interactionStyle) {
      case 'professional':
        formality = 7;
        enthusiasm = Math.max(1, enthusiasm - 2);
        break;
      case 'casual':
        formality = 2;
        warmth = Math.min(10, warmth + 1);
        break;
      case 'friendly':
        formality = 4;
        warmth = Math.min(10, warmth + 2);
        break;
    }

    return { warmth, enthusiasm, supportiveness, formality };
  }

  /**
   * Generates supportive message based on context
   */
  private generateSupportiveMessage(
    context: EmotionalContext,
    _userMessage: string,
    tone: EmotionalTone
  ): string {
    const { currentMood, stressIndicators, recentAchievements } = context;

    let message = '';

    // Acknowledge achievements first
    if (recentAchievements.length > 0 && tone.enthusiasm > 6) {
      message += this.generateCelebrationMessage(recentAchievements, tone);
    }

    // Address stress or low mood
    if (stressIndicators.length > 0 || currentMood.stress > 6) {
      if (message) {
        message += ' ';
      }
      message += this.generateStressSupportMessage(stressIndicators, tone);
    }

    // Provide encouragement for low motivation
    if (currentMood.motivation < 4) {
      if (message) {
        message += ' ';
      }
      message += this.generateMotivationMessage(tone);
    }

    // Default supportive message if nothing specific
    if (!message) {
      message = this.generateDefaultSupportMessage(tone);
    }

    return message;
  }

  /**
   * Generates celebration message for achievements
   */
  private generateCelebrationMessage(
    achievements: Achievement[],
    tone: EmotionalTone
  ): string {
    const emoji = this.getEmojiForTone(tone, 'celebration');
    const enthusiasm = tone.enthusiasm > 7 ? 'Amazing work' : 'Great job';

    if (achievements.length === 1) {
      return `${enthusiasm}! ${achievements[0].description} ${emoji}`;
    } else {
      return `${enthusiasm}! You've been really productive today ${emoji}`;
    }
  }

  /**
   * Generates stress support message
   */
  private generateStressSupportMessage(
    _indicators: StressIndicator[],
    tone: EmotionalTone
  ): string {
    const emoji = this.getEmojiForTone(tone, 'support');

    if (tone.supportiveness > 7) {
      return `I can see you might be feeling some pressure right now ${emoji}. Remember, it's okay to take things one step at a time.`;
    } else {
      return `It looks like you have a lot on your plate. Let's work through this together ${emoji}`;
    }
  }

  /**
   * Generates motivation message
   */
  private generateMotivationMessage(tone: EmotionalTone): string {
    const emoji = this.getEmojiForTone(tone, 'encouragement');

    if (tone.warmth > 7) {
      return `I believe in you! Sometimes we all need a little boost to get going ${emoji}`;
    } else {
      return `You've got this! Let's find a way to get your momentum back ${emoji}`;
    }
  }

  /**
   * Generates default support message
   */
  private generateDefaultSupportMessage(tone: EmotionalTone): string {
    const emoji = this.getEmojiForTone(tone, 'general');

    if (tone.warmth > 6) {
      return `I'm here to help you stay productive and feel good about your work ${emoji}`;
    } else {
      return `Let me know how I can support you today ${emoji}`;
    }
  }

  /**
   * Gets appropriate emoji based on tone and context
   */
  private getEmojiForTone(_tone: EmotionalTone, context: string): string {
    if (this.config.emojiUsage === 'minimal') {
      return '';
    }

    const emojiMap: Record<string, string[]> = {
      celebration: ['🎉', '✨', '🌟', '👏'],
      support: ['🤗', '💪', '🌈', '☀️'],
      encouragement: ['💪', '🚀', '⭐', '🌟'],
      general: ['😊', '👍', '🙂', ''],
    };

    const options = emojiMap[context] || emojiMap.general;
    const intensity =
      this.config.emojiUsage === 'frequent'
        ? 0
        : this.config.emojiUsage === 'moderate'
          ? 1
          : 2;

    return options[Math.min(intensity, options.length - 1)];
  }

  /**
   * Generates suggested actions based on context
   */
  private generateSuggestedActions(
    context: EmotionalContext,
    appContext: AppContext
  ): string[] {
    const actions: string[] = [];

    // Add actions from support needs
    context.supportNeeds.forEach(need => {
      if (typeof need === 'object' && need.suggestedActions) {
        actions.push(...need.suggestedActions);
      }
    });

    // Add context-specific actions
    if (context.currentMood.energy < 4) {
      actions.push('Take a short break to recharge');
    }

    if (context.currentMood.focus < 4 && appContext.currentTask) {
      actions.push('Try a focused work session with the current task');
    }

    if (context.stressIndicators.length > 2) {
      actions.push('Review and prioritize your task list');
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Generates follow-up questions to engage the user
   */
  private generateFollowUpQuestions(context: EmotionalContext): string[] {
    const questions: string[] = [];

    if (context.currentMood.stress > 6) {
      questions.push(
        "What's been the most challenging part of your day so far?"
      );
      questions.push('Would you like help prioritizing your tasks?');
    }

    if (context.currentMood.motivation < 4) {
      questions.push('What usually helps you feel more motivated?');
      questions.push("Is there a particular goal you'd like to focus on?");
    }

    if (context.recentAchievements.length > 0) {
      questions.push('How are you feeling about your progress today?');
      questions.push('What would you like to tackle next?');
    }

    return questions.slice(0, 2); // Limit to 2 questions to avoid overwhelming
  }

  /**
   * Gets recent mood history for analysis
   */
  async getMoodHistory(days: number = 7): Promise<MoodEntry[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      return await this.repository.getMoodEntries(
        this.userId,
        cutoffDate,
        new Date()
      );
    } catch (error) {
      console.error('Failed to get mood history:', error);
      return [];
    }
  }

  /**
   * Analyzes mood patterns over time
   */
  async analyzeMoodPatterns(): Promise<EmotionalPattern[]> {
    const history = await this.getMoodHistory(30);
    const patterns: EmotionalPattern[] = [];

    if (history.length < 7) {
      return patterns; // Not enough data
    }

    // Daily mood pattern
    const dailyPattern = this.analyzeDailyMoodPattern(history);
    if (dailyPattern) {
      try {
        const storedPattern =
          await this.repository.storeEmotionalPattern(dailyPattern);
        patterns.push(storedPattern);
      } catch (error) {
        console.error('Failed to store daily pattern:', error);
        patterns.push(dailyPattern);
      }
    }

    // Stress trigger pattern
    const stressPattern = this.analyzeStressTriggerPattern(history);
    if (stressPattern) {
      try {
        const storedPattern =
          await this.repository.storeEmotionalPattern(stressPattern);
        patterns.push(storedPattern);
      } catch (error) {
        console.error('Failed to store stress pattern:', error);
        patterns.push(stressPattern);
      }
    }

    return patterns;
  }

  /**
   * Gets stored emotional patterns
   */
  async getStoredPatterns(
    patternType?: string,
    timeframe?: string
  ): Promise<EmotionalPattern[]> {
    try {
      return await this.repository.getEmotionalPatterns(
        this.userId,
        patternType,
        timeframe
      );
    } catch (error) {
      console.error('Failed to get stored patterns:', error);
      return [];
    }
  }

  /**
   * Gets mood statistics for analysis
   */
  async getMoodStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    averageMood: MoodLevel;
    moodTrends: { date: string; mood: MoodLevel }[];
    stressEvents: number;
    totalEntries: number;
  }> {
    try {
      return await this.repository.getMoodStatistics(
        this.userId,
        startDate,
        endDate
      );
    } catch (error) {
      console.error('Failed to get mood statistics:', error);
      return {
        averageMood: {
          energy: 5,
          focus: 5,
          motivation: 5,
          stress: 5,
          timestamp: new Date(),
        },
        moodTrends: [],
        stressEvents: 0,
        totalEntries: 0,
      };
    }
  }

  /**
   * Cleans up old mood entries
   */
  async cleanupOldEntries(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      return await this.repository.deleteOldMoodEntries(
        this.userId,
        cutoffDate
      );
    } catch (error) {
      console.error('Failed to cleanup old mood entries:', error);
      return 0;
    }
  }

  /**
   * Analyzes daily mood patterns
   */
  private analyzeDailyMoodPattern(
    history: MoodEntry[]
  ): EmotionalPattern | null {
    const hourlyMoods: Record<number, MoodLevel[]> = {};

    history.forEach(entry => {
      const hour = entry.createdAt.getHours();
      if (!hourlyMoods[hour]) {
        hourlyMoods[hour] = [];
      }
      hourlyMoods[hour].push(entry.mood);
    });

    const hourlyAverages: Record<number, MoodLevel> = {};
    let totalEntries = 0;

    Object.entries(hourlyMoods).forEach(([hour, moods]) => {
      if (moods.length >= 3) {
        // Require at least 3 data points
        const avg = this.calculateAverageMood(moods);
        hourlyAverages[parseInt(hour)] = avg;
        totalEntries += moods.length;
      }
    });

    if (Object.keys(hourlyAverages).length < 3) {
      return null; // Not enough data points
    }

    return {
      id: crypto.randomUUID(),
      userId: this.userId,
      patternType: 'daily_mood',
      timeframe: 'daily',
      data: { hourlyAverages },
      confidence: Math.min(100, (totalEntries / history.length) * 100),
      lastUpdated: new Date(),
    };
  }

  /**
   * Analyzes stress trigger patterns
   */
  private analyzeStressTriggerPattern(
    history: MoodEntry[]
  ): EmotionalPattern | null {
    const stressfulEntries = history.filter(entry => entry.mood.stress > 6);

    if (stressfulEntries.length < 3) {
      return null;
    }

    const triggers: Record<string, number> = {};

    stressfulEntries.forEach(entry => {
      if (entry.context?.activityType) {
        triggers[entry.context.activityType] =
          (triggers[entry.context.activityType] || 0) + 1;
      }
    });

    return {
      id: crypto.randomUUID(),
      userId: this.userId,
      patternType: 'stress_triggers',
      timeframe: 'weekly',
      data: { triggers, totalStressfulEvents: stressfulEntries.length },
      confidence: Math.min(
        100,
        (stressfulEntries.length / history.length) * 100
      ),
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculates average mood from multiple entries
   */
  private calculateAverageMood(moods: MoodLevel[]): MoodLevel {
    const sum = moods.reduce(
      (acc, mood) => ({
        energy: acc.energy + mood.energy,
        focus: acc.focus + mood.focus,
        motivation: acc.motivation + mood.motivation,
        stress: acc.stress + mood.stress,
      }),
      { energy: 0, focus: 0, motivation: 0, stress: 0 }
    );

    const count = moods.length;
    return {
      energy: Math.round(sum.energy / count),
      focus: Math.round(sum.focus / count),
      motivation: Math.round(sum.motivation / count),
      stress: Math.round(sum.stress / count),
      timestamp: new Date(),
    };
  }
}
