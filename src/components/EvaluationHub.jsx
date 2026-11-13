import React from 'react';
import EvaluationSection from './EvaluationSection';
import ScoutingCombineHub from './ScoutingCombineHub';
import RubricAssessmentSheet from './RubricAssessmentSheet';
import ScoutingPolarAreaPanel from './ScoutingPolarAreaPanel';
import FootballAssessmentHub from './FootballAssessmentHub';

/**
 * EvaluationHub
 * Unified Football & Multi-Sport Evaluation Hub wrapping EvaluationSection,
 * ScoutingPolarAreaPanel, FootballAssessmentHub, ScoutingCombineHub, and RubricAssessmentSheet.
 */
export default function EvaluationHub(props) {
  return <EvaluationSection {...props} />;
}

export {
  EvaluationSection,
  FootballAssessmentHub,
  ScoutingCombineHub,
  RubricAssessmentSheet,
  ScoutingPolarAreaPanel
};

