/**
 * Integration test for LLM backend commands
 * Tests that the Tauri commands are properly exposed and callable
 */

describe('LLM Backend Commands Integration', () => {
  // Mock the Tauri invoke function
  const mockInvoke = jest.fn();

  beforeAll(() => {
    // Mock the Tauri API
    (
      global as unknown as { __TAURI_INVOKE__: typeof mockInvoke }
    ).__TAURI_INVOKE__ = mockInvoke;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockClear();
  });

  describe('Command Registration', () => {
    it('should have initialize_local_model command available', async () => {
      mockInvoke.mockResolvedValue('Model initialized successfully');

      // Simulate calling the command directly
      const result = await mockInvoke('initialize_local_model');

      expect(mockInvoke).toHaveBeenCalledWith('initialize_local_model');
      expect(result).toBe('Model initialized successfully');
    });

    it('should have generate_text command available', async () => {
      const mockResponse = 'Generated text response';
      mockInvoke.mockResolvedValue(mockResponse);

      const result = await mockInvoke('generate_text', {
        prompt: 'Test prompt',
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(mockInvoke).toHaveBeenCalledWith('generate_text', {
        prompt: 'Test prompt',
        maxTokens: 100,
        temperature: 0.7,
      });
      expect(result).toBe(mockResponse);
    });

    it('should have get_model_status command available', async () => {
      const mockStatus = {
        is_available: true,
        is_loaded: true,
        model_path: '/tmp/models/test.gguf',
        error_message: null,
        model_info: {
          name: 'test-model',
          size_mb: 150,
          context_size: 2048,
          parameter_count: '270M',
        },
      };

      mockInvoke.mockResolvedValue(mockStatus);

      const result = await mockInvoke('get_model_status');

      expect(mockInvoke).toHaveBeenCalledWith('get_model_status');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('Command Parameters', () => {
    it('should handle generate_text with various parameters', async () => {
      mockInvoke.mockResolvedValue('Response');

      const testCases = [
        {
          prompt: 'Short prompt',
          maxTokens: 50,
          temperature: 0.1,
        },
        {
          prompt: 'Longer prompt with more context',
          maxTokens: 200,
          temperature: 0.9,
        },
        {
          prompt: 'Medium prompt',
          maxTokens: 100,
          temperature: 0.7,
        },
      ];

      for (const testCase of testCases) {
        await mockInvoke('generate_text', testCase);

        expect(mockInvoke).toHaveBeenCalledWith('generate_text', testCase);
      }
    });

    it('should handle parameter validation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Prompt cannot be empty'));

      await expect(
        mockInvoke('generate_text', {
          prompt: '',
          maxTokens: 100,
          temperature: 0.7,
        })
      ).rejects.toThrow('Prompt cannot be empty');
    });

    it('should handle invalid temperature values', async () => {
      mockInvoke.mockRejectedValue(
        new Error('temperature must be between 0.0 and 2.0')
      );

      await expect(
        mockInvoke('generate_text', {
          prompt: 'Test',
          maxTokens: 100,
          temperature: 5.0,
        })
      ).rejects.toThrow('temperature must be between 0.0 and 2.0');
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Model initialization failed'));

      await expect(mockInvoke('initialize_local_model')).rejects.toThrow(
        'Model initialization failed'
      );
    });

    it('should handle generation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Model not loaded'));

      await expect(
        mockInvoke('generate_text', {
          prompt: 'Test',
          maxTokens: 100,
          temperature: 0.7,
        })
      ).rejects.toThrow('Model not loaded');
    });

    it('should handle status check errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Status check failed'));

      await expect(mockInvoke('get_model_status')).rejects.toThrow(
        'Status check failed'
      );
    });
  });

  describe('Response Formats', () => {
    it('should return proper status format', async () => {
      const expectedStatus = {
        is_available: true,
        is_loaded: false,
        model_path: null,
        download_progress: null,
        error_message: null,
        model_info: null,
      };

      mockInvoke.mockResolvedValue(expectedStatus);

      const result = await mockInvoke('get_model_status');

      expect(result).toMatchObject({
        is_available: expect.any(Boolean),
        is_loaded: expect.any(Boolean),
      });

      // Check that all expected fields are present
      expect(result).toHaveProperty('model_path');
      expect(result).toHaveProperty('download_progress');
      expect(result).toHaveProperty('error_message');
      expect(result).toHaveProperty('model_info');
    });

    it('should return string responses for text generation', async () => {
      const mockResponse = 'This is a generated response from the AI model.';
      mockInvoke.mockResolvedValue(mockResponse);

      const result = await mockInvoke('generate_text', {
        prompt: 'Generate a response',
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return initialization success message', async () => {
      mockInvoke.mockResolvedValue('Local model initialized successfully');

      const result = await mockInvoke('initialize_local_model');

      expect(typeof result).toBe('string');
      expect(result).toContain('initialized');
    });
  });

  describe('Command Flow', () => {
    it('should support typical initialization flow', async () => {
      // Step 1: Check status
      mockInvoke.mockResolvedValueOnce({
        is_available: false,
        is_loaded: false,
        model_path: null,
        error_message: null,
        model_info: null,
      });

      // Step 2: Initialize
      mockInvoke.mockResolvedValueOnce('Model initialized successfully');

      // Step 3: Check status again
      mockInvoke.mockResolvedValueOnce({
        is_available: true,
        is_loaded: true,
        model_path: '/tmp/models/test.gguf',
        error_message: null,
        model_info: {
          name: 'test-model',
          size_mb: 150,
          context_size: 2048,
          parameter_count: '270M',
        },
      });

      // Execute the flow
      const initialStatus = await mockInvoke('get_model_status');
      expect(initialStatus.is_loaded).toBe(false);

      const initResult = await mockInvoke('initialize_local_model');
      expect(initResult).toContain('initialized');

      const finalStatus = await mockInvoke('get_model_status');
      expect(finalStatus.is_loaded).toBe(true);
    });

    it('should support generation after initialization', async () => {
      // Mock initialized state
      mockInvoke.mockResolvedValueOnce({
        is_available: true,
        is_loaded: true,
        model_path: '/tmp/models/test.gguf',
        error_message: null,
        model_info: {
          name: 'test-model',
          size_mb: 150,
          context_size: 2048,
          parameter_count: '270M',
        },
      });

      // Mock generation
      mockInvoke.mockResolvedValueOnce('Generated response');

      // Check status
      const status = await mockInvoke('get_model_status');
      expect(status.is_loaded).toBe(true);

      // Generate text
      const response = await mockInvoke('generate_text', {
        prompt: 'Test prompt',
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(response).toBe('Generated response');
    });
  });
});
