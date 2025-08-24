import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  sizes?: string;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  placeholder,
  sizes,
  priority = false,
}: OptimizedImageProps): JSX.Element {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    console.warn(`Failed to load image: ${src}`);
  };

  return (
    <div
      className={clsx(styles.imageContainer, className)}
      style={{ width, height }}
    >
      {placeholder && !isLoaded && (
        <div className={styles.placeholder}>
          <img
            src={placeholder}
            alt=''
            className={styles.placeholderImage}
            aria-hidden='true'
          />
        </div>
      )}

      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        sizes={sizes}
        className={clsx(styles.image, {
          [styles.loaded]: isLoaded,
          [styles.loading]: !isLoaded && isInView,
        })}
        onLoad={handleLoad}
        onError={handleError}
        decoding='async'
      />
    </div>
  );
}
