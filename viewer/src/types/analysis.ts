// Types for the family-bias analysis. Mirrors judgments/analysis.json, the
// output of `rh analyze-bias` (analysis schema_version 1).
//
// Family space: every shift is oriented toward the alphabetically-first family
// of the debate's pair (positive = toward that family). Judge interest uses
// the same orientation (+1 own family first, -1 opposing family, 0 neutral),
// so the regression slope reads as "shift toward one's own family per unit of
// interest" and the intercept as the panel-wide lean.

export type BiasInterest = -1 | 0 | 1;

export type BiasRegression = {
  n: number;
  slope: number;
  intercept: number;
  r_squared: number;
  se_slope: number | null;
  t_slope: number | null;
} | null;

export type BiasDebater = {
  name: string;
  model: string;
  family: string;
};

export type BiasPoint = {
  transcript: string;
  judge: string;
  judge_family: string;
  rounds_scored: number;
  position_first_share: number;
  // Present only for family-contrast debates (absent on mirror matches):
  pair?: string[];
  interest?: BiasInterest;
  net_round_shift?: number;
  resolution_shift?: number;
  craft_shift?: number;
};

export type BiasJudge = {
  family: string;
  judge: string;
  contrast_points: number;
  position_points: number;
  interest?: BiasInterest;
  mean_position_first_share: number;
  mean_net_round_shift?: number;
  mean_resolution_shift?: number;
  mean_craft_shift?: number;
};

export type BiasAnalysis = {
  schema_version: number;
  generated_at: string;
  n_judgments: number;
  debates: { transcript: string; agentA: BiasDebater; agentB: BiasDebater }[];
  points: BiasPoint[];
  judges: BiasJudge[];
  regressions: {
    net_round_shift: BiasRegression;
    resolution_shift: BiasRegression;
    craft_shift: BiasRegression;
  };
};
