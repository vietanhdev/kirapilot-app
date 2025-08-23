// Jest setup file for testing
import '@testing-library/jest-dom';
import { setupTestEnvironment } from './__tests__/setup/testConfig';

// Set up test environment
setupTestEnvironment();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Notification API
const MockNotification = jest.fn().mockImplementation((title, options) => ({
  title,
  body: options?.body,
  icon: options?.icon,
  tag: options?.tag,
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

(
  MockNotification as unknown as { permission: NotificationPermission }
).permission = 'granted';
(
  MockNotification as unknown as {
    requestPermission: () => Promise<NotificationPermission>;
  }
).requestPermission = jest.fn().mockResolvedValue('granted');

global.Notification = MockNotification as unknown as typeof Notification;

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 0 },
    type: 'sine',
  }),
  createGain: jest.fn().mockReturnValue({
    connect: jest.fn(),
    gain: { value: 1 },
  }),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  suspend: jest.fn(),
  resume: jest.fn(),
  close: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock crypto API for generating IDs
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(
      () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
    ),
    getRandomValues: jest.fn(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock TextEncoder/TextDecoder for Node.js environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
(global as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
  TextDecoder;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
const MockFile = jest.fn().mockImplementation((chunks, filename, options) => ({
  name: filename,
  size: chunks.reduce((acc: number, chunk: ArrayBuffer | string) => {
    if (typeof chunk === 'string') {
      return acc + chunk.length;
    } else {
      return acc + chunk.byteLength;
    }
  }, 0),
  type: options?.type || '',
  lastModified: Date.now(),
}));

const MockFileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  readAsArrayBuffer: jest.fn(),
  result: null,
  error: null,
  onload: null,
  onerror: null,
  onabort: null,
  abort: jest.fn(),
}));

(MockFileReader as unknown as { EMPTY: number }).EMPTY = 0;
(MockFileReader as unknown as { LOADING: number }).LOADING = 1;
(MockFileReader as unknown as { DONE: number }).DONE = 2;

global.File = MockFile as unknown as typeof File;
global.FileReader = MockFileReader as unknown as typeof FileReader;

// Mock Blob
global.Blob = jest.fn().mockImplementation((chunks, options) => ({
  size: chunks.reduce((acc: number, chunk: ArrayBuffer | string) => {
    if (typeof chunk === 'string') {
      return acc + chunk.length;
    } else {
      return acc + chunk.byteLength;
    }
  }, 0),
  type: options?.type || '',
  slice: jest.fn(),
  stream: jest.fn(),
  text: jest.fn(),
  arrayBuffer: jest.fn(),
}));

// Suppress console warnings in tests unless explicitly testing them
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
