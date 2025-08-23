export interface MockFileSystemConfig {
  simulateErrors?: boolean;
  responseDelay?: number;
  maxFileSize?: number;
  allowedExtensions?: string[];
}

export interface FileSystemOperationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  path?: string;
}

export interface MockFile {
  path: string;
  content: string;
  size: number;
  lastModified: Date;
  type: string;
}

export class MockFileSystemService {
  private config: MockFileSystemConfig;
  private files: Map<string, MockFile> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: MockFileSystemConfig = {}) {
    this.config = {
      simulateErrors: false,
      responseDelay: 0,
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowedExtensions: ['.json', '.txt', '.csv', '.db'],
      ...config,
    };
  }

  async readFile(path: string): Promise<FileSystemOperationResult> {
    await this.simulateDelay();
    this.throwIfError();

    const file = this.files.get(path);
    if (!file) {
      return {
        success: false,
        error: `File not found: ${path}`,
        path,
      };
    }

    this.emit('fileRead', { path, size: file.size });

    return {
      success: true,
      data: file.content,
      path,
    };
  }

  async writeFile(
    path: string,
    content: string,
    type: string = 'text/plain'
  ): Promise<FileSystemOperationResult> {
    await this.simulateDelay();
    this.throwIfError();

    // Check file size
    const size = new Blob([content]).size;
    if (size > this.config.maxFileSize!) {
      return {
        success: false,
        error: `File too large: ${size} bytes (max: ${this.config.maxFileSize} bytes)`,
        path,
      };
    }

    // Check file extension
    const extension = path.substring(path.lastIndexOf('.'));
    if (
      this.config.allowedExtensions &&
      !this.config.allowedExtensions.includes(extension)
    ) {
      return {
        success: false,
        error: `File extension not allowed: ${extension}`,
        path,
      };
    }

    const file: MockFile = {
      path,
      content,
      size,
      lastModified: new Date(),
      type,
    };

    this.files.set(path, file);
    this.emit('fileWritten', { path, size });

    return {
      success: true,
      path,
    };
  }

  async deleteFile(path: string): Promise<FileSystemOperationResult> {
    await this.simulateDelay();
    this.throwIfError();

    const file = this.files.get(path);
    if (!file) {
      return {
        success: false,
        error: `File not found: ${path}`,
        path,
      };
    }

    this.files.delete(path);
    this.emit('fileDeleted', { path });

    return {
      success: true,
      path,
    };
  }

  async listFiles(directory: string = '/'): Promise<FileSystemOperationResult> {
    await this.simulateDelay();
    this.throwIfError();

    const files = Array.from(this.files.values())
      .filter(file => file.path.startsWith(directory))
      .map(file => ({
        path: file.path,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type,
      }));

    return {
      success: true,
      data: files,
    };
  }

  async fileExists(path: string): Promise<boolean> {
    await this.simulateDelay();
    return this.files.has(path);
  }

  async getFileInfo(path: string): Promise<FileSystemOperationResult> {
    await this.simulateDelay();
    this.throwIfError();

    const file = this.files.get(path);
    if (!file) {
      return {
        success: false,
        error: `File not found: ${path}`,
        path,
      };
    }

    return {
      success: true,
      data: {
        path: file.path,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type,
      },
      path,
    };
  }

  // Backup/Restore specific methods
  async exportData(
    data: unknown,
    filename: string
  ): Promise<FileSystemOperationResult> {
    const content = JSON.stringify(data, null, 2);
    return this.writeFile(filename, content, 'application/json');
  }

  async importData(path: string): Promise<FileSystemOperationResult> {
    const result = await this.readFile(path);
    if (!result.success) {
      return result;
    }

    try {
      const data = JSON.parse(result.data as string);
      return {
        success: true,
        data,
        path,
      };
    } catch {
      return {
        success: false,
        error: `Invalid JSON in file: ${path}`,
        path,
      };
    }
  }

  async createBackup(
    data: unknown,
    backupName?: string
  ): Promise<FileSystemOperationResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = backupName || `backup-${timestamp}.json`;

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data,
    };

    return this.exportData(backupData, filename);
  }

  async restoreBackup(path: string): Promise<FileSystemOperationResult> {
    const result = await this.importData(path);
    if (!result.success) {
      return result;
    }

    const backupData = result.data as {
      timestamp: string;
      version: string;
      data: unknown;
    };

    if (!backupData.data) {
      return {
        success: false,
        error: 'Invalid backup file format',
        path,
      };
    }

    this.emit('backupRestored', { path, timestamp: backupData.timestamp });

    return {
      success: true,
      data: backupData.data,
      path,
    };
  }

  // Mock-specific methods for testing
  seedFile(path: string, content: string, type: string = 'text/plain'): void {
    const file: MockFile = {
      path,
      content,
      size: new Blob([content]).size,
      lastModified: new Date(),
      type,
    };
    this.files.set(path, file);
  }

  getFiles(): MockFile[] {
    return Array.from(this.files.values());
  }

  getFileCount(): number {
    return this.files.size;
  }

  getTotalSize(): number {
    return Array.from(this.files.values()).reduce(
      (total, file) => total + file.size,
      0
    );
  }

  clearFiles(): void {
    this.files.clear();
    this.emit('filesCleared', {});
  }

  // Event handling
  addEventListener(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // Configuration methods
  setSimulateErrors(shouldError: boolean): void {
    this.config.simulateErrors = shouldError;
  }

  setResponseDelay(ms: number): void {
    this.config.responseDelay = ms;
  }

  setMaxFileSize(bytes: number): void {
    this.config.maxFileSize = bytes;
  }

  setAllowedExtensions(extensions: string[]): void {
    this.config.allowedExtensions = extensions;
  }

  reset(): void {
    this.clearFiles();
    this.eventListeners.clear();
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, this.config.responseDelay)
      );
    }
  }

  private throwIfError(): void {
    if (this.config.simulateErrors) {
      throw new Error('Mock file system operation failed');
    }
  }
}

// Export interface for configuration
export interface MockFileSystemConfig {
  simulateErrors?: boolean;
  responseDelay?: number;
  maxFileSize?: number;
  allowedExtensions?: string[];
}
