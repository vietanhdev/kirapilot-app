import { AIInteractionLog, DataClassification } from '../../types/aiLogging';

/**
 * Patterns for detecting sensitive data in text
 */
const SENSITIVE_DATA_PATTERNS = {
  // Personal Identifiable Information (PII)
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // API Keys and Tokens (more specific patterns)
  apiKey: /\b(?:sk-|pk-|rk-)[A-Za-z0-9]{20,}\b/g,
  bearerToken: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  jwtToken: /eyJ[A-Za-z0-9\-._~+/]+=*/g,

  // Common secret patterns (more specific)
  password: /(?:password|pwd|pass)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  secret: /(?:secret)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,

  // File paths that might contain sensitive info
  homePath: /\/Users\/[^\/\s]+/g,
  windowsPath: /C:\\Users\\[^\\s]+/g,

  // IP addresses
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,

  // Database connection strings
  dbConnection: /(?:mongodb|mysql|postgres|sqlite):\/\/[^\s]+/gi,
};

/**
 * Keywords that indicate potentially sensitive content (only standalone words)
 */
const SENSITIVE_KEYWORDS = [
  'confidential',
  'classified',
  'restricted',
  'ssn',
  'social security',
  'credit card',
  'bank account',
];

/**
 * Classification keywords for different data types
 */
const CLASSIFICATION_KEYWORDS = {
  confidential: [
    'password',
    'secret',
    'private key',
    'credential',
    'ssn',
    'social security',
    'credit card',
    'bank account',
    'personal',
    'confidential',
    'sensitive',
    'api key',
    'access token',
    'classified',
    'restricted',
  ],
  internal: [
    'project',
    'task',
    'meeting',
    'team',
    'company',
    'internal',
    'business',
    'strategy',
    'plan',
    'budget',
    'revenue',
  ],
  public: [
    'documentation',
    'tutorial',
    'example',
    'demo',
    'public',
    'open source',
    'community',
    'help',
    'support',
  ],
};

export interface SensitiveDataMatch {
  type: string;
  match: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PrivacyAnalysis {
  containsSensitiveData: boolean;
  dataClassification: DataClassification;
  sensitiveMatches: SensitiveDataMatch[];
  confidenceScore: number;
}

/**
 * Service for detecting and filtering sensitive data in AI interactions
 */
export class PrivacyFilter {
  /**
   * Analyze text for sensitive data and classify it
   */
  analyzeText(text: string): PrivacyAnalysis {
    const sensitiveMatches = this.detectSensitiveData(text);
    const dataClassification = this.classifyData(text, sensitiveMatches);
    const containsSensitiveData = sensitiveMatches.length > 0;
    const confidenceScore = this.calculateConfidenceScore(
      text,
      sensitiveMatches
    );

    return {
      containsSensitiveData,
      dataClassification,
      sensitiveMatches,
      confidenceScore,
    };
  }

  /**
   * Analyze an entire AI interaction log for sensitive data
   */
  analyzeInteractionLog(log: AIInteractionLog): PrivacyAnalysis {
    const textToAnalyze = [
      log.userMessage,
      log.aiResponse,
      log.systemPrompt || '',
      log.reasoning || '',
      typeof log.context === 'string'
        ? log.context
        : JSON.stringify(log.context),
      typeof log.actions === 'string'
        ? log.actions
        : JSON.stringify(log.actions),
      typeof log.suggestions === 'string'
        ? log.suggestions
        : JSON.stringify(log.suggestions),
      ...log.toolCalls.map(tc => {
        const args =
          typeof tc.arguments === 'string'
            ? tc.arguments
            : JSON.stringify(tc.arguments);
        const result =
          typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result);
        return args + ' ' + result;
      }),
    ].join(' ');

    return this.analyzeText(textToAnalyze);
  }

  /**
   * Redact sensitive data from text
   */
  redactText(text: string, preserveFormat = true): string {
    let redactedText = text;
    const matches = this.detectSensitiveData(text);

    // Sort matches by position (descending) to avoid index shifting
    matches.sort((a, b) => b.start - a.start);

    for (const match of matches) {
      const replacement = preserveFormat
        ? this.createRedactionReplacement(match.match, match.type)
        : '[REDACTED]';

      redactedText =
        redactedText.substring(0, match.start) +
        replacement +
        redactedText.substring(match.end);
    }

    return redactedText;
  }

