import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  userGuide: [
    'user-guide/getting-started',
    {
      type: 'category',
      label: 'Core Features',
      items: [
        'user-guide/task-management',
        'user-guide/time-tracking',
        'user-guide/ai-assistant',
        'user-guide/pattern-recognition',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Usage',
      items: [
        'user-guide/keyboard-shortcuts',
        'user-guide/data-management',
        'user-guide/customization',
      ],
    },
    'user-guide/troubleshooting',
    'user-guide/faq',
  ],
  developer: [
    'developer/setup',
    'developer/architecture',
    {
      type: 'category',
      label: 'Development',
      items: [
        'developer/project-structure',
        'developer/database',
        'developer/testing',
        'developer/building',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/database-schema',
        'api/typescript-interfaces',
        'api/integration-examples',
        'api/database-erd',
      ],
    },
    'developer/contributing',
  ],
};

export default sidebars;
