import React from 'react';
import { useDoc } from '@docusaurus/theme-common/internal';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import styles from './styles.module.css';

interface PageProgressionProps {
  previous?: {
    title: string;
    permalink: string;
  };
  next?: {
    title: string;
    permalink: string;
  };
}

const PageProgression: React.FC<PageProgressionProps> = ({
  previous,
  next,
}) => {
  // If no navigation items, don't render
  if (!previous && !next) {
    return null;
  }

  return (
    <nav className={styles.pageProgression} aria-label='Page navigation'>
      <div className={styles.progressionContainer}>
        {previous && (
          <Link
            to={previous.permalink}
            className={clsx(styles.progressionLink, styles.progressionPrevious)}
          >
            <div className={styles.progressionDirection}>
              <span className={styles.progressionArrow}>←</span>
              <span className={styles.progressionLabel}>
                {translate({
                  id: 'theme.docs.paginator.previous',
                  message: 'Previous',
                })}
              </span>
            </div>
            <div className={styles.progressionTitle}>{previous.title}</div>
          </Link>
        )}

        {next && (
          <Link
            to={next.permalink}
            className={clsx(styles.progressionLink, styles.progressionNext)}
          >
            <div className={styles.progressionDirection}>
              <span className={styles.progressionLabel}>
                {translate({
                  id: 'theme.docs.paginator.next',
                  message: 'Next',
                })}
              </span>
              <span className={styles.progressionArrow}>→</span>
            </div>
            <div className={styles.progressionTitle}>{next.title}</div>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default PageProgression;
