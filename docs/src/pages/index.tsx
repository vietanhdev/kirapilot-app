import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import ScreenshotShowcase from '@site/src/components/ScreenshotShowcase';
import InteractiveDemo from '@site/src/components/InteractiveDemo';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className='container'>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <div className={styles.heroLabel}>
              <span className={styles.heroLabelText}>
                ✨ AI-Powered Productivity
              </span>
            </div>
            <Heading as='h1' className={clsx('hero__title', styles.heroTitle)}>
              Navigate Your Day with
              <span className={styles.heroTitleAccent}> Precision</span>
            </Heading>
            <p className={clsx('hero__subtitle', styles.heroSubtitle)}>
              Experience the perfect blend of elegant design and intelligent
              automation. See how KiraPilot transforms your productivity
              workflow through powerful features that adapt to your needs.
            </p>
            <div className={styles.heroButtons}>
              <Link
                className={clsx(
                  'button button--primary button--lg',
                  styles.heroCta
                )}
                to='/docs/user-guide/getting-started'
              >
                <span>Get Started</span>
                <svg
                  className={styles.heroCtaIcon}
                  width='20'
                  height='20'
                  viewBox='0 0 20 20'
                  fill='none'
                >
                  <path
                    d='M7.5 15L12.5 10L7.5 5'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </Link>
              <Link
                className={clsx(
                  'button button--secondary button--lg',
                  styles.heroSecondary
                )}
                to='https://github.com/vietanhdev/kirapilot-app/releases/latest'
              >
                <svg
                  className={styles.heroSecondaryIcon}
                  width='20'
                  height='20'
                  viewBox='0 0 20 20'
                  fill='none'
                >
                  <path
                    d='M3 16.5v2A1.5 1.5 0 0 0 4.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2M10 14V3M6 7l4-4 4 4'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                <span>Download Now</span>
              </Link>
            </div>
          </div>
          <div className={styles.heroDemo}>
            <InteractiveDemo />
          </div>
        </div>
      </div>
      <div className={styles.heroBackground}></div>
    </header>
  );
}

function CallToActionSection() {
  return (
    <section className={styles.ctaSection}>
      <div className='container'>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Ready to Transform Your Productivity?
          </h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of users who have already improved their daily
            workflow with KiraPilot.
          </p>
          <div className={styles.ctaButtons}>
            <Link
              className='button button--primary button--lg'
              to='/docs/user-guide/getting-started'
            >
              Start Your Journey
            </Link>
            <Link
              className='button button--secondary button--lg'
              to='https://github.com/vietanhdev/kirapilot-app/releases/latest'
            >
              Download Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} Documentation`}
      description='Comprehensive documentation for KiraPilot - Navigate your day with precision through beautiful design and smart automation.'
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <ScreenshotShowcase />
        <CallToActionSection />
      </main>
    </Layout>
  );
}
