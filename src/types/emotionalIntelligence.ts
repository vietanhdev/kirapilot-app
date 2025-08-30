// Emotional Intelligence types for KiraPilot AI
import type { MoodLevel } from './aiLogging';

export interface StressIndicator {
  type:
    | 'task_overload'
    | 'time_pressure'
    | 'complexity'
    | 'interruptions'
    | 'fatigue';
  severity: number; // 1-10 scale
  description: string;
  detectedAt: Date;
}

export interface Achievement {
  id: string;
  type:
    | 'task_completion'
    | 'goal_reached'
    | 'streak'
    | 'productivity_milestone';
  title: string;
  description: string;
  significance: number; // 1-10 scale
  achievedAt: Date;
}

export interface SupportType {
  type:
    | 'encouragement'
    | 'break_suggestion'
    | 'task_prioritization'
    | 'stress_relief'
    | 'celebration';
  priority: number; // 1-10 scale
  message: string;
  actionable: boolean;
  suggestedActions?: string[];
}

export interface EmotionalTone {
  warmth: number; // 1-10 scale
  enthusiasm: number; // 1-10 scale
  supportiveness: number; // 1-10 scale
  formality: number; // 1-10 scale (1 = very casual, 10 = very formal)
}

export interface MoodEntry {
  id: string;
  userId: string;
  mood: MoodLevel;
  notes?: string;
  context?: {
    taskId?: string;
    sessionId?: string;
    activityType?: string;
  };
  createdAt: Date;
}

export interface EmotionalPattern {
  id: string;
  userId: string;
  patternType:
    | 'daily_mood'
    | 'stress_triggers'
    | 'productivity_correlation'
    | 'energy_cycles';
  timeframe: 'daily' | 'weekly' | 'monthly';
  data: Record<string, unknown>;
  confidence: number; // 0-100
  lastUpdated: Date;
}

export interface SupportResponse {
  message: string;
  tone: EmotionalTone;
  suggestedActions: string[];
  followUpQuestions?: string[];
  emotionalSupport: boolean;
}

export interface MoodDetectionResult {
  detectedMood: MoodLevel;
  confidence: number; // 0-100
  indicators: string[];
  reasoning: string;
}

export interface EmotionalIntelligenceConfig {
  enabled: boolean;
  dailyMoodTracking: boolean;
  stressDetection: boolean;
  encouragementFrequency: 'low' | 'medium' | 'high';
  celebrationStyle: 'subtle' | 'enthusiastic';
  personalitySettings: {
    warmth: number; // 1-10
    enthusiasm: number; // 1-10
    supportiveness: number; // 1-10
    humor: number; // 1-10
  };
  interactionStyle: 'casual' | 'professional' | 'friendly';
  emojiUsage: 'minimal' | 'moderate' | 'frequent';
}
