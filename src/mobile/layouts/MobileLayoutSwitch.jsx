import React from 'react';
import useMobileViewport from '../hooks/useMobileViewport';

/**
 * MobileLayoutSwitch Component
 * Presentational viewport-based layout switch.
 * - Width <= 767px: Renders Mobile Presentation wrapper (`.chua-mobile-app`).
 * - Width >= 768px: Renders Desktop Presentation (100% untouched).
 */
export default function MobileLayoutSwitch({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  ...props
}) {
  const isMobile = useMobileViewport(767);

  if (isMobile && MobileComponent) {
    return (
      <div className="chua-mobile-app">
        <MobileComponent {...props} />
      </div>
    );
  }

  return <DesktopComponent {...props} />;
}
