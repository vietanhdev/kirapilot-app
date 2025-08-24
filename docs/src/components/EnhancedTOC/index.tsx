import React, { useState, useEffect } from 'react';
import { useLocation } from '@docusaurus/router';
import { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import styles from './styles.module.css';

interface TOCItem {
  id: string;
  value: string;
  level: number;
  children?: TOCItem[];
}

interface EnhancedTOCProps {
  toc: TOCItem[];
  minHeadingLevel?: number;
  maxHeadingLevel?: number;
}

const EnhancedTOC: React.FC<EnhancedTOCProps> = ({
  toc,
  minHeadingLevel = 2,
  maxHeadingLevel = 4,
}) => {
  const [activeId, setActiveId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Filter TOC items based on heading levels
  const filteredToc = toc.filter(
    item => item.level >= minHeadingLevel && item.level <= maxHeadingLevel
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0% -35% 0%',
        threshold: 0,
      }
    );

    // Observe all headings
    const headings = document.querySelectorAll('h2, h3, h4, h5, h6');
    headings.forEach(heading => observer.observe(heading));

    return () => observer.disconnect();
  }, [location.pathname]);

  const handleItemClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const renderTOCItem = (item: TOCItem) => {
    const isActive = activeId === item.id;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <li key={item.id} className={styles.tocItem}>
        <a
          href={`#${item.id}`}
          className={clsx(styles.tocLink, {
            [styles.tocLinkActive]: isActive,
            [styles.tocLinkLevel2]: item.level === 2,
            [styles.tocLinkLevel3]: item.level === 3,
            [styles.tocLinkLevel4]: item.level === 4,
          })}
          onClick={e => {
            e.preventDefault();
            handleItemClick(item.id);
          }}
        >
          {item.value}
        </a>
        {hasChildren && (
          <ul className={styles.tocSubList}>
            {item.children!.map(renderTOCItem)}
          </ul>
        )}
      </li>
    );
  };

  if (!filteredToc || filteredToc.length === 0) {
    return null;
  }

  return (
    <div className={styles.tocWrapper}>
      <div className={styles.tocHeader}>
        <h3 className={styles.tocTitle}>
          {translate({
            id: 'theme.TOCCollapsible.toggleButtonLabel',
            message: 'On this page',
          })}
        </h3>
        <button
          className={styles.tocToggle}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={translate({
            id: 'theme.TOCCollapsible.toggleButtonLabel',
            message: 'Toggle table of contents',
          })}
        >
          <span
            className={clsx(styles.tocToggleIcon, {
              [styles.tocToggleIconCollapsed]: isCollapsed,
            })}
          >
            ▼
          </span>
        </button>
      </div>
      <nav
        className={clsx(styles.tocNav, {
          [styles.tocNavCollapsed]: isCollapsed,
        })}
        aria-label='Table of contents'
      >
        <ul className={styles.tocList}>{filteredToc.map(renderTOCItem)}</ul>
      </nav>
    </div>
  );
};

export default EnhancedTOC;
