import React from 'react';
import { useLocation } from '@docusaurus/router';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import styles from './styles.module.css';

interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

const BreadcrumbNavigation: React.FC = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Skip if we're on the home page or not in docs
  if (pathSegments.length === 0 || !pathSegments.includes('docs')) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [];

  // Build breadcrumb items from path segments, but only for valid paths
  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;

    // Convert segment to readable label
    let label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    // Special cases for known segments
    if (segment === 'docs') {
      label = translate({
        id: 'breadcrumb.docs',
        message: 'Documentation',
      });
      // Don't link to /docs as it doesn't exist
      breadcrumbs.push({
        label,
        href: undefined,
        isActive: isLast,
      });
    } else if (segment === 'user-guide') {
      label = translate({
        id: 'breadcrumb.userGuide',
        message: 'User Guide',
      });
      // Don't link to category pages
      breadcrumbs.push({
        label,
        href: undefined,
        isActive: isLast,
      });
    } else if (segment === 'developer') {
      label = translate({
        id: 'breadcrumb.developer',
        message: 'Developer',
      });
      // Don't link to category pages
      breadcrumbs.push({
        label,
        href: undefined,
        isActive: isLast,
      });
    } else if (segment === 'api') {
      label = translate({
        id: 'breadcrumb.api',
        message: 'API Reference',
      });
      // Don't link to category pages
      breadcrumbs.push({
        label,
        href: undefined,
        isActive: isLast,
      });
    } else {
      // Only add actual page links for the final segment
      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        isActive: isLast,
      });
    }
  });

  return (
    <nav className={styles.breadcrumbNav} aria-label='Breadcrumb'>
      <ol className={styles.breadcrumbList}>
        {breadcrumbs.map((item, index) => (
          <li key={index} className={styles.breadcrumbItem}>
            {item.href ? (
              <Link
                to={item.href}
                className={clsx(styles.breadcrumbLink, {
                  [styles.breadcrumbLinkActive]: item.isActive,
                })}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={clsx(styles.breadcrumbText, {
                  [styles.breadcrumbTextActive]: item.isActive,
                })}
                aria-current='page'
              >
                {item.label}
              </span>
            )}
            {index < breadcrumbs.length - 1 && (
              <span className={styles.breadcrumbSeparator} aria-hidden='true'>
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default BreadcrumbNavigation;
