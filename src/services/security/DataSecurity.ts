// Data security and encryption utilities
import { reportErrorWithPrivacy } from '../../contexts/PrivacyContext';
import { TranslationKey } from '../../i18n';

// Translation function type for security services
export type SecurityTranslationFunction = (
  key: TranslationKey,
  variables?: Record<string, string | number>
) => string;

// Global translation function for security services
let securityTranslationFunction: SecurityTranslationFunction = (
  key: TranslationKey
) => key;

/**
 * Set translation function for security services
 */
export function setSecurityTranslationFunction(
  translationFunction: SecurityTranslationFunction
): void {
  securityTranslationFunction = translationFunction;
}

/**
 * Get localized security error message
 */
export function getSecurityErrorMessage(
  key: TranslationKey,
  variables?: Record<string, string | number>
): string {
  return securityTranslationFunction(key, variables);
}

/**
 * Simple encryption/decryption using Web Crypto API
 * This is a basic implementation - in production you'd want more robust encryption
 */
class DataSecurity {
  private static instance: DataSecurity;
  private encryptionKey: CryptoKey | null = null;

  private constructor() {}

  static getInstance(): DataSecurity {
    if (!DataSecurity.instance) {
      DataSecurity.instance = new DataSecurity();
    }
    return DataSecurity.instance;
  }

  /**
   * Initialize encryption key
   */
  async initializeEncryption(): Promise<void> {
    try {
      // Check if we have a stored key
      const storedKey = localStorage.getItem('kirapilot-encryption-key');

      if (storedKey) {
        // Import existing key
        const keyData = JSON.parse(storedKey);
        this.encryptionKey = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        // Store key for future use
        const exportedKey = await crypto.subtle.exportKey(
          'jwk',
          this.encryptionKey
        );
        localStorage.setItem(
          'kirapilot-encryption-key',
          JSON.stringify(exportedKey)
        );
      }
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.initializeEncryption',
      });
      const errorMessage = getSecurityErrorMessage(
        'security.error.initEncryptionFailed' as TranslationKey
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      const errorMessage = getSecurityErrorMessage(
        'security.error.encryptionKeyNotAvailable' as TranslationKey
      );
      throw new Error(errorMessage);
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.encryptData',
      });
      const errorMessage = getSecurityErrorMessage(
        'security.error.encryptFailed' as TranslationKey
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      await this.initializeEncryption();
    }

    if (!this.encryptionKey) {
      const errorMessage = getSecurityErrorMessage(
        'security.error.encryptionKeyNotAvailable' as TranslationKey
      );
      throw new Error(errorMessage);
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedBuffer = combined.slice(12);

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encryptedBuffer
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.decryptData',
      });
      const errorMessage = getSecurityErrorMessage(
        'security.error.decryptFailed' as TranslationKey
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Securely store sensitive data
   */
  async secureStore(key: string, data: unknown): Promise<void> {
    try {
      const jsonData = JSON.stringify(data);
      const encryptedData = await this.encryptData(jsonData);
      localStorage.setItem(`secure_${key}`, encryptedData);
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.secureStore',
      });
      const errorMessage = getSecurityErrorMessage(
        'security.error.secureStoreFailed' as TranslationKey
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Retrieve and decrypt sensitive data
   */
  async secureRetrieve<T>(key: string): Promise<T | null> {
    try {
      const encryptedData = localStorage.getItem(`secure_${key}`);
      if (!encryptedData) {
        return null;
      }

      const decryptedData = await this.decryptData(encryptedData);
      return JSON.parse(decryptedData) as T;
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.secureRetrieve',
      });
      return null;
    }
  }

  /**
   * Remove securely stored data
   */
  secureRemove(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  /**
   * Clear all encryption keys and secure data
   */
  clearAllSecureData(): void {
    // Remove encryption key
    localStorage.removeItem('kirapilot-encryption-key');

    // Remove all secure data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });

    // Reset encryption key
    this.encryptionKey = null;
  }

  /**
   * Check if data encryption is available
   */
  isEncryptionAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.generateKey === 'function'
    );
  }

  /**
   * Generate secure hash for data integrity
   */
  async generateHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.generateHash',
      });
      const errorMessage = getSecurityErrorMessage(
        'security.error.generateHashFailed' as TranslationKey
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Verify data integrity using hash
   */
  async verifyHash(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.generateHash(data);
      return actualHash === expectedHash;
    } catch (error) {
      reportErrorWithPrivacy(error as Error, {
        context: 'DataSecurity.verifyHash',
      });
      return false;
    }
  }
}

// Export singleton instance
export const dataSecurity = DataSecurity.getInstance();

// Privacy-aware storage utilities
export class SecureStorage {
  /**
   * Store data with privacy controls
   */
  static async store(
    key: string,
    data: unknown,
    options: {
      encrypt?: boolean;
      respectPrivacy?: boolean;
    } = {}
  ): Promise<void> {
    const { encrypt = false, respectPrivacy = true } = options;

    // Check privacy settings if requested
    if (respectPrivacy) {
      const privacySettings = localStorage.getItem(
        'kirapilot-privacy-settings'
      );
      if (privacySettings) {
        try {
          const settings = JSON.parse(privacySettings);
          if (!settings.dataEncryption && encrypt) {
            // User has disabled encryption, store as plain text
            localStorage.setItem(key, JSON.stringify(data));
            return;
          }
        } catch {
          // If we can't parse settings, use defaults
        }
      }
    }

    if (encrypt && dataSecurity.isEncryptionAvailable()) {
      await dataSecurity.secureStore(key, data);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  /**
   * Retrieve data with privacy controls
   */
  static async retrieve<T>(
    key: string,
    options: {
      encrypted?: boolean;
    } = {}
  ): Promise<T | null> {
    const { encrypted = false } = options;

    if (encrypted && dataSecurity.isEncryptionAvailable()) {
      return await dataSecurity.secureRetrieve<T>(key);
    } else {
      const data = localStorage.getItem(key);
      if (!data) {
        return null;
      }
      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    }
  }

  /**
   * Remove data with privacy controls
   */
  static remove(
    key: string,
    options: {
      encrypted?: boolean;
    } = {}
  ): void {
    const { encrypted = false } = options;

    if (encrypted) {
      dataSecurity.secureRemove(key);
    } else {
      localStorage.removeItem(key);
    }
  }
}
