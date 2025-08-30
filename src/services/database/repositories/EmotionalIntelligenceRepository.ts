// Emotional Intelligence repository for storing mood and emotional data
import { invoke } from '@tauri-apps/api/core';
import {
  MoodEntry,
  EmotionalPattern,
  EmotionalIntelligenceConfig,
  MoodLevel,
} from '../../../types';

export class EmotionalIntelligenceRepository {
  /**
   * Store a mood entry in the database
   */
  async storeMoodEntry(entry: MoodEntry): Promise<MoodEntry> {
    try {
      const serializedEntry = {
        id: entry.id,
        user_id: entry.userId,
        energy: entry.mood.energy,
        focus: entry.mood.focus,
        motivation: entry.mood.motivation,
        stress: entry.mood.stress,
        mood_timestamp: entry.mood.timestamp.toISOString(),
        notes: entry.notes,
        context_task_id: entry.context?.taskId,
        context_session_id: entry.context?.sessionId,
        context_activity_type: entry.context?.activityType,
        created_at: entry.createdAt.toISOString(),
      };

      const result = await invoke('create_mood_entry', {
        entry: serializedEntry,
      });
      return this.deserializeMoodEntry(result as Record<string, unknown>);
    } catch (error) {
      console.error('Failed to store mood entry:', error);
      throw new Error('Failed to store mood entry');
    }
  }

