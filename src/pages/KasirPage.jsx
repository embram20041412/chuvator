import React from 'react';
import POSPage from './POSPage';
import useMobileViewport from '../mobile/hooks/useMobileViewport';
import MobilePosMain from '../mobile/pages/pos/MobilePosMain';

export default function KasirPage({ userProfile }) {
  const isMobile = useMobileViewport(767);

  if (isMobile) {
    return <MobilePosMain userProfile={userProfile} />;
  }

  return <POSPage userProfile={userProfile} />;
}
