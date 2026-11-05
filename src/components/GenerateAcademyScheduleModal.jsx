import React from 'react';
import LockScheduleModal from './LockScheduleModal';

/**
 * Backward compatibility wrapper for GenerateAcademyScheduleModal.
 * Delegates to the enhanced LockScheduleModal with Smart Routine Booking & Collision Suggestion.
 */
export default function GenerateAcademyScheduleModal(props) {
  return <LockScheduleModal {...props} />;
}
