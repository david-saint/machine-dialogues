// Types for judge reports. Mirrors judgments/schema.json (schema_version 2).
// agentA/agentB refer to the transcript's agent_a (speaks first each round) and agent_b.
// v2 splits the decision into resolution_winner (whose position stands stronger
// on the merits) and craft_winner (who debated better) so the two judgments can
// never be silently conflated.

export type JudgeSlot = 'agentA' | 'agentB';
export type RoundWinner = 'agentA' | 'agentB' | 'even';
export type DecisionWinner = 'agentA' | 'agentB' | 'draw';

export type JudgeInfo = {
  name: string;
  model: string;
  family?: string;
  thinking_level?: string;
  judged_at?: string;
};

export type JudgmentDecision = {
  resolution_winner: DecisionWinner;
  resolution_reason: string;
  craft_winner: DecisionWinner;
  craft_reason: string;
  method?: string;
  summary: string;
  caveat?: string;
};

export type JudgmentRound = {
  round: number;
  winner: RoundWinner;
  close?: boolean;
  reason: string;
};

export type JudgmentTally = {
  agentA: number;
  agentB: number;
  even: number;
  note?: string;
};

export type JudgmentKeyMoment = {
  turn: number;
  agent: JudgeSlot;
  moment: string;
  note?: string;
};

export type JudgmentAnalysisSection = {
  tag?: string;
  heading: string;
  paragraphs: string[];
};

export type JudgmentQuote = {
  agent: JudgeSlot;
  text: string;
  cite: string;
};

export type Judgment = {
  schema_version: number;
  transcript: string;
  title?: string;
  judge: JudgeInfo;
  decision: JudgmentDecision;
  rounds: JudgmentRound[];
  tally: JudgmentTally;
  key_moments?: JudgmentKeyMoment[];
  analysis?: JudgmentAnalysisSection[];
  quotes?: JudgmentQuote[];
};

// judgments.json is keyed by transcript filename (with .md), each mapping to
// an array of judgments (multiple judges per debate are supported).
export type JudgmentsByTranscript = Record<string, Judgment[]>;

export const JUDGMENT_SCHEMA_VERSION = 2;
