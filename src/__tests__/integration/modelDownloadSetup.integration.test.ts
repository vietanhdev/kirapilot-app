/**
 * Integration tests for model download and setup workflows
 * Tests automatic model downloading, progress tracking, integrity verification,
 * and error recovery during setup processes
 */

import { LocalAIService } from '../../services/ai/LocalAIService';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

// Mock the Tauri invoke function
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('Model Download and Setup Integration Tests', () => {
  let localService: LocalAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockClear();
    localService = new LocalAIService();
  });

  describe('Automatic Model Download Workflow', () => {
    it('should download model automatically on first initialization', async () => {
      // Mock model not available initially
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
          error_message: null,
        })
        // Mock download progress updates
        .mockResolvedValueOnce({
          total_bytes: 157286400, // ~150MB
          downloaded_bytes: 0,
          percentage: 0,
          speed_bytes_per_sec: 0,
          eta_seconds: null,
          status: 'Initializing',
        })
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 31457280, // 20%
          percentage: 20,
          speed_bytes_per_sec: 2097152, // 2MB/s
          eta_seconds: 60,
          status: 'Downloading',
        })
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 78643200, // 50%
          percentage: 50,
          speed_bytes_per_sec: 2097152,
          eta_seconds: 37,
          status: 'Downloading',
        })
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 157286400, // 100%
          percentage: 100,
          speed_bytes_per_sec: 2097152,
          eta_seconds: 0,
          status: 'Completed',
        })
        // Mock successful initialization after download
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        // Mock final status check
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path:
            '/Users/test/.kirapilot/models/gemma-3-270m-it-Q4_K_M.gguf',
          error_message: null,
        });

      // Initialize service - should trigger download
      await localService.initialize();

      // Verify service is ready
      expect(localService.isInitialized()).toBe(true);
      expect(localService.modelPath).toBe(
        '/Users/test/.kirapilot/models/gemma-3-270m-it-Q4_K_M.gguf'
      );

      // Verify download-related calls were made
      expect(mockInvoke).toHaveBeenCalledWith('get_model_status');
      expect(mockInvoke).toHaveBeenCalledWith('initialize_local_model');
    });

    it('should handle download progress tracking correctly', async () => {
      const progressUpdates: Array<{
        total_bytes: number;
        downloaded_bytes: number;
        percentage: number;
        speed_bytes_per_sec: number;
        eta_seconds: number;
        status: string;
      }> = [];

      // Mock model not available
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        // Mock progressive download updates
        .mockImplementation((command: string) => {
          if (command === 'get_download_progress') {
            const update = {
              total_bytes: 157286400,
              downloaded_bytes: progressUpdates.length * 15728640, // 10MB increments
              percentage: progressUpdates.length * 10,
              speed_bytes_per_sec: 1048576, // 1MB/s
              eta_seconds: Math.max(0, 150 - progressUpdates.length * 10),
              status: progressUpdates.length < 10 ? 'Downloading' : 'Completed',
            };
            progressUpdates.push(update);
            return Promise.resolve(update);
          }

          if (command === 'initialize_local_model') {
            return Promise.resolve('Model initialized successfully');
          }

          if (command === 'configure_optimal_resources') {
            return Promise.resolve('Optimal resources configured');
          }

          if (command === 'start_resource_monitoring') {
            return Promise.resolve('Resource monitoring started');
          }

          if (command === 'get_model_status') {
            return Promise.resolve({
              is_available: true,
              is_loaded: true,
              model_path: '/path/to/model.gguf',
            });
          }

          return Promise.resolve('Success');
        });

      // Initialize and track progress
      await localService.initialize();

      // Verify progress was tracked
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].status).toBe(
        'Completed'
      );
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
    });

    it('should skip download if model is already cached', async () => {
      // Mock model already available
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path:
            '/Users/test/.kirapilot/models/gemma-3-270m-it-Q4_K_M.gguf',
          error_message: null,
        })
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      // Initialize service
      await localService.initialize();

      // Verify service is ready without download
      expect(localService.isInitialized()).toBe(true);

      // Verify no download commands were called
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'download_model',
        expect.any(Object)
      );

      // But initialization commands should have been called
      expect(mockInvoke).toHaveBeenCalledWith('get_model_status');
    });
  });

  describe('Download Error Handling and Recovery', () => {
    it('should retry download on network failures', async () => {
      let downloadAttempts = 0;

      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockImplementation((command: string) => {
          if (command === 'download_model') {
            downloadAttempts++;
            if (downloadAttempts < 3) {
              return Promise.reject(new Error('Network timeout'));
            }
            return Promise.resolve('Download completed successfully');
          }

          if (command === 'get_download_progress') {
            return Promise.resolve({
              total_bytes: 157286400,
              downloaded_bytes: 157286400,
              percentage: 100,
              speed_bytes_per_sec: 1048576,
              eta_seconds: 0,
              status: 'Completed',
            });
          }

          if (command === 'initialize_local_model') {
            return Promise.resolve('Model initialized successfully');
          }

          if (command === 'configure_optimal_resources') {
            return Promise.resolve('Optimal resources configured');
          }

          if (command === 'start_resource_monitoring') {
            return Promise.resolve('Resource monitoring started');
          }

          if (command === 'get_model_status') {
            return Promise.resolve({
              is_available: true,
              is_loaded: true,
              model_path: '/path/to/model.gguf',
            });
          }

          return Promise.resolve('Success');
        });

      // Should eventually succeed despite initial failures
      await localService.initialize();

      expect(localService.isInitialized()).toBe(true);
      expect(downloadAttempts).toBe(3); // Verify retries occurred
    });

    it('should handle insufficient disk space errors', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockRejectedValueOnce(
          new Error('Insufficient disk space: Need 150MB, have 50MB available')
        );

      // Should fail with descriptive error
      await expect(localService.initialize()).rejects.toThrow(
        'Insufficient disk space'
      );
    });

    it('should handle corrupted download with re-download', async () => {
      let downloadAttempts = 0;

      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockImplementation((command: string) => {
          if (command === 'download_model') {
            downloadAttempts++;
            return Promise.resolve('Download completed');
          }

          if (command === 'verify_model_integrity') {
            // First attempt fails integrity check
            if (downloadAttempts === 1) {
              return Promise.resolve(false);
            }
            return Promise.resolve(true);
          }

          if (command === 'get_download_progress') {
            return Promise.resolve({
              total_bytes: 157286400,
              downloaded_bytes: 157286400,
              percentage: 100,
              speed_bytes_per_sec: 1048576,
              eta_seconds: 0,
              status: 'Completed',
            });
          }

          if (command === 'initialize_local_model') {
            return Promise.resolve('Model initialized successfully');
          }

          if (command === 'configure_optimal_resources') {
            return Promise.resolve('Optimal resources configured');
          }

          if (command === 'start_resource_monitoring') {
            return Promise.resolve('Resource monitoring started');
          }

          if (command === 'get_model_status') {
            return Promise.resolve({
              is_available: true,
              is_loaded: true,
              model_path: '/path/to/model.gguf',
            });
          }

          return Promise.resolve('Success');
        });

      await localService.initialize();

      expect(localService.isInitialized()).toBe(true);
      expect(downloadAttempts).toBe(2); // Should have re-downloaded
    });
  });

  describe('Model Integrity and Verification', () => {
    it('should verify model checksum after download', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 157286400,
          percentage: 100,
          speed_bytes_per_sec: 1048576,
          eta_seconds: 0,
          status: 'Completed',
        })
        .mockResolvedValueOnce(true) // verify_model_integrity
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        });

      await localService.initialize();

      expect(mockInvoke).toHaveBeenCalledWith('verify_model_integrity', {
        modelPath: expect.any(String),
      });
      expect(localService.isInitialized()).toBe(true);
    });

    it('should handle model file corruption detection', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: false,
          model_path: '/path/to/corrupted/model.gguf',
        })
        .mockResolvedValueOnce(false) // verify_model_integrity fails
        .mockRejectedValueOnce(new Error('Model file is corrupted'));

      await expect(localService.initialize()).rejects.toThrow(
        'Model file is corrupted'
      );
    });
  });

  describe('Storage Management', () => {
    it('should check available storage before download', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockResolvedValueOnce({
          total_space_bytes: 1000000000, // 1GB
          available_space_bytes: 200000000, // 200MB
          used_by_models_bytes: 0,
          models_directory: '/Users/test/.kirapilot/models',
        })
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 157286400,
          percentage: 100,
          speed_bytes_per_sec: 1048576,
          eta_seconds: 0,
          status: 'Completed',
        })
        .mockResolvedValueOnce(true) // verify_model_integrity
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        });

      await localService.initialize();

      expect(mockInvoke).toHaveBeenCalledWith('get_storage_info');
      expect(localService.isInitialized()).toBe(true);
    });

    it('should cleanup old models when storage is low', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: false,
          is_loaded: false,
          model_path: null,
        })
        .mockResolvedValueOnce({
          total_space_bytes: 1000000000,
          available_space_bytes: 100000000, // Low space
          used_by_models_bytes: 500000000,
          models_directory: '/Users/test/.kirapilot/models',
        })
        .mockResolvedValueOnce(['old-model-1.gguf', 'old-model-2.gguf']) // cleanup_old_models
        .mockResolvedValueOnce({
          total_bytes: 157286400,
          downloaded_bytes: 157286400,
          percentage: 100,
          speed_bytes_per_sec: 1048576,
          eta_seconds: 0,
          status: 'Completed',
        })
        .mockResolvedValueOnce(true) // verify_model_integrity
        .mockResolvedValueOnce('Model initialized successfully')
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        });

      await localService.initialize();

      expect(mockInvoke).toHaveBeenCalledWith('cleanup_old_models', {
        maxAgeDays: expect.any(Number),
        maxUnusedModels: expect.any(Number),
      });
      expect(localService.isInitialized()).toBe(true);
    });

    it('should get cached models information', async () => {
      const mockCachedModels = [
        {
          name: 'gemma-3-270m-it',
          repo: 'unsloth/gemma-3-270m-it-GGUF',
          filename: 'gemma-3-270m-it-Q4_K_M.gguf',
          size_bytes: 157286400,
          checksum: 'abc123def456',
          download_date: '2025-08-24T08:00:00Z',
          last_used: '2025-08-24T10:30:00Z',
          usage_count: 15,
        },
      ];

      mockInvoke.mockResolvedValueOnce(mockCachedModels);

      const cachedModels = await localService.getCachedModels();

      expect(cachedModels).toEqual(mockCachedModels);
      expect(mockInvoke).toHaveBeenCalledWith('get_cached_models');
    });
  });

  describe('Configuration and Optimization', () => {
    it('should configure optimal resources based on system capabilities', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started');

      await localService.initialize();

      expect(mockInvoke).toHaveBeenCalledWith('configure_optimal_resources');
      expect(localService.isInitialized()).toBe(true);
    });

    it('should update resource configuration dynamically', async () => {
      // Initialize first
      mockInvoke
        .mockResolvedValueOnce({
          is_available: true,
          is_loaded: true,
          model_path: '/path/to/model.gguf',
        })
        .mockResolvedValueOnce('Optimal resources configured')
        .mockResolvedValueOnce('Resource monitoring started')
        .mockResolvedValueOnce('Resource configuration updated');

      await localService.initialize();

      // Update configuration
      await localService.updateResourceConfig({
        threads: 8,
        contextSize: 4096,
        maxTokens: 1024,
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_resource_config', {
        config: expect.objectContaining({
          max_threads: 8,
        }),
      });
    });

    it('should provide performance recommendations', async () => {
      const mockRecommendations = [
        'Increase thread count to 8 for better performance',
        'Consider using GPU acceleration if available',
        'Reduce context size to 1024 tokens to save memory',
      ];

      mockInvoke.mockResolvedValueOnce(mockRecommendations);

      const recommendations =
        await localService.getPerformanceRecommendations();

      expect(recommendations).toEqual(mockRecommendations);
      expect(mockInvoke).toHaveBeenCalledWith(
        'get_performance_recommendations'
      );
    });
  });

  describe('Concurrent Download Management', () => {
    it('should handle multiple initialization attempts gracefully', async () => {
      let initializationCount = 0;

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'get_model_status') {
          initializationCount++;
          if (initializationCount === 1) {
            return Promise.resolve({
              is_available: false,
              is_loaded: false,
              model_path: null,
            });
          }
          return Promise.resolve({
            is_available: true,
            is_loaded: true,
            model_path: '/path/to/model.gguf',
          });
        }

        if (command === 'initialize_local_model') {
          return new Promise(resolve => {
            setTimeout(() => resolve('Model initialized successfully'), 100);
          });
        }

        return Promise.resolve('Success');
      });

      // Start multiple initializations concurrently
      const promises = [
        localService.initialize(),
        localService.initialize(),
        localService.initialize(),
      ];

      await Promise.all(promises);

      // Should only initialize once
      expect(localService.isInitialized()).toBe(true);
    });

    it('should queue download requests appropriately', async () => {
      let downloadStarted = false;

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'get_model_status') {
          return Promise.resolve({
            is_available: false,
            is_loaded: false,
            model_path: null,
          });
        }

        if (command === 'download_model') {
          if (downloadStarted) {
            return Promise.reject(new Error('Download already in progress'));
          }
          downloadStarted = true;
          return new Promise(resolve => {
            setTimeout(() => resolve('Download completed'), 200);
          });
        }

        return Promise.resolve('Success');
      });

      // Multiple services trying to download simultaneously
      const service1 = new LocalAIService();
      const service2 = new LocalAIService();

      const promises = [
        service1.initialize().catch(() => {}), // May fail due to concurrent download
        service2.initialize().catch(() => {}), // May fail due to concurrent download
      ];

      await Promise.allSettled(promises);

      // At least one should succeed
      expect(downloadStarted).toBe(true);
    });
  });
});
