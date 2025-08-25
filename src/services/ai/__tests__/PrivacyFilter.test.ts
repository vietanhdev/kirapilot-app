import { PrivacyFilter } from '../PrivacyFilter';
import { AIInteractionLog, DataClassification } from '../../../types/aiLogging';

describe('PrivacyFilter', () => {
  let privacyFilter: PrivacyFilter;

  beforeEach(() => {
    privacyFilter = new PrivacyFilter();
  });

  describe('analyzeText', () => {
    it('should detect email addresses', () => {
      const text = 'Contact me at john.doe@example.com for more info';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches).toHaveLength(1);
      expect(analysis.sensitiveMatches[0].type).toBe('email');
      expect(analysis.sensitiveMatches[0].match).toBe('john.doe@example.com');
    });

    it('should detect phone numbers', () => {
      const text = 'Call me at (555) 123-4567';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches).toHaveLength(1);
      expect(analysis.sensitiveMatches[0].type).toBe('phone');
    });

    it('should detect API keys', () => {
      const text = 'Use this API key: sk-1234567890abcdef1234567890abcdef';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'apiKey')).toBe(
        true
      );
    });

    it('should detect Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(
        analysis.sensitiveMatches.some(m => m.type === 'bearerToken')
      ).toBe(true);
    });

    it('should detect password patterns', () => {
      const text = 'password: mySecretPassword123';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'password')).toBe(
        true
      );
    });

    it('should detect SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'ssn')).toBe(true);
    });

    it('should detect credit card numbers', () => {
      const text = 'Card: 4532 1234 5678 9012';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'creditCard')).toBe(
        true
      );
    });

    it('should detect file paths', () => {
      const text = 'File located at /Users/john/Documents/secret.txt';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'homePath')).toBe(
        true
      );
    });

    it('should detect IP addresses', () => {
      const text = 'Server IP: 192.168.1.100';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'ipAddress')).toBe(
        true
      );
    });

    it('should return no matches for clean text', () => {
      const text = 'This is a simple message about weather';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.containsSensitiveData).toBe(false);
      expect(analysis.sensitiveMatches).toHaveLength(0);
    });
  });

  describe('data classification', () => {
    it('should classify as confidential when sensitive data is present', () => {
      const text = 'My password is secret123 and my SSN is 123-45-6789';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.dataClassification).toBe('confidential');
    });

    it('should classify as internal for business content', () => {
      const text = 'Our team project meeting is scheduled for next week';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.dataClassification).toBe('internal');
    });

    it('should classify as public for general content', () => {
      const text = 'This is public documentation about our open source project';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.dataClassification).toBe('public');
    });

    it('should classify as confidential for multiple confidential keywords', () => {
      const text =
        'This document is confidential classified restricted and contains sensitive data';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.dataClassification).toBe('confidential');
    });
  });

  describe('redactText', () => {
    it('should redact email addresses', () => {
      const text = 'Contact john.doe@example.com for help';
      const redacted = privacyFilter.redactText(text);

      expect(redacted).toBe('Contact [EMAIL_REDACTED] for help');
    });

    it('should redact phone numbers', () => {
      const text = 'Call (555) 123-4567';
      const redacted = privacyFilter.redactText(text);

      expect(redacted).toBe('Call [PHONE_REDACTED]');
    });

    it('should redact API keys', () => {
      const text = 'API key: sk-1234567890abcdef1234567890abcdef';
      const redacted = privacyFilter.redactText(text);

      expect(redacted).toContain('[API_KEY_REDACTED]');
    });

    it('should redact multiple sensitive items', () => {
      const text =
        'Email: john@example.com, Phone: (555) 123-1234, Password: secret123';
      const redacted = privacyFilter.redactText(text);

      expect(redacted).toContain('[EMAIL_REDACTED]');
      expect(redacted).toContain('[PHONE_REDACTED]');
      expect(redacted).toContain('[PASSWORD_REDACTED]');
    });

    it('should preserve non-sensitive text', () => {
      const text = 'This is a normal message about the weather today';
      const redacted = privacyFilter.redactText(text);

      expect(redacted).toBe(text);
    });
  });

  describe('analyzeInteractionLog', () => {
    const createMockLog = (
      overrides: Partial<AIInteractionLog> = {}
    ): AIInteractionLog => ({
      id: 'test-id',
      timestamp: new Date(),
      sessionId: 'session-1',
      modelType: 'local',
      modelInfo: { name: 'test-model', version: '1.0' },
      userMessage: 'Test message',
      aiResponse: 'Test response',
      context: {},
      actions: [],
      suggestions: [],
      toolCalls: [],
      responseTime: 1000,
      containsSensitiveData: false,
      dataClassification: 'public' as DataClassification,
      ...overrides,
    });

    it('should analyze user message for sensitive data', () => {
      const log = createMockLog({
        userMessage: 'My email is john@example.com',
      });

      const analysis = privacyFilter.analyzeInteractionLog(log);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'email')).toBe(
        true
      );
    });

    it('should analyze AI response for sensitive data', () => {
      const log = createMockLog({
        aiResponse: 'Your API key is sk-1234567890abcdef1234567890abcdef',
      });

      const analysis = privacyFilter.analyzeInteractionLog(log);

      expect(analysis.containsSensitiveData).toBe(true);
      expect(analysis.sensitiveMatches.some(m => m.type === 'apiKey')).toBe(
        true
      );
    });

    it('should analyze tool calls for sensitive data', () => {
      const log = createMockLog({
        toolCalls: [
          {
            toolName: 'test-tool',
            arguments: { email: 'user@example.com' },
            result: { success: true },
            executionTime: 100,
            success: true,
          },
        ],
      });

      const analysis = privacyFilter.analyzeInteractionLog(log);

      expect(analysis.containsSensitiveData).toBe(true);
    });
  });

  describe('redactInteractionLog', () => {
    const createMockLog = (
      overrides: Partial<AIInteractionLog> = {}
    ): AIInteractionLog => ({
      id: 'test-id',
      timestamp: new Date(),
      sessionId: 'session-1',
      modelType: 'local',
      modelInfo: { name: 'test-model', version: '1.0' },
      userMessage: 'Test message',
      aiResponse: 'Test response',
      context: {},
      actions: [],
      suggestions: [],
      toolCalls: [],
      responseTime: 1000,
      containsSensitiveData: false,
      dataClassification: 'public' as DataClassification,
      ...overrides,
    });

    it('should redact sensitive data from user message', () => {
      const log = createMockLog({
        userMessage: 'My email is john@example.com',
      });

      const redacted = privacyFilter.redactInteractionLog(log);

      expect(redacted.userMessage).toBe('My email is [EMAIL_REDACTED]');
    });

    it('should redact sensitive data from AI response', () => {
      const log = createMockLog({
        aiResponse: 'Your password: secret123',
      });

      const redacted = privacyFilter.redactInteractionLog(log);

      expect(redacted.aiResponse).toContain('[PASSWORD_REDACTED]');
    });

    it('should redact sensitive data from tool calls', () => {
      const log = createMockLog({
        toolCalls: [
          {
            toolName: 'test-tool',
            arguments: { email: 'user@example.com' },
            result: { data: 'API key: sk-1234567890abcdef1234567890abcdef' },
            executionTime: 100,
            success: true,
          },
        ],
      });

      const redacted = privacyFilter.redactInteractionLog(log);

      expect(JSON.stringify(redacted.toolCalls[0].arguments)).toContain(
        '[EMAIL_REDACTED]'
      );
      expect(JSON.stringify(redacted.toolCalls[0].result)).toContain(
        '[API_KEY_REDACTED]'
      );
    });

    it('should preserve non-sensitive data', () => {
      const log = createMockLog({
        userMessage: 'What is the weather today?',
        aiResponse: 'The weather is sunny and warm.',
      });

      const redacted = privacyFilter.redactInteractionLog(log);

      expect(redacted.userMessage).toBe(log.userMessage);
      expect(redacted.aiResponse).toBe(log.aiResponse);
    });
  });

  describe('anonymizeInteractionLog', () => {
    const createMockLog = (
      overrides: Partial<AIInteractionLog> = {}
    ): AIInteractionLog => ({
      id: 'test-id',
      timestamp: new Date(),
      sessionId: 'session-1',
      modelType: 'local',
      modelInfo: { name: 'test-model', version: '1.0' },
      userMessage: 'Test message',
      aiResponse: 'Test response',
      context: {},
      actions: [],
      suggestions: [],
      toolCalls: [],
      responseTime: 1000,
      containsSensitiveData: false,
      dataClassification: 'public' as DataClassification,
      ...overrides,
    });

    it('should generate anonymous IDs', () => {
      const log = createMockLog();
      const anonymized = privacyFilter.anonymizeInteractionLog(log);

      expect(anonymized.id).not.toBe(log.id);
      expect(anonymized.sessionId).not.toBe(log.sessionId);
      expect(anonymized.id).toMatch(/^anon_/);
      expect(anonymized.sessionId).toMatch(/^anon_/);
    });

    it('should anonymize names in text', () => {
      const log = createMockLog({
        userMessage: 'Hello, my name is John Smith',
      });

      const anonymized = privacyFilter.anonymizeInteractionLog(log);

      expect(anonymized.userMessage).toBe('Hello, my name is [NAME]');
    });

    it('should anonymize email addresses', () => {
      const log = createMockLog({
        userMessage: 'Contact me at john.doe@example.com',
      });

      const anonymized = privacyFilter.anonymizeInteractionLog(log);

      expect(anonymized.userMessage).toBe('Contact me at [EMAIL]');
    });

    it('should anonymize dates', () => {
      const log = createMockLog({
        userMessage: 'Meeting on 12/25/2023',
      });

      const anonymized = privacyFilter.anonymizeInteractionLog(log);

      expect(anonymized.userMessage).toBe('Meeting on [DATE]');
    });
  });

  describe('shouldFilterForExport', () => {
    const createMockLog = (
      classification: DataClassification,
      sensitive = false
    ): AIInteractionLog => ({
      id: 'test-id',
      timestamp: new Date(),
      sessionId: 'session-1',
      modelType: 'local',
      modelInfo: { name: 'test-model', version: '1.0' },
      userMessage: 'Test message',
      aiResponse: 'Test response',
      context: {},
      actions: [],
      suggestions: [],
      toolCalls: [],
      responseTime: 1000,
      containsSensitiveData: sensitive,
      dataClassification: classification,
    });

    it('should filter confidential logs when not including confidential', () => {
      const log = createMockLog('confidential');
      const shouldFilter = privacyFilter.shouldFilterForExport(log, false);

      expect(shouldFilter).toBe(true);
    });

    it('should not filter confidential logs when including confidential', () => {
      const log = createMockLog('confidential');
      const shouldFilter = privacyFilter.shouldFilterForExport(log, true);

      expect(shouldFilter).toBe(false);
    });

    it('should filter sensitive logs when not including confidential', () => {
      const log = createMockLog('internal', true);
      const shouldFilter = privacyFilter.shouldFilterForExport(log, false);

      expect(shouldFilter).toBe(true);
    });

    it('should not filter public logs', () => {
      const log = createMockLog('public');
      const shouldFilter = privacyFilter.shouldFilterForExport(log, false);

      expect(shouldFilter).toBe(false);
    });

    it('should not filter internal logs without sensitive data', () => {
      const log = createMockLog('internal', false);
      const shouldFilter = privacyFilter.shouldFilterForExport(log, false);

      expect(shouldFilter).toBe(false);
    });
  });

  describe('confidence scoring', () => {
    it('should return 0 confidence for clean text', () => {
      const text = 'This is clean text';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.confidenceScore).toBe(0);
    });

    it('should return high confidence for clear sensitive patterns', () => {
      const text = 'Email: john@example.com, SSN: 123-45-6789';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.confidenceScore).toBeGreaterThan(0.8);
    });

    it('should return moderate confidence for keyword matches', () => {
      const text = 'This document is confidential';
      const analysis = privacyFilter.analyzeText(text);

      expect(analysis.confidenceScore).toBeGreaterThan(0);
      expect(analysis.confidenceScore).toBeLessThan(0.8);
    });
  });
});
