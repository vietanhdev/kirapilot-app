import type { ReactNode } from 'react';
import styles from './styles.module.css';

interface ScreenshotItem {
  id: string;
  title: string;
  description: string;
  image: string;
  features?: string[];
}

const screenshots: ScreenshotItem[] = [
  {
    id: 'week',
    title: 'Weekly Overview',
    description:
      'Get a comprehensive view of your week with task distribution, time allocation, and productivity insights. Plan ahead and track your progress.',
    image: '/img/screenshots/week.png',
    features: [
      'Week-at-a-glance view',
      'Task distribution analysis',
      'Progress tracking',
    ],
  },
  {
    id: 'day',
    title: 'Daily Planning',
    description:
      'Focus on today with a clean, organized daily view. Manage tasks, schedule time blocks, and maintain momentum throughout your day.',
    image: '/img/screenshots/day.png',
    features: [
      'Daily task organization',
      'Time blocking',
      'Priority management',
    ],
  },
  {
    id: 'kira',
    title: 'AI Assistant - Kira',
    description:
      'Meet Kira, your intelligent productivity companion. Get personalized suggestions, automate workflows, and boost your efficiency with natural language commands.',
    image: '/img/screenshots/kira.png',
    features: [
      'Natural language interface',
      'Smart suggestions',
      'Workflow automation',
    ],
  },
  {
    id: 'focus',
    title: 'Focus Mode',
    description:
      'Enter deep work with distraction-free focus sessions. Track your concentration, manage interruptions, and achieve flow state consistently.',
    image: '/img/screenshots/focus.png',
    features: [
      'Distraction-free interface',
      'Focus timers',
      'Session tracking',
    ],
  },
  {
    id: 'recurring-tasks',
    title: 'Recurring Tasks',
    description:
      'Automate your routine with intelligent recurring task management. Set flexible schedules, track patterns, and maintain consistency.',
    image: '/img/screenshots/recurring-tasks.png',
    features: ['Flexible scheduling', 'Pattern recognition', 'Smart reminders'],
  },
  {
    id: 'report',
    title: 'Analytics & Reports',
    description:
      'Gain insights into your productivity patterns with detailed analytics. Identify trends, optimize your workflow, and celebrate your achievements.',
    image: '/img/screenshots/report.png',
    features: [
      'Productivity analytics',
      'Trend analysis',
      'Performance insights',
    ],
  },
  {
    id: 'settings',
    title: 'Customization',
    description:
      'Tailor KiraPilot to your unique workflow. Customize themes, configure notifications, and adapt the app to match your productivity style.',
    image: '/img/screenshots/settings.png',
    features: [
      'Theme customization',
      'Notification settings',
      'Workflow adaptation',
    ],
  },
  {
    id: 'light',
    title: 'Light Theme',
    description:
      'Experience KiraPilot in beautiful light mode. Every detail is crafted for clarity and elegance, ensuring a pleasant experience in any lighting condition.',
    image: '/img/screenshots/light.png',
    features: [
      'Light theme design',
      'Enhanced readability',
      'Elegant aesthetics',
    ],
  },
];

export default function ScreenshotShowcase(): ReactNode {
  return (
    <section className={styles.showcase}>
      <div className='container'>
        <div className={styles.showcaseHeader}>
          <h2 className={styles.showcaseTitle}>Experience Every Feature</h2>
          <p className={styles.showcaseSubtitle}>
            Discover how KiraPilot transforms your productivity workflow with
            intelligent design and powerful features
          </p>
        </div>

        <div className={styles.showcaseGrid}>
          {screenshots.map((screenshot, index) => (
            <div
              key={screenshot.id}
              className={styles.showcaseItem}
              style={
                {
                  '--animation-delay': `${index * 0.1}s`,
                } as React.CSSProperties
              }
            >
              <div className={styles.screenshotContainer}>
                <img
                  src={screenshot.image}
                  alt={screenshot.title}
                  className={styles.screenshot}
                  loading='lazy'
                />
                <div className={styles.screenshotOverlay}>
                  <div className={styles.overlayContent}>
                    <h3 className={styles.screenshotTitle}>
                      {screenshot.title}
                    </h3>
                    <p className={styles.screenshotDescription}>
                      {screenshot.description}
                    </p>
                    {screenshot.features && (
                      <ul className={styles.featureList}>
                        {screenshot.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className={styles.featureItem}>
                            <svg
                              className={styles.featureIcon}
                              viewBox='0 0 20 20'
                              fill='currentColor'
                            >
                              <path
                                fillRule='evenodd'
                                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.itemInfo}>
                <div className={styles.itemStep}>
                  <span className={styles.stepNumber}>
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className={styles.itemContent}>
                  <h3 className={styles.itemTitle}>{screenshot.title}</h3>
                  <p className={styles.itemDescription}>
                    {screenshot.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
