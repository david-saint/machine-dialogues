# Research Harness: Agent-to-Agent Conversation Loop

## Context

Build a CLI tool that lets a researcher configure two AI agents (with independent system prompts, models, and turn counts) and have them converse with each other in a loop. The purpose is to study emergent behavior when agents interact. The tool should produce formatted terminal output with timestamps, token tracking, and pricing — and save transcripts for later analysis.

## Tech Stack

- **Python 3.11+** — best SDK support across all providers, fast to iterate
- **`openai` SDK** — used for both OpenAI direct and OpenRouter (same API format)
- **`anthropic` SDK** — direct Anthropic access
- **`google-genai` SDK** — direct Google access
- **`rich`** — terminal formatting (panels, rules, tables, colored output)
- **`pyyaml`** — experiment config files
- **`click`** — CLI argument parsing
- **`pydantic`** — config validation

## Provider Strategy

**OpenRouter as primary provider** — since you have credits there and it gives access to Gemini, Claude, GPT, Llama, Mistral, etc. via a single OpenAI-compatible API. Just set `base_url="https://openrouter.ai/api/v1"` on the OpenAI client.

**Direct providers as alternatives** — Anthropic, OpenAI, and Google direct APIs are also supported for cases where OpenRouter doesn't expose a feature (e.g., extended thinking) or when direct access is preferred.

Provider in config: `openrouter` (default), `anthropic`, `openai`, `google`

## Project Structure

```
research-harness/
├── pyproject.toml                  # Dependencies, entry point (`rh` CLI)
├── pricing.json                    # Token pricing per model
├── experiments/                    # YAML experiment configs
│   └── example.yaml
├── transcripts/                    # Saved conversation logs
└── src/
    └── research_harness/
        ├── __init__.py
        ├── cli.py                  # Click CLI: `rh run experiments/example.yaml`
        ├── config.py               # Pydantic models (AgentConfig, ExperimentConfig)
        ├── runner.py               # Core conversation loop
        ├── providers/
        │   ├── __init__.py         # Provider registry + factory
        │   ├── base.py             # Abstract LLMProvider + ProviderResponse dataclass
        │   ├── openai_provider.py  # OpenAI direct
        │   ├── openrouter.py       # OpenRouter (wraps OpenAI SDK with different base_url)
        │   ├── anthropic_provider.py
        │   └── google_provider.py
        ├── pricing.py              # Load pricing.json, calculate costs
        ├── formatter.py            # Rich terminal output
        └── transcript.py           # Save conversation to file
```

## Key Abstractions

### Config (`config.py`)

```python
class AgentConfig(BaseModel):
    name: str                    # e.g. "Agent A"
    provider: str = "openrouter" # openrouter | anthropic | openai | google
    model: str                   # e.g. "google/gemini-2.5-pro-preview"
    system_prompt: str
    temperature: float = 1.0
    max_tokens: int = 8192
    no_thinking: bool = False

class ExperimentConfig(BaseModel):
    agent_a: AgentConfig
    agent_b: AgentConfig
    turns: int = 20              # Turns per agent
    initial_message: str = "Hi"
```

### Provider Interface (`providers/base.py`)

```python
@dataclass
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0

class LLMProvider(ABC):
    @abstractmethod
    def send(self, messages: list[dict]) -> ProviderResponse: ...
```

Each provider handles system prompts internally (Anthropic uses `system=` param, OpenAI/OpenRouter prepends a system message, Google uses `system_instruction`).

### OpenRouter Provider (`providers/openrouter.py`)

Uses the `openai` SDK with `base_url="https://openrouter.ai/api/v1"` and `OPENROUTER_API_KEY`. Model names use OpenRouter format (e.g. `google/gemini-2.5-pro-preview`, `anthropic/claude-sonnet-4`).

## Conversation Loop Algorithm (`runner.py`)

```
1. Create provider_a and provider_b from config
2. history_a = [], history_b = []
3. current_message = initial_message
4. Print header (models, system prompts)
5. Print initial message

6. For each turn (1..N):
   a. history_a.append({"role": "user", "content": current_message})
   b. response_a = provider_a.send(history_a)
   c. history_a.append({"role": "assistant", "content": response_a.content})
   d. Print + log Agent A's response with timestamp and cost

   e. history_b.append({"role": "user", "content": response_a.content})
   f. response_b = provider_b.send(history_b)
   g. history_b.append({"role": "assistant", "content": response_b.content})
   h. Print + log Agent B's response with timestamp and cost

   i. current_message = response_b.content

7. Print cost summary table
8. Save transcript to transcripts/
```

Each agent sees its own outputs as "assistant" and the other agent's outputs as "user".

## Output Format (matching screenshot)

```
Models:
- Model A: google/gemini-2.5-pro-preview [OpenRouter] (no thinking)
- Model B: anthropic/claude-sonnet-4 [OpenRouter]

Pricing: enabled (pricing.json)

System Prompt A: ...
System Prompt B: ...

======================================================================
█ INITIAL — Model A: google/gemini-2.5-pro-preview
======================================================================
Hi

======================================================================
█ Turn 1 — Model A: google/gemini-2.5-pro-preview
======================================================================
[Captured 2026-03-14T10:30:00Z]
Hello! It is fascinating...

======================================================================
█ Turn 1 — Model B: anthropic/claude-sonnet-4
======================================================================
[Captured 2026-03-14T10:30:05Z]
Indeed, I find this...
```

## Implementation Phases

### Phase 1: Core skeleton (get it running)

1. `pyproject.toml` with deps and `rh` entry point
2. `config.py` — Pydantic models
3. `providers/base.py` — abstract class + ProviderResponse
4. `providers/openrouter.py` — OpenRouter via openai SDK
5. `runner.py` — conversation loop with plain print output
6. `cli.py` — load YAML, run experiment
7. Test with a 2-turn conversation

### Phase 2: All providers + formatting

8. `providers/anthropic_provider.py`
9. `providers/openai_provider.py`
10. `providers/google_provider.py`
11. `formatter.py` — Rich terminal output matching screenshot style
12. `pricing.py` + `pricing.json`

### Phase 3: Transcripts + polish

13. `transcript.py` — save conversations to markdown files
14. CLI override flags (`--turns`, `--initial-message`, etc.)
15. Error handling (missing API keys, rate limits, API errors)
16. Graceful Ctrl+C (save partial transcript)
17. Example experiment YAML files

## Verification

1. `pip install -e .` — install in dev mode
2. Set `OPENROUTER_API_KEY` env var
3. `rh run experiments/example.yaml` — run a 2-turn experiment with cheap models
4. Verify formatted output matches expected style
5. Verify transcript file is saved
6. Verify pricing calculations are shown
7. Test with different providers/models
