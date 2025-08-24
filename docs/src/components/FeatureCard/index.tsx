import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';

export interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  category: 'user' | 'developer';
  className?: string;
}

export default function FeatureCard({
  title,
  description,
  icon,
  link,
  category,
  className,
}: FeatureCardProps): React.JSX.Element {
  return (
    <div className={clsx('kira-feature-card', className)}>
      <div className='kira-feature-card__icon'>
        {typeof icon === 'string' ? (
          icon
        ) : (
          <div className='modern-icon'>{icon}</div>
        )}
      </div>
      <h3 className='kira-feature-card__title'>{title}</h3>
      <p className='kira-feature-card__description'>{description}</p>
      <Link
        to={link}
        className='kira-feature-card__link'
        aria-label={`Learn more about ${title}`}
      >
        <span>Learn more</span>
        <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
          <path
            d='M6 4L10 8L6 12'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </Link>
      <div className='kira-feature-card__category' data-category={category}>
        {category === 'user' ? 'User Guide' : 'Developer'}
      </div>
    </div>
  );
}
