import type { ReactNode } from 'react';
import clsx from 'clsx';
import FeatureCard from '../FeatureCard';
import type { FeatureCardProps } from '../FeatureCard';
import styles from './styles.module.css';

// Modern SVG Icons
const TaskIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M9 11l3 3 7-7' />
    <path d='M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.59 0 3.09.41 4.39 1.13' />
  </svg>
);

const TimeIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <circle cx='12' cy='12' r='10' />
    <polyline points='12,6 12,12 16,14' />
  </svg>
);

const AIIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M9.75 9l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
    <path d='M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' />
  </svg>
);

const PrivacyIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
    <circle cx='12' cy='16' r='1' />
    <path d='M7 11V7a5 5 0 0 1 10 0v4' />
  </svg>
);

const CrossPlatformIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
    <line x1='8' y1='21' x2='16' y2='21' />
    <line x1='12' y1='17' x2='12' y2='21' />
  </svg>
);

const DesignIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
  </svg>
);

const FeatureList: Omit<FeatureCardProps, 'className'>[] = [
  {
    title: 'Task Management',
    icon: <TaskIcon />,
    description:
      'Organize your work with rich text descriptions, priority levels, dependencies, and intelligent scheduling. Stay on top of everything that matters.',
    link: '/docs/user-guide/task-management',
    category: 'user',
  },
  {
    title: 'Time Tracking',
    icon: <TimeIcon />,
    description:
      'Built-in timer with session notes and productivity analytics. Understand your work patterns and optimize your productivity.',
    link: '/docs/user-guide/time-tracking',
    category: 'user',
  },
  {
    title: 'AI Assistant',
    icon: <AIIcon />,
    description:
      'Natural language interface with access to all app features. Get intelligent suggestions and automate your workflow.',
    link: '/docs/user-guide/ai-assistant',
    category: 'user',
  },
  {
    title: 'Privacy First',
    icon: <PrivacyIcon />,
    description:
      'All your data stays local with SQLite storage. No cloud dependencies, no privacy concerns. Your productivity data belongs to you.',
    link: '/docs/user-guide/data-management',
    category: 'user',
  },
  {
    title: 'Cross Platform',
    icon: <CrossPlatformIcon />,
    description:
      'Native performance on macOS, Windows, and Linux. Built with Tauri for a truly native experience across all platforms.',
    link: '/docs/developer/architecture',
    category: 'developer',
  },
  {
    title: 'Beautiful Design',
    icon: <DesignIcon />,
    description:
      'Thoughtfully designed interface with smooth animations and contextual intelligence that adapts to your workflow.',
    link: '/docs/user-guide/customization',
    category: 'user',
  },
];

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className='container'>
        <div className='row'>
          {FeatureList.map((props, idx) => (
            <div key={idx} className={clsx('col col--4', styles.featureCol)}>
              <FeatureCard {...props} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
