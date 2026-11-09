import React from 'react';
import MobileLayoutSwitch from '../mobile/layouts/MobileLayoutSwitch';
import AcademyPage from './AcademyPage';
import MobileAcademyHub from '../mobile/pages/academy/MobileAcademyHub';

export default function AkademiPage({ userProfile }) {
  return (
    <MobileLayoutSwitch
      desktopComponent={AcademyPage}
      mobileComponent={MobileAcademyHub}
      userProfile={userProfile}
    />
  );
}

