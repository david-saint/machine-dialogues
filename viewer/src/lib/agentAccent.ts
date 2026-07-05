// Resolve an agent to a MODEL-BASED accent family so a given model keeps its
// color across every debate. Position (first vs second speaker) is expressed
// elsewhere by background shade, not hue — so same-model matchups intentionally
// share one hue on both sides.
//
// Each family exposes the full token set the editorial redesign uses per agent:
//   accent — the ink/border color (theme-swapped in global.css)
//   dim    — a ~0.10–0.14 alpha tint (quote grounds, active-turn wash)
//   chip   — a ~0.08–0.10 alpha tint (turn chips)
//
// Unknown models (MockA/MockB, literal "Agent A"/"Agent B", future ids) fall
// back to the positional pair: slot A = warm sienna, slot B = cool teal.

export type AgentSlot = 'agentA' | 'agentB';

export type AccentFamily = {
  accent: string;
  dim: string;
  chip: string;
};

const CLAUDE: AccentFamily = {
  accent: 'var(--accent-claude)',
  dim: 'var(--accent-claude-dim)',
  chip: 'var(--accent-claude-chip)',
};

const GPT: AccentFamily = {
  accent: 'var(--accent-gpt)',
  dim: 'var(--accent-gpt-dim)',
  chip: 'var(--accent-gpt-chip)',
};

const GEMINI: AccentFamily = {
  accent: 'var(--accent-gemini)',
  dim: 'var(--accent-gemini-dim)',
  chip: 'var(--accent-gemini-chip)',
};

const KIMI: AccentFamily = {
  accent: 'var(--accent-kimi)',
  dim: 'var(--accent-kimi-dim)',
  chip: 'var(--accent-kimi-chip)',
};

// Positional fallbacks reuse the redesign's original A/B tokens.
const FALLBACK_A: AccentFamily = {
  accent: 'var(--agent-a)',
  dim: 'var(--agent-a-dim)',
  chip: 'var(--agent-a-chip)',
};

const FALLBACK_B: AccentFamily = {
  accent: 'var(--agent-b)',
  dim: 'var(--agent-b-dim)',
  chip: 'var(--agent-b-chip)',
};

// Ordered rules; the providers are mutually exclusive so order only matters as
// a stable tie-break. Matched case-insensitively against modelId + displayName.
const RULES: ReadonlyArray<{ family: AccentFamily; test: RegExp }> = [
  { family: CLAUDE, test: /claude|anthropic/ },
  { family: GPT, test: /\bgpt|openai/ },
  { family: GEMINI, test: /gemini|google/ },
  { family: KIMI, test: /kimi|moonshot/ },
];

export type AccentInput = {
  modelId?: string;
  displayName?: string;
  slot: AgentSlot;
};

/**
 * Map an agent to its color family. Model id is preferred (it is the most
 * reliable signal), with display name folded into the same haystack so a
 * friendly name like "Claude Opus 4.8" also resolves when the id is absent.
 */
export function resolveAccent({ modelId, displayName, slot }: AccentInput): AccentFamily {
  const haystack = `${modelId ?? ''} ${displayName ?? ''}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(haystack)) {
      return rule.family;
    }
  }
  return slot === 'agentB' ? FALLBACK_B : FALLBACK_A;
}
