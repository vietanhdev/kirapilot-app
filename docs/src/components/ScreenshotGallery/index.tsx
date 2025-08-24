import React, { useState } from 'react';
import clsx from 'clsx';

export interface ScreenshotItem {
  src: string;
  alt: string;
  caption?: string;
  title?: string;
}

export interface ScreenshotGalleryProps {
  images: ScreenshotItem[];
  layout: 'grid' | 'carousel';
  className?: string;
}

export default function ScreenshotGallery({
  images,
  layout = 'grid',
  className,
}: ScreenshotGalleryProps): React.JSX.Element {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + images.length) % images.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  if (layout === 'carousel') {
    return (
      <div className={clsx('kira-screenshot-gallery', className)}>
        <div className='kira-screenshot-gallery__carousel'>
          <div
            className='kira-screenshot-gallery__carousel-track'
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {images.map((image, index) => (
              <div
                key={index}
                className='kira-screenshot-gallery__carousel-slide'
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className='kira-screenshot-gallery__image'
                  loading='lazy'
                />
                {(image.caption || image.title) && (
                  <div className='kira-screenshot-gallery__caption'>
                    {image.title && (
                      <div className='kira-screenshot-gallery__caption-title'>
                        {image.title}
                      </div>
                    )}
                    {image.caption && (
                      <p className='kira-screenshot-gallery__caption-text'>
                        {image.caption}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          <button
            className='kira-screenshot-gallery__nav kira-screenshot-gallery__nav--prev'
            onClick={prevSlide}
            aria-label='Previous image'
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '3rem',
              height: '3rem',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </button>

          <button
            className='kira-screenshot-gallery__nav kira-screenshot-gallery__nav--next'
            onClick={nextSlide}
            aria-label='Next image'
            style={{
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '3rem',
              height: '3rem',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            →
          </button>

          {/* Dots indicator */}
          <div className='kira-screenshot-gallery__carousel-controls'>
            {images.map((_, index) => (
              <button
                key={index}
                className={clsx(
                  'kira-screenshot-gallery__carousel-dot',
                  index === currentSlide &&
                    'kira-screenshot-gallery__carousel-dot--active'
                )}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Grid layout
  return (
    <div className={clsx('kira-screenshot-gallery', className)}>
      <div className='kira-screenshot-gallery__grid'>
        {images.map((image, index) => (
          <div key={index} className='kira-screenshot-gallery__item'>
            <img
              src={image.src}
              alt={image.alt}
              className='kira-screenshot-gallery__image'
              loading='lazy'
            />
            {(image.caption || image.title) && (
              <div className='kira-screenshot-gallery__caption'>
                {image.title && (
                  <div className='kira-screenshot-gallery__caption-title'>
                    {image.title}
                  </div>
                )}
                {image.caption && (
                  <p className='kira-screenshot-gallery__caption-text'>
                    {image.caption}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
