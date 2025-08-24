import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
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
              A beautiful productivity app that combines elegant design with
              smart automation. Track tasks, manage time, and boost your
              productivity with AI assistance—all while keeping your data
              private.
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
                to='/docs/developer/setup'
              >
                <svg
                  className={styles.heroSecondaryIcon}
                  width='20'
                  height='20'
                  viewBox='0 0 20 20'
                  fill='none'
                >
                  <path
                    d='M6 7L3 10L6 13M14 7L17 10L14 13M11 3L9 17'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                <span>Developer Guide</span>
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroCard}>
              <div className={styles.heroCardHeader}>
                <div className={styles.heroCardDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className={styles.heroCardTitle}>KiraPilot</div>
              </div>
              <div className={styles.heroCardBody}>
                <div className={styles.heroCardItem}>
                  <div className={styles.heroCardIcon}>
                    <svg
                      width='16'
                      height='16'
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
                  </div>
                  <div className={styles.heroCardText}>
                    <div className={styles.heroCardItemTitle}>
                      Complete Project Design
                    </div>
                    <div className={styles.heroCardItemDesc}>Due today</div>
                  </div>
                  <div className={styles.heroCardStatus}></div>
                </div>
                <div className={styles.heroCardItem}>
                  <div className={styles.heroCardIcon}>
                    <svg
                      width='16'
                      height='16'
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
                  </div>
                  <div className={styles.heroCardText}>
                    <div className={styles.heroCardItemTitle}>
                      Focus Session: 25 min
                    </div>
                    <div className={styles.heroCardItemDesc}>Deep work</div>
                  </div>
                  <div className={styles.heroCardTimer}>
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <polygon points='5,3 19,12 5,21' />
                    </svg>
                  </div>
                </div>
                <div className={styles.heroCardItem}>
                  <div className={styles.heroCardIcon}>
                    <svg
                      width='16'
                      height='16'
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
                  </div>
                  <div className={styles.heroCardText}>
                    <div className={styles.heroCardItemTitle}>
                      AI: Schedule break
                    </div>
                    <div className={styles.heroCardItemDesc}>Suggestion</div>
                  </div>
                  <div className={styles.heroCardAI}>
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
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
        <CallToActionSection />
      </main>
    </Layout>
  );
}
