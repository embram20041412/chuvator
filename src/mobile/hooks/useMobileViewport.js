import { useState, useEffect } from 'react';

/**
 * useMobileViewport Hook
 * Returns `isMobile` boolean for viewport widths up to 767px.
 * Preserves desktop (>= 768px) and tablet presentations without duplicating state.
 */
export default function useMobileViewport(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= breakpoint;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
