import { invoke } from '@tauri-apps/api/core';

export interface LocalModelDiagnostics {
  systemRequirements: {
    hasRequiredMemory: boolean;
    availableMemoryGB: number;
    requiredMemoryGB: number;
  };
  modelStatus: {
    isDownloaded: boolean;
    downloadProgress?: number;
    modelPath?: string;
    modelSizeGB?: number;
  };
  dependencies: {
    llamaCppAvailable: boolean;
    systemLibrariesAvailable: boolean;
  };
  recommendations: string[];
}

/**
 * Diagnose local model setup and provide recommendations
 */
export async function diagnoseLocalModel(): Promise<LocalModelDiagnostics> {
  try {
    // Get system information
    const systemInfo = await getSystemInfo();

    // Check model status
    const modelStatus = await getModelStatus();

    // Check dependencies
    const dependencies = await checkDependencies();

    // Generate recommendations
    const recommendations = generateRecommendations(
      systemInfo,
      modelStatus,
      dependencies
    );

    return {
      systemRequirements: systemInfo,
      modelStatus,
      dependencies,
      recommendations,
    };
  } catch (error) {
    console.error('Failed to diagnose local model:', error);

    return {
      systemRequirements: {
        hasRequiredMemory: false,
        availableMemoryGB: 0,
        requiredMemoryGB: 4,
      },
      modelStatus: {
        isDownloaded: false,
      },
      dependencies: {
        llamaCppAvailable: false,
        systemLibrariesAvailable: false,
      },
      recommendations: [
        'Unable to diagnose local model setup',
        'Check console for detailed error messages',
        'Consider using Gemini model as alternative',
      ],
    };
  }
}

async function getSystemInfo() {
  try {
    // This would need to be implemented in the Rust backend
    const info = await invoke<{
      total_memory_gb: number;
      available_memory_gb: number;
    }>('get_system_memory_info');

    return {
      hasRequiredMemory: info.available_memory_gb >= 4,
      availableMemoryGB: info.available_memory_gb,
      requiredMemoryGB: 4,
    };
  } catch {
    return {
      hasRequiredMemory: false,
      availableMemoryGB: 0,
      requiredMemoryGB: 4,
    };
  }
}

async function getModelStatus() {
  try {
    const status = await invoke<{
      is_available: boolean;
      is_loaded: boolean;
      model_path?: string;
      error_message?: string;
    }>('get_model_status');

    return {
      isDownloaded: status.is_available,
      modelPath: status.model_path,
      modelSizeGB: 1.2, // Approximate size for gemma-3-270m-it-Q4_K_M.gguf
    };
  } catch {
    return {
      isDownloaded: false,
    };
  }
}

async function checkDependencies() {
  try {
    // This would need to be implemented in the Rust backend
    const deps = await invoke<{
      llama_cpp_available: boolean;
      system_libraries_available: boolean;
    }>('check_local_model_dependencies');

    return {
      llamaCppAvailable: deps.llama_cpp_available,
      systemLibrariesAvailable: deps.system_libraries_available,
    };
  } catch {
    return {
      llamaCppAvailable: false,
      systemLibrariesAvailable: false,
    };
  }
}

function generateRecommendations(
  systemInfo: {
    hasRequiredMemory: boolean;
    availableMemoryGB: number;
    requiredMemoryGB: number;
  },
  modelStatus: {
    isDownloaded: boolean;
    modelPath?: string;
    modelSizeGB?: number;
  },
  dependencies: {
    llamaCppAvailable: boolean;
    systemLibrariesAvailable: boolean;
  }
): string[] {
  const recommendations: string[] = [];

  if (!systemInfo.hasRequiredMemory) {
    recommendations.push(
      `Insufficient memory: ${systemInfo.availableMemoryGB}GB available, ${systemInfo.requiredMemoryGB}GB required`
    );
    recommendations.push('Close other applications to free up memory');
  }

  if (!modelStatus.isDownloaded) {
    recommendations.push(
      'Model not downloaded - initialization will download automatically'
    );
    recommendations.push(
      'Ensure stable internet connection for model download (~1.2GB)'
    );
  }

  if (!dependencies.llamaCppAvailable) {
    recommendations.push('llama-cpp backend not available');
    recommendations.push(
      'This may be due to missing system dependencies or compilation issues'
    );
  }

  if (!dependencies.systemLibrariesAvailable) {
    recommendations.push('Required system libraries not found');
    recommendations.push('On macOS: Install Xcode Command Line Tools');
    recommendations.push('On Linux: Install build-essential and cmake');
    recommendations.push('On Windows: Install Visual Studio Build Tools');
  }

  if (recommendations.length === 0) {
    recommendations.push('System appears ready for local AI model');
    recommendations.push(
      'If initialization still fails, check application logs'
    );
  }

  return recommendations;
}

/**
 * Get user-friendly error message for local model issues
 */
export function getLocalModelErrorMessage(error: string): string {
  const lowerError = error.toLowerCase();

  if (
    lowerError.includes('failed to initialize backend') ||
    lowerError.includes('backend ai service is not ready')
  ) {
    if (lowerError.includes('please configure at least one ai provider')) {
      return 'AI service requires configuration. Either provide a Gemini API key in Settings, or ensure local model dependencies are installed.';
    }
    return 'Local AI backend failed to start. This requires system dependencies that may not be available. Cloud AI (Gemini) is recommended instead.';
  }

  if (
    lowerError.includes('system dependencies') ||
    lowerError.includes('incompatible architecture')
  ) {
    return 'System compatibility issue detected. Local AI requires specific libraries that may not be installed on your system.';
  }

  if (lowerError.includes('local model initialization failed')) {
    return 'Local model setup failed due to missing dependencies. This is common on some systems - cloud AI works reliably instead.';
  }

  if (
    lowerError.includes('model not found') ||
    lowerError.includes('model file not found')
  ) {
    return 'AI model file not found. The model will be downloaded automatically on first use.';
  }

  if (lowerError.includes('failed to load model')) {
    return 'Failed to load AI model. This may be due to insufficient memory or corrupted model file.';
  }

  if (lowerError.includes('context creation failed')) {
    return 'Failed to create AI context. Try reducing context size or freeing up system memory.';
  }

  return `Local AI unavailable due to system limitations. Cloud AI (Gemini) is recommended as a reliable alternative.`;
}
