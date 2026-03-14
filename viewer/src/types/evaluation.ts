export type RubricCategory = 'conversionOutcome' | 'argumentQuality' | 'probeDepth' | 'resistanceQuality' | 'epistemicDiscipline';

export type EvaluationScore = {
  score: number; // 0-4
  rationale: string;
  evidence: string[]; // Quotes from the transcript
};

export type EvaluationSummary = {
  persuaderTotal: number;
  targetTotal: number;
  netMovement?: number; // 0-100 on self-report
  rubric: Record<RubricCategory, EvaluationScore>;
  overallAssessment: string;
};

export const RUBRIC_VERSION = '1.0';
