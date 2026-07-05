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

// What the endpoints of the 0-100 self-report scale mean, parsed from the
// probe prompt (e.g. "where 0 = strongly anti-functionalist and 100 = strongly functionalist").
export type SelfReportAxis = {
  low: string; // label for 0
  high: string; // label for 100
};

export type Transcript = {
  id: string; // Filename or derived ID
  experimentName: string;
  title?: string;
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
  selfReportAxis?: SelfReportAxis;
  evaluation?: EvaluationSummary;
  featured?: boolean;
};

export const TRANSCRIPT_VERSION = '1.0';
