/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|rehype-highlight|highlight.js|unified|bail|is-plain-obj|trough|vfile|unist-util-stringify-position|mdast-util-from-markdown|mdast-util-to-markdown|micromark|decode-named-character-reference|character-entities|mdast-util-to-hast|hastscript|property-information|hast-util-parse-selector|svg-element-attributes|html-element-attributes|aria-query|space-separated-tokens|comma-separated-tokens|pretty-bytes|mdast-util-gfm|mdast-util-gfm-table|mdast-util-gfm-strikethrough|mdast-util-gfm-task-list-item|mdast-util-gfm-autolink-literal|micromark-extension-gfm|micromark-extension-gfm-table|micromark-extension-gfm-strikethrough|micromark-extension-gfm-task-list-item|micromark-extension-gfm-autolink-literal|hast-util-to-jsx-runtime|estree-util-is-identifier-name|estree-util-visit|unist-util-position|unist-util-visit|unist-util-is|unist-util-visit-parents|unist-util-remove-position|mdast-util-definitions|mdast-util-find-and-replace|escape-string-regexp|mdast-util-phrasing|ccount|markdown-table|repeat-string|longest-streak|zwitch|html-void-elements|rehype-highlight|lowlight|fault|highlight.js)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^react-markdown$': '<rootDir>/src/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/src/__mocks__/remark-gfm.js',
    '^rehype-highlight$': '<rootDir>/src/__mocks__/rehype-highlight.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  testTimeout: 10000,
  maxWorkers: '50%',
};
