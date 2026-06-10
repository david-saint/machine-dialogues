from pathlib import Path

from research_harness.config import AgentConfig, ExperimentConfig
from research_harness.pricing import CostTracker
from research_harness.runner import _tracker_keys
from research_harness.transcript import parse_cost_summary

SAMPLE = """# Experiment: Claude Opus 4.6 vs Claude Opus 4.6
**Turns:** 9

## Conversation

### INITIAL — Claude Opus 4.6: anthropic/claude-opus-4.6

Hello

## Cost Summary

| Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |
|-------|-------------|---------------|-----------------|------------|
| Claude Opus 4.6 (A) | 46,737 | 2,378 | 0 | $0.293135 |
| Claude Opus 4.6 (B) | 12,000 | 1,500 | 100 | $0.100000 |
| **Total** | 58,737 | 3,878 | 100 | **$0.393135** |
"""


def _config(name_a="Claude Opus 4.6", name_b="Claude Opus 4.6"):
    return ExperimentConfig(
        agent_a=AgentConfig(name=name_a, provider="mock", model="m"),
        agent_b=AgentConfig(name=name_b, provider="mock", model="m"),
        initial_message="hi",
        turns=1,
    )


def test_tracker_keys_disambiguate_mirror_match():
    assert _tracker_keys(_config()) == ("Claude Opus 4.6 (A)", "Claude Opus 4.6 (B)")


def test_tracker_keys_pass_through_distinct_names():
    assert _tracker_keys(_config(name_b="GPT-5.4")) == ("Claude Opus 4.6", "GPT-5.4")


def test_mirror_match_costs_do_not_collide():
    tracker = CostTracker(pricing={"m": {"input": 5, "output": 25}})
    key_a, key_b = _tracker_keys(_config())
    tracker.add(key_a, "m", 1000, 100)
    tracker.add(key_b, "m", 2000, 200)
    assert len(tracker.per_agent) == 2
    assert tracker.per_agent[key_a]["input_tokens"] == 1000
    assert tracker.per_agent[key_b]["input_tokens"] == 2000
    assert tracker.totals["input_tokens"] == 3000


def test_parse_cost_summary_skips_total_row(tmp_path: Path):
    path = tmp_path / "t.md"
    path.write_text(SAMPLE)
    rows = parse_cost_summary(path)
    assert [r["agent"] for r in rows] == ["Claude Opus 4.6 (A)", "Claude Opus 4.6 (B)"]
    assert rows[0] == {
        "agent": "Claude Opus 4.6 (A)",
        "input_tokens": 46737,
        "output_tokens": 2378,
        "thinking_tokens": 0,
    }
    assert rows[1]["thinking_tokens"] == 100


def test_parse_cost_summary_missing_section(tmp_path: Path):
    path = tmp_path / "t.md"
    path.write_text("# Experiment\n\n## Conversation\n\n### INITIAL — A: m\n\nhi\n")
    assert parse_cost_summary(path) == []


def test_seeded_tracker_accumulates_across_sessions(tmp_path: Path):
    path = tmp_path / "t.md"
    path.write_text(SAMPLE)
    tracker = CostTracker(pricing={"m": {"input": 5, "output": 25}})
    for row in parse_cost_summary(path):
        tracker.add(row["agent"], "m", row["input_tokens"], row["output_tokens"], row["thinking_tokens"])
    tracker.add("Claude Opus 4.6 (A)", "m", 500, 50)
    assert tracker.per_agent["Claude Opus 4.6 (A)"]["input_tokens"] == 47237
    assert tracker.totals["output_tokens"] == 3928
