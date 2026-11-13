import React from 'react';
import EvaluationSection from './EvaluationSection';
import ScoutingPolarAreaPanel from './ScoutingPolarAreaPanel';
import FootballAssessmentHub from './FootballAssessmentHub';

/**
 * EvaluationHub
 * Unified Football & Multi-Sport Evaluation Hub wrapping EvaluationSection,
 * ScoutingPolarAreaPanel, and FootballAssessmentHub (Master Test Library).
 */
export default function EvaluationHub(props) {
  return <EvaluationSection {...props} />;
}

export {
  EvaluationSection,
  FootballAssessmentHub,
  ScoutingPolarAreaPanel
};
