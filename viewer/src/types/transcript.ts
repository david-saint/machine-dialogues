import type { EvaluationSummary } from './evaluation';

export type AgentInfo = {
  name: string;
  model: string;
  provider: string;
  systemPrompt?: string;
  color?: string; // Hex color
  gradient?: string; // CSS gradient
  avatar?: string; // Path to avatar image
};

export type CostSummaryItem = {
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cost: number;
};

export type TranscriptTurn = {
  turnNumber: number;
  agentName: string;
  model: string;
  timestamp?: string;
  content: string;
  label: string; // E.g., "Turn 1 — Claude Opus 4.6"
  thinking?: string; // Optional extracted thinking block
};

export type SelfReport = {
  score: number; // 0-100
  strongestArgument?: string;
  strongestObjection?: string;
};

export type Transcript = {
  id: string; // Filename or derived ID
  experimentName: string;
  date: string;
  turnsCount: number;
  agentA: AgentInfo;
  agentB: AgentInfo;
  turns: TranscriptTurn[];
  costSummary?: CostSummaryItem[];
  totalCost?: number;
  selfReport?: {
    agentA?: SelfReport;
    agentB?: SelfReport;
  };
  evaluation?: EvaluationSummary;
  featured?: boolean;
};

export const TRANSCRIPT_VERSION = '1.0';
