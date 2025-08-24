import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'KiraPilot',
  tagline:
    'Navigate your day with precision - A beautiful productivity app with AI assistance',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://kirapilot.nrl.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'vietanhdev', // Usually your GitHub org/user name.
  projectName: 'kirapilot-app', // Usually your repo name.

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/vietanhdev/kirapilot-app/tree/main/docs/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
        searchResultContextMaxLength: 50,
        ignoreFiles: [
          /\/api\/code-validation-report\.md$/,
          /\/api\/tauri-commands\.md$/,
        ],
        searchBarPosition: 'right',
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/kirapilot-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'KiraPilot',
      logo: {
        alt: 'KiraPilot Logo',
        src: 'img/kirapilot-logo.svg',
        srcDark: 'img/kirapilot-logo.svg',
      },
      hideOnScroll: true,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'userGuide',
          position: 'left',
          label: 'User Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developer',
          position: 'left',
          label: 'Developer',
        },

        {
          type: 'html',
          position: 'right',
          value: '<div class="navbar__separator"></div>',
        },
        {
          href: 'https://github.com/vietanhdev/kirapilot-app',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      logo: {
        alt: 'KiraPilot Logo',
        src: 'img/kirapilot-logo.svg',
        width: 160,
        height: 51,
      },
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/user-guide/getting-started',
            },
            {
              label: 'Task Management',
              to: '/docs/user-guide/task-management',
            },
            {
              label: 'Developer Guide',
              to: '/docs/developer/setup',
            },
            {
              label: 'API Reference',
              to: '/docs/api/database-schema',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/vietanhdev/kirapilot-app/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/vietanhdev/kirapilot-app/discussions',
            },
            {
              label: 'Contributing',
              to: '/docs/developer/contributing',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/vietanhdev/kirapilot-app',
            },
            {
              label: 'Releases',
              href: 'https://github.com/vietanhdev/kirapilot-app/releases',
            },
            {
              label: 'Download',
              href: 'https://github.com/vietanhdev/kirapilot-app/releases/latest',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} KiraPilot. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        'rust',
        'toml',
        'json',
        'bash',
        'typescript',
        'javascript',
      ],
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