  /**
   * Redact sensitive data from an AI interaction log
   */
  redactInteractionLog(log: AIInteractionLog): AIInteractionLog {
    // If the log is marked as containing sensitive data, redact the main content entirely
    const shouldRedactCompletely =
      log.containsSensitiveData || log.dataClassification === 'confidential';

    const redactedLog: AIInteractionLog = {
      ...log,
      userMessage: shouldRedactCompletely
        ? '[REDACTED - SENSITIVE DATA]'
        : this.redactText(log.userMessage),
      aiResponse: shouldRedactCompletely
        ? '[REDACTED - SENSITIVE DATA]'
        : this.redactText(log.aiResponse),
      systemPrompt: log.systemPrompt
        ? shouldRedactCompletely
          ? '[REDACTED - SENSITIVE DATA]'
          : this.redactText(log.systemPrompt)
        : undefined,
      reasoning: log.reasoning
        ? shouldRedactCompletely
          ? '[REDACTED - SENSITIVE DATA]'
          : this.redactText(log.reasoning)
        : undefined,
      context:
        typeof log.context === 'string'
          ? this.redactText(log.context)
          : JSON.stringify(this.redactObject(log.context)),
      actions:
        typeof log.actions === 'string'
          ? this.redactText(log.actions)
          : JSON.stringify(
              this.safeJsonParse(log.actions, []).map(action =>
                this.redactObject(action)
              )
            ),
      suggestions:
        typeof log.suggestions === 'string'
          ? this.redactText(log.suggestions)
          : JSON.stringify(
              this.safeJsonParse(log.suggestions, []).map(suggestion =>
                this.redactObject(suggestion)
              )
            ),
      toolCalls: log.toolCalls.map(tc => ({
        ...tc,
        arguments:
          typeof tc.arguments === 'string'
            ? this.redactText(tc.arguments)
            : JSON.stringify(this.redactObject(tc.arguments)),
        result:
          typeof tc.result === 'string'
            ? this.redactText(tc.result)
            : JSON.stringify(this.redactObject(tc.result)),
      })),
    };

    return redactedLog;
  }

  /**
   * Anonymize log data by removing identifying information
   */
  anonymizeInteractionLog(log: AIInteractionLog): AIInteractionLog {
    const anonymizedLog: AIInteractionLog = {
      ...log,
      id: this.generateAnonymousId(),
      sessionId: this.generateAnonymousId(),
      userMessage: this.anonymizeText(log.userMessage),
      aiResponse: this.anonymizeText(log.aiResponse),
      systemPrompt: log.systemPrompt
        ? this.anonymizeText(log.systemPrompt)
        : undefined,
      reasoning: log.reasoning ? this.anonymizeText(log.reasoning) : undefined,
      context:
        typeof log.context === 'string'
          ? this.anonymizeText(log.context)
          : JSON.stringify(this.anonymizeObject(log.context)),
      actions:
        typeof log.actions === 'string'
          ? this.anonymizeText(log.actions)
          : JSON.stringify(
              this.safeJsonParse(log.actions, []).map(action =>
                this.anonymizeObject(action)
              )
            ),
      suggestions:
        typeof log.suggestions === 'string'
          ? this.anonymizeText(log.suggestions)
          : JSON.stringify(
              this.safeJsonParse(log.suggestions, []).map(suggestion =>
                this.anonymizeObject(suggestion)
              )
            ),
      toolCalls: log.toolCalls.map(tc => ({
        ...tc,
        arguments:
          typeof tc.arguments === 'string'
            ? this.anonymizeText(tc.arguments)
            : JSON.stringify(this.anonymizeObject(tc.arguments)),
        result:
          typeof tc.result === 'string'
            ? this.anonymizeText(tc.result)
            : JSON.stringify(this.anonymizeObject(tc.result)),
      })),
    };

    return anonymizedLog;
  }

