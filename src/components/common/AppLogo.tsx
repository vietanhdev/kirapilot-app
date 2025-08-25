import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 32,
  className = '',
  onClick,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      className={`bg-green-500 rounded-lg flex items-center justify-center shadow-sm transition-all duration-200 ${
        isClickable
          ? 'cursor-pointer hover:scale-110 hover:shadow-md active:scale-105'
          : ''
      } ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      title={isClickable ? 'Return to Week view' : undefined}
    >
      <svg
        xmlns='http://www.w3.org/2000/svg'
        width={size * 0.625}
        height={size * 0.625}
        viewBox='0 0 24 24'
        fill='none'
        stroke='white'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M21.801 10A10 10 0 1 1 17 3.335' />
        <path d='m9 11 3 3L22 4' />
      </svg>
    </div>
  );
};
