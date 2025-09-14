import React, { useState } from 'react';
import styles from './styles.module.css';

interface DemoData {
  id: string;
  title: string;
  image: string;
  subtitle: string;
}

const demoData: DemoData[] = [
  {
    id: 'week',
    title: 'Weekly Planning',
    image: '/img/screenshots/week.png',
    subtitle: 'Organize your entire week',
  },
  {
    id: 'kira',
    title: 'AI Assistant',
    image: '/img/screenshots/kira.png',
    subtitle: 'Chat with your productivity companion',
  },
  {
    id: 'focus',
    title: 'Focus Sessions',
    image: '/img/screenshots/focus.png',
    subtitle: 'Deep work made simple',
  },
];

export default function InteractiveDemo() {
  const [activeDemo, setActiveDemo] = useState<string>('week');
  const currentDemo =
    demoData.find(demo => demo.id === activeDemo) || demoData[0];

  return (
    <div className={styles.demoContainer}>
      <div className={styles.demoTabs}>
        {demoData.map(demo => (
          <button
            key={demo.id}
            className={`${styles.demoTab} ${activeDemo === demo.id ? styles.demoTabActive : ''}`}
            onClick={() => setActiveDemo(demo.id)}
          >
            {demo.title}
          </button>
        ))}
      </div>
      <div className={styles.demoScreen}>
        <div className={styles.demoContent}>
          <img
            key={currentDemo.id}
            src={currentDemo.image}
            alt={`KiraPilot ${currentDemo.title}`}
            className={styles.demoImage}
            loading='eager'
          />
        </div>
        <div className={styles.demoInfo}>
          <h3 className={styles.demoTitle}>{currentDemo.title}</h3>
          <p className={styles.demoSubtitle}>{currentDemo.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
