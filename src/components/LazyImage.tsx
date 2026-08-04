/**
 * LazyImage — performance-optimised image component for City Gate Capital.
 *
 * Features:
 * - Native lazy loading (`loading="lazy"`) for below-the-fold images
 * - `fetchpriority="high"` for LCP / hero images (`priority` prop)
 * - `decoding="async"` on all images to avoid blocking the main thread
 * - Responsive `srcSet` + `sizes` support for stock/CDN images
 * - Graceful fade-in on load to avoid layout flash
 * - Skeleton placeholder while loading
 */

import { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  /** Marks this as an LCP/hero image — sets fetchpriority="high" and loading="eager" */
  priority?: boolean;
  /** Optional srcSet string, e.g. "img-400.jpg 400w, img-800.jpg 800w" */
  srcSet?: string;
  /** sizes attribute, e.g. "(max-width: 768px) 100vw, 50vw" */
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  /** Aspect ratio for the skeleton placeholder, e.g. "16/9" or "1/1" */
  aspectRatio?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export default function LazyImage({
  src,
  alt,
  priority = false,
  srcSet,
  sizes,
  className = '',
  style,
  width,
  height,
  aspectRatio,
  onLoad,
  onError,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image is already cached the `load` event won't fire — check complete
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setErrored(true);
    onLoad?.(); // remove skeleton even on error
    onError?.();
  };

  return (
    <span
      className="relative block overflow-hidden"
      style={aspectRatio ? { aspectRatio, ...style } : style}
    >
      {/* Skeleton shown until image loads */}
      {!loaded && !errored && (
        <span
          className="absolute inset-0 animate-pulse"
          style={{ background: 'rgba(255,255,255,0.04)' }}
          aria-hidden="true"
        />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        srcSet={srcSet}
        sizes={sizes}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // @ts-expect-error — fetchpriority is valid HTML but not yet in all TS defs
        fetchpriority={priority ? 'high' : 'auto'}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={aspectRatio ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
      />
    </span>
  );
}