  /**
   * Get mood entries for a user within a date range
   */
  async getMoodEntries(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<MoodEntry[]> {
    try {
      const result = await invoke('get_mood_entries', {
        userId,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        limit,
      });

      return (result as Record<string, unknown>[]).map(entry =>
        this.deserializeMoodEntry(entry)
      );
    } catch (error) {
      console.error('Failed to get mood entries:', error);
      throw new Error('Failed to get mood entries');
    }
  }

  /**
   * Get the most recent mood entry for a user
   */
  async getLatestMoodEntry(userId: string): Promise<MoodEntry | null> {
    try {
      const result = await invoke('get_latest_mood_entry', { userId });
      return result
        ? this.deserializeMoodEntry(result as Record<string, unknown>)
        : null;
    } catch (error) {
      console.error('Failed to get latest mood entry:', error);
      throw new Error('Failed to get latest mood entry');
    }
  }

  /**
   * Store an emotional pattern
   */
  async storeEmotionalPattern(
    pattern: EmotionalPattern
  ): Promise<EmotionalPattern> {
    try {
      const serializedPattern = {
        id: pattern.id,
        user_id: pattern.userId,
        pattern_type: pattern.patternType,
        timeframe: pattern.timeframe,
        data: JSON.stringify(pattern.data),
        confidence: pattern.confidence,
        last_updated: pattern.lastUpdated.toISOString(),
      };

      const result = await invoke('create_emotional_pattern', {
        pattern: serializedPattern,
      });
      return this.deserializeEmotionalPattern(
        result as Record<string, unknown>
      );
    } catch (error) {
      console.error('Failed to store emotional pattern:', error);
      throw new Error('Failed to store emotional pattern');
    }
  }

  /**
   * Get emotional patterns for a user
   */
  async getEmotionalPatterns(
    userId: string,
    patternType?: string,
    timeframe?: string
  ): Promise<EmotionalPattern[]> {
    try {
      const result = await invoke('get_emotional_patterns', {
        userId,
        patternType,
        timeframe,
      });

      return (result as Record<string, unknown>[]).map(pattern =>
        this.deserializeEmotionalPattern(pattern)
      );
    } catch (error) {
      console.error('Failed to get emotional patterns:', error);
      throw new Error('Failed to get emotional patterns');
    }
  }

  /**
   * Update an emotional pattern
   */
  async updateEmotionalPattern(
    id: string,
    updates: Partial<EmotionalPattern>
  ): Promise<EmotionalPattern> {
    try {
      const serializedUpdates = {
        pattern_type: updates.patternType,
        timeframe: updates.timeframe,
        data: updates.data ? JSON.stringify(updates.data) : undefined,
        confidence: updates.confidence,
        last_updated: updates.lastUpdated?.toISOString(),
      };

      const result = await invoke('update_emotional_pattern', {
        id,
        updates: serializedUpdates,
      });

      return this.deserializeEmotionalPattern(
        result as Record<string, unknown>
      );
    } catch (error) {
      console.error('Failed to update emotional pattern:', error);
      throw new Error('Failed to update emotional pattern');
    }
  }

  /**
   * Delete old mood entries (for cleanup)
   */
  async deleteOldMoodEntries(userId: string, olderThan: Date): Promise<number> {
    try {
      const result = await invoke('delete_old_mood_entries', {
        userId,
        olderThan: olderThan.toISOString(),
      });

      return result as number;
    } catch (error) {
      console.error('Failed to delete old mood entries:', error);
      throw new Error('Failed to delete old mood entries');
    }
  }

  /**
   * Store emotional intelligence configuration
   */
  async storeConfig(
    userId: string,
    config: EmotionalIntelligenceConfig
  ): Promise<void> {
    try {
      const serializedConfig = {
        user_id: userId,
        enabled: config.enabled,
        daily_mood_tracking: config.dailyMoodTracking,
        stress_detection: config.stressDetection,
        encouragement_frequency: config.encouragementFrequency,
        celebration_style: config.celebrationStyle,
        personality_warmth: config.personalitySettings.warmth,
        personality_enthusiasm: config.personalitySettings.enthusiasm,
        personality_supportiveness: config.personalitySettings.supportiveness,
        personality_humor: config.personalitySettings.humor,
        interaction_style: config.interactionStyle,
        emoji_usage: config.emojiUsage,
      };

      await invoke('store_emotional_intelligence_config', {
        config: serializedConfig,
      });
    } catch (error) {
      console.error('Failed to store emotional intelligence config:', error);
      throw new Error('Failed to store emotional intelligence config');
    }
  }

  /**
   * Get emotional intelligence configuration
   */
  async getConfig(userId: string): Promise<EmotionalIntelligenceConfig | null> {
    try {
      const result = await invoke('get_emotional_intelligence_config', {
        userId,
      });

      if (!result) {
        return null;
      }

      const config = result as Record<string, unknown>;
      return {
        enabled: config.enabled as boolean,
        dailyMoodTracking: config.daily_mood_tracking as boolean,
        stressDetection: config.stress_detection as boolean,
        encouragementFrequency: config.encouragement_frequency as
          | 'low'
          | 'medium'
          | 'high',
        celebrationStyle: config.celebration_style as 'subtle' | 'enthusiastic',
        personalitySettings: {
          warmth: config.personality_warmth as number,
          enthusiasm: config.personality_enthusiasm as number,
          supportiveness: config.personality_supportiveness as number,
          humor: config.personality_humor as number,
        },
        interactionStyle: config.interaction_style as
          | 'casual'
          | 'professional'
          | 'friendly',
        emojiUsage: config.emoji_usage as 'minimal' | 'moderate' | 'frequent',
      };
    } catch (error) {
      console.error('Failed to get emotional intelligence config:', error);
      throw new Error('Failed to get emotional intelligence config');
    }
  }

  /**
   * Get mood statistics for a user
   */
  async getMoodStatistics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    averageMood: MoodLevel;
    moodTrends: { date: string; mood: MoodLevel }[];
    stressEvents: number;
    totalEntries: number;
  }> {
    try {
      const result = await invoke('get_mood_statistics', {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const stats = result as Record<string, unknown>;
      return {
        averageMood: {
          energy: stats.average_energy as number,
          focus: stats.average_focus as number,
          motivation: stats.average_motivation as number,
          stress: stats.average_stress as number,
          timestamp: new Date(),
        },
        moodTrends: (stats.mood_trends as Array<Record<string, unknown>>).map(
          trend => ({
            date: trend.date as string,
            mood: {
              energy: trend.energy as number,
              focus: trend.focus as number,
              motivation: trend.motivation as number,
              stress: trend.stress as number,
              timestamp: new Date(trend.date as string),
            },
          })
        ),
        stressEvents: stats.stress_events as number,
        totalEntries: stats.total_entries as number,
      };
    } catch (error) {
      console.error('Failed to get mood statistics:', error);
      throw new Error('Failed to get mood statistics');
    }
  }

  /**
   * Deserialize mood entry from database format
   */
  private deserializeMoodEntry(entry: Record<string, unknown>): MoodEntry {
    return {
      id: entry.id as string,
      userId: entry.user_id as string,
      mood: {
        energy: entry.energy as number,
        focus: entry.focus as number,
        motivation: entry.motivation as number,
        stress: entry.stress as number,
        timestamp: new Date(entry.mood_timestamp as string),
      },
      notes: entry.notes as string | undefined,
      context:
        entry.context_task_id ||
        entry.context_session_id ||
        entry.context_activity_type
          ? {
              taskId: entry.context_task_id as string | undefined,
              sessionId: entry.context_session_id as string | undefined,
              activityType: entry.context_activity_type as string | undefined,
            }
          : undefined,
      createdAt: new Date(entry.created_at as string),
    };
  }

  /**
   * Deserialize emotional pattern from database format
   */
  private deserializeEmotionalPattern(
    pattern: Record<string, unknown>
  ): EmotionalPattern {
    return {
      id: pattern.id as string,
      userId: pattern.user_id as string,
      patternType: pattern.pattern_type as
        | 'daily_mood'
        | 'stress_triggers'
        | 'productivity_correlation'
        | 'energy_cycles',
      timeframe: pattern.timeframe as 'daily' | 'weekly' | 'monthly',
      data: JSON.parse(pattern.data as string),
      confidence: pattern.confidence as number,
      lastUpdated: new Date(pattern.last_updated as string),
    };
  }
}