  /**
   * Check if export should be filtered based on privacy settings
   */
  shouldFilterForExport(
    log: AIInteractionLog,
    includeConfidential = false
  ): boolean {
    if (!includeConfidential && log.dataClassification === 'confidential') {
      return true;
    }

    if (log.containsSensitiveData && !includeConfidential) {
      return true;
    }

    return false;
  }

  /**
   * Detect sensitive data patterns in text
   */
  private detectSensitiveData(text: string): SensitiveDataMatch[] {
    const matches: SensitiveDataMatch[] = [];

    // Check regex patterns in order of specificity (most specific first)
    const orderedPatterns = [
      ['bearerToken', SENSITIVE_DATA_PATTERNS.bearerToken],
      ['jwtToken', SENSITIVE_DATA_PATTERNS.jwtToken],
      ['apiKey', SENSITIVE_DATA_PATTERNS.apiKey], // Check API keys early
      ['email', SENSITIVE_DATA_PATTERNS.email],
      ['creditCard', SENSITIVE_DATA_PATTERNS.creditCard],
      ['ssn', SENSITIVE_DATA_PATTERNS.ssn],
      ['password', SENSITIVE_DATA_PATTERNS.password],
      ['secret', SENSITIVE_DATA_PATTERNS.secret],
      ['dbConnection', SENSITIVE_DATA_PATTERNS.dbConnection],
      ['homePath', SENSITIVE_DATA_PATTERNS.homePath],
      ['windowsPath', SENSITIVE_DATA_PATTERNS.windowsPath],
      ['ipAddress', SENSITIVE_DATA_PATTERNS.ipAddress],
      ['phone', SENSITIVE_DATA_PATTERNS.phone],
    ] as const;

    for (const [type, pattern] of orderedPatterns) {
      const regexMatches = Array.from(text.matchAll(pattern));
      for (const match of regexMatches) {
        if (match.index !== undefined) {
          // Check if this match overlaps with existing matches
          const overlaps = matches.some(
            existing =>
              (match.index! >= existing.start && match.index! < existing.end) ||
              (match.index! + match[0].length > existing.start &&
                match.index! < existing.start)
          );

          if (!overlaps) {
            matches.push({
              type,
              match: match[0],
              start: match.index,
              end: match.index + match[0].length,
              confidence: this.calculatePatternConfidence(type, match[0]),
            });
          }
        }
      }
    }

    // Check for sensitive keywords (only if no high-confidence patterns found)
    const hasHighConfidenceMatches = matches.some(m => m.confidence > 0.7);
    if (!hasHighConfidenceMatches) {
      const lowerText = text.toLowerCase();
      for (const keyword of SENSITIVE_KEYWORDS) {
        const index = lowerText.indexOf(keyword);
        if (index !== -1) {
          // Check if this keyword overlaps with existing matches
          const overlaps = matches.some(
            existing =>
              (index >= existing.start && index < existing.end) ||
              (index + keyword.length > existing.start &&
                index < existing.start)
          );

          if (!overlaps) {
            matches.push({
              type: 'keyword',
              match: keyword,
              start: index,
              end: index + keyword.length,
              confidence: 0.4, // Lower confidence for keywords
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Classify data based on content analysis
   */
  private classifyData(
    text: string,
    sensitiveMatches: SensitiveDataMatch[]
  ): DataClassification {
    const lowerText = text.toLowerCase();

    // Check for confidential indicators
    const confidentialScore = CLASSIFICATION_KEYWORDS.confidential.reduce(
      (score, keyword) => score + (lowerText.includes(keyword) ? 1 : 0),
      0
    );

    // Check for internal indicators
    const internalScore = CLASSIFICATION_KEYWORDS.internal.reduce(
      (score, keyword) => score + (lowerText.includes(keyword) ? 1 : 0),
      0
    );

    // Check for public indicators
    const publicScore = CLASSIFICATION_KEYWORDS.public.reduce(
      (score, keyword) => score + (lowerText.includes(keyword) ? 1 : 0),
      0
    );

    // High-confidence sensitive data patterns indicate confidential
    const highConfidenceSensitive = sensitiveMatches.some(
      match => match.confidence > 0.8
    );
    if (highConfidenceSensitive) {
      return 'confidential';
    }

    // Multiple confidential keywords (3 or more) indicate confidential
    if (confidentialScore >= 3) {
      return 'confidential';
    }

    // Moderate sensitive data or internal keywords indicate internal
    if (sensitiveMatches.length > 0 || internalScore > publicScore) {
      return 'internal';
    }

    // Default to public if no sensitive indicators
    return 'public';
  }

  /**
   * Calculate confidence score for privacy analysis
   */
  private calculateConfidenceScore(
    text: string,
    matches: SensitiveDataMatch[]
  ): number {
    if (matches.length === 0) {
      return 0;
    }

    const avgConfidence =
      matches.reduce((sum, match) => sum + match.confidence, 0) /
      matches.length;
    const matchDensity = Math.min(matches.length / (text.length / 100), 1.0); // matches per 100 characters, capped at 1

    // Weight average confidence more heavily than density
    return Math.min(avgConfidence * 0.8 + matchDensity * 0.2, 1.0);
  }

  /**
   * Calculate confidence for a specific pattern match
   */
  private calculatePatternConfidence(type: string, match: string): number {
    switch (type) {
      case 'email':
        return match.includes('@') && match.includes('.') ? 0.9 : 0.6;
      case 'phone':
        return match.replace(/\D/g, '').length === 10 ? 0.9 : 0.7;
      case 'ssn':
        return match.replace(/\D/g, '').length === 9 ? 0.95 : 0.7;
      case 'creditCard':
        return match.replace(/\D/g, '').length >= 13 ? 0.9 : 0.6;
      case 'apiKey':
        return match.length >= 32 ? 0.8 : 0.5;
      case 'bearerToken':
      case 'jwtToken':
        return 0.9;
      case 'password':
      case 'secret':
        return 0.8;
      default:
        return 0.6;
    }
  }

  /**
   * Create appropriate redaction replacement
   */
  private createRedactionReplacement(_original: string, type: string): string {
    switch (type) {
      case 'email':
        return '[EMAIL_REDACTED]';
      case 'phone':
        return '[PHONE_REDACTED]';
      case 'ssn':
        return '[SSN_REDACTED]';
      case 'creditCard':
        return '[CARD_REDACTED]';
      case 'apiKey':
        return '[API_KEY_REDACTED]';
      case 'bearerToken':
        return '[TOKEN_REDACTED]';
      case 'jwtToken':
        return '[JWT_REDACTED]';
      case 'password':
        return '[PASSWORD_REDACTED]';
      case 'secret':
        return '[SECRET_REDACTED]';
      case 'homePath':
      case 'windowsPath':
        return '[PATH_REDACTED]';
      case 'ipAddress':
        return '[IP_REDACTED]';
      case 'dbConnection':
        return '[DB_CONNECTION_REDACTED]';
      default:
        return '[REDACTED]';
    }
  }

  /**
   * Redact sensitive data from objects
   */
  private redactObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.redactText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    if (obj && typeof obj === 'object') {
      const redacted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        redacted[key] = this.redactObject(value);
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Anonymize text by replacing identifying information with generic placeholders
   */
  private anonymizeText(text: string): string {
    let anonymized = text;

    // Replace names with generic placeholders
    anonymized = anonymized.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]');

    // Replace specific identifiers with generic ones
    anonymized = anonymized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL]'
    );
    anonymized = anonymized.replace(
      /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      '[PHONE]'
    );

    // Replace dates with generic placeholders
    anonymized = anonymized.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE]');
    anonymized = anonymized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]');

    return anonymized;
  }

  /**
   * Anonymize objects recursively
   */
  private anonymizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.anonymizeText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.anonymizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const anonymized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        anonymized[key] = this.anonymizeObject(value);
      }
      return anonymized;
    }

    return obj;
  }

  /**
   * Safely parse JSON string, returning default value on error
   */
  private safeJsonParse<T>(jsonString: string, defaultValue: T): T {
    try {
      if (!jsonString || jsonString.trim() === '') {
        return defaultValue;
      }
      return JSON.parse(jsonString) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Generate anonymous ID for anonymized logs
   */
  private generateAnonymousId(): string {
    return 'anon_' + Math.random().toString(36).substr(2, 9);
  }
}

export const privacyFilter = new PrivacyFilter();
