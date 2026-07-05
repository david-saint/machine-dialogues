// Types for judge reports. Mirrors judgments/schema.json (schema_version 1).
// agentA/agentB refer to the transcript's agent_a (speaks first each round) and agent_b.

export type JudgeSlot = 'agentA' | 'agentB';
export type RoundWinner = 'agentA' | 'agentB' | 'even';
export type DecisionWinner = 'agentA' | 'agentB' | 'draw';

export type JudgeInfo = {
  name: string;
  model: string;
  thinking_level?: string;
  judged_at?: string;
};

export type JudgmentDecision = {
  winner: DecisionWinner;
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

export const JUDGMENT_SCHEMA_VERSION = 1;
