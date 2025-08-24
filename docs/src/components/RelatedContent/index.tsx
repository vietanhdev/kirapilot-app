import React from 'react';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import styles from './styles.module.css';

interface RelatedItem {
  title: string;
  description: string;
  permalink: string;
  category?: string;
}

interface RelatedContentProps {
  items: RelatedItem[];
  title?: string;
}

// Predefined related content mappings
const RELATED_CONTENT_MAP: Record<string, RelatedItem[]> = {
  '/docs/user-guide/getting-started': [
    {
      title: 'Task Management',
      description: 'Learn how to create and organize your tasks effectively',
      permalink: '/docs/user-guide/task-management',
      category: 'User Guide',
    },
    {
      title: 'Time Tracking',
      description: 'Start tracking your productivity with built-in timers',
      permalink: '/docs/user-guide/time-tracking',
      category: 'User Guide',
    },
    {
      title: 'AI Assistant',
      description: 'Discover how AI can help boost your productivity',
      permalink: '/docs/user-guide/ai-assistant',
      category: 'User Guide',
    },
  ],
  '/docs/user-guide/task-management': [
    {
      title: 'Time Tracking',
      description: 'Track time spent on your tasks',
      permalink: '/docs/user-guide/time-tracking',
      category: 'User Guide',
    },
    {
      title: 'Keyboard Shortcuts',
      description: 'Speed up task management with shortcuts',
      permalink: '/docs/user-guide/keyboard-shortcuts',
      category: 'User Guide',
    },
    {
      title: 'Data Management',
      description: 'Backup and manage your task data',
      permalink: '/docs/user-guide/data-management',
      category: 'User Guide',
    },
  ],
  '/docs/user-guide/time-tracking': [
    {
      title: 'Task Management',
      description: 'Organize tasks to track effectively',
      permalink: '/docs/user-guide/task-management',
      category: 'User Guide',
    },
    {
      title: 'Pattern Recognition',
      description: 'Analyze your productivity patterns',
      permalink: '/docs/user-guide/pattern-recognition',
      category: 'User Guide',
    },
    {
      title: 'AI Assistant',
      description: 'Get AI insights on your time usage',
      permalink: '/docs/user-guide/ai-assistant',
      category: 'User Guide',
    },
  ],
  '/docs/developer/setup': [
    {
      title: 'Architecture',
      description: 'Understand the project architecture',
      permalink: '/docs/developer/architecture',
      category: 'Developer',
    },
    {
      title: 'Database',
      description: 'Learn about the database structure',
      permalink: '/docs/developer/database',
      category: 'Developer',
    },
    {
      title: 'Contributing',
      description: 'Guidelines for contributing to the project',
      permalink: '/docs/developer/contributing',
      category: 'Developer',
    },
  ],
  '/docs/developer/architecture': [
    {
      title: 'Project Structure',
      description: 'Explore the codebase organization',
      permalink: '/docs/developer/project-structure',
      category: 'Developer',
    },
    {
      title: 'API Reference',
      description: 'Browse the API documentation',
      permalink: '/docs/api/database-schema',
      category: 'API',
    },
    {
      title: 'Testing',
      description: 'Learn about testing strategies',
      permalink: '/docs/developer/testing',
      category: 'Developer',
    },
  ],
};

const RelatedContent: React.FC<RelatedContentProps> = ({
  items,
  title = translate({
    id: 'theme.docs.relatedContent.title',
    message: 'Related Content',
  }),
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={styles.relatedContent}>
      <h3 className={styles.relatedTitle}>{title}</h3>
      <div className={styles.relatedGrid}>
        {items.map((item, index) => (
          <Link key={index} to={item.permalink} className={styles.relatedItem}>
            <div className={styles.relatedItemContent}>
              {item.category && (
                <span className={styles.relatedCategory}>{item.category}</span>
              )}
              <h4 className={styles.relatedItemTitle}>{item.title}</h4>
              <p className={styles.relatedItemDescription}>
                {item.description}
              </p>
            </div>
            <div className={styles.relatedItemArrow}>→</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Hook to get related content for current page
export const useRelatedContent = (pathname: string): RelatedItem[] => {
  return RELATED_CONTENT_MAP[pathname] || [];
};

export default RelatedContent;
