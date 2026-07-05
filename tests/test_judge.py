"""Tests for judge scoring of debate transcripts (no live API calls)."""

import json
import textwrap
from pathlib import Path

import pytest

from research_harness import judge as judge_mod
from research_harness.judge import (
    JudgeError,
    build_judge_block,
    count_rounds,
    extract_json_object,
    finalize_judgment,
    judgment_output_path,
    parse_transcript_agents,
    recompute_tally,
    run_judge,
    slugify,
    strip_code_fences,
    validate_judgment,
)


TRANSCRIPT = textwrap.dedent("""\
    # Experiment: Claude Opus 4.8 vs GPT-5.5
    **Turns:** 2

    ## Conversation

    ### INITIAL — Claude Opus 4.8: anthropic/claude-opus-4.8

    Let's debate.

    ### Turn 1 — Claude Opus 4.8: anthropic/claude-opus-4.8
    *2026-07-04T20:00:00Z*

    ### A header inside my argument

    I argue for X.

    ### Turn 1 — GPT-5.5: openai/gpt-5.5
    *2026-07-04T20:00:30Z*

    I argue for Y.

    ### Turn 2 — Claude Opus 4.8: anthropic/claude-opus-4.8
    *2026-07-04T20:01:00Z*

    Rebuttal from A.

    ### Turn 2 — GPT-5.5: openai/gpt-5.5
    *2026-07-04T20:01:30Z*

    Rebuttal from B.

    ## Cost Summary

    | Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |
    |-------|-------------|---------------|-----------------|------------|
    | Claude Opus 4.8 | 1,000 | 500 | 0 | $0.010000 |
""")

MIRROR_TRANSCRIPT = textwrap.dedent("""\
    # Experiment: Claude Opus 4.6 vs Claude Opus 4.6

    ## Conversation

    ### INITIAL — Claude Opus 4.6: anthropic/claude-opus-4.6

    hi

    ### Turn 1 — Claude Opus 4.6: anthropic/claude-opus-4.6

    A first.

    ### Turn 1 — Claude Opus 4.6: anthropic/claude-opus-4.6

    B second.
""")


def _valid_judgment(rounds_winners=("agentA", "agentB", "even"), tally=None):
    rounds = [
        {"round": i + 1, "winner": w, "close": False, "reason": "because."}
        for i, w in enumerate(rounds_winners)
    ]
    obj = {
        "schema_version": 1,
        "transcript": "t.md",
        "judge": {"name": "Judge", "model": "m", "judged_at": "2026-07-05"},
        "decision": {"winner": "agentA", "method": "wins on points", "summary": "A edged it."},
        "rounds": rounds,
        "tally": tally if tally is not None else {"agentA": 1, "agentB": 1, "even": 1},
    }
    return obj


# --------------------------------------------------------------------------
# JSON extraction
# --------------------------------------------------------------------------

class TestExtractJson:
    def test_plain_object(self):
        assert extract_json_object('{"a": 1}') == {"a": 1}

    def test_fenced_json_block(self):
        raw = '```json\n{"a": 1, "b": [2, 3]}\n```'
        assert extract_json_object(raw) == {"a": 1, "b": [2, 3]}

    def test_fenced_without_language(self):
        raw = '```\n{"a": 1}\n```'
        assert extract_json_object(raw) == {"a": 1}

    def test_prose_around_object(self):
        raw = 'Here is my judgment:\n{"winner": "agentA"}\nHope that helps!'
        assert extract_json_object(raw) == {"winner": "agentA"}

    def test_fenced_with_leading_prose_falls_back_to_braces(self):
        raw = 'Sure thing.\n```json\n{"a": 1}\n```'
        assert extract_json_object(raw) == {"a": 1}

    def test_invalid_raises(self):
        with pytest.raises((ValueError, json.JSONDecodeError)):
            extract_json_object("no json here at all")

    def test_strip_code_fences_leaves_plain_text(self):
        assert strip_code_fences("  {\"a\": 1}  ") == '{"a": 1}'


# --------------------------------------------------------------------------
# Structural validation
# --------------------------------------------------------------------------

class TestValidation:
    def test_valid_object_passes(self):
        assert validate_judgment(_valid_judgment()) == []

    def test_missing_schema_version(self):
        obj = _valid_judgment()
        del obj["schema_version"]
        errors = validate_judgment(obj)
        assert any("schema_version" in e for e in errors)

    def test_bad_round_winner_enum(self):
        obj = _valid_judgment()
        obj["rounds"][0]["winner"] = "draw"  # 'draw' is not valid for a round
        errors = validate_judgment(obj)
        assert any("rounds[0].winner" in e for e in errors)

    def test_bad_decision_winner_enum(self):
        obj = _valid_judgment()
        obj["decision"]["winner"] = "even"  # 'even' is not valid for decision
        errors = validate_judgment(obj)
        assert any("decision.winner" in e for e in errors)

    def test_empty_rounds_rejected(self):
        obj = _valid_judgment()
        obj["rounds"] = []
        errors = validate_judgment(obj)
        assert any("rounds must be a non-empty array" in e for e in errors)

    def test_tally_wrong_type(self):
        obj = _valid_judgment()
        obj["tally"]["agentA"] = "two"
        errors = validate_judgment(obj)
        assert any("tally.agentA" in e for e in errors)

    def test_missing_decision_summary(self):
        obj = _valid_judgment()
        del obj["decision"]["summary"]
        errors = validate_judgment(obj)
        assert any("decision.summary" in e for e in errors)

    def test_close_flag_must_be_bool(self):
        obj = _valid_judgment()
        obj["rounds"][0]["close"] = "yes"
        errors = validate_judgment(obj)
        assert any("close must be a boolean" in e for e in errors)

    def test_bool_is_not_valid_integer_round(self):
        obj = _valid_judgment()
        obj["rounds"][0]["round"] = True
        errors = validate_judgment(obj)
        assert any("rounds[0].round" in e for e in errors)

    def test_optional_sections_validated_when_present(self):
        obj = _valid_judgment()
        obj["quotes"] = [{"agent": "agentC", "text": "x", "cite": "Turn 1"}]
        errors = validate_judgment(obj)
        assert any("quotes[0].agent" in e for e in errors)


# --------------------------------------------------------------------------
# Tally recomputation
# --------------------------------------------------------------------------

class TestRecomputeTally:
    def test_counts_winners(self):
        rounds = [
            {"round": 1, "winner": "agentA"},
            {"round": 2, "winner": "agentA"},
            {"round": 3, "winner": "agentB"},
            {"round": 4, "winner": "even"},
        ]
        assert recompute_tally(rounds) == {"agentA": 2, "agentB": 1, "even": 1}

    def test_preserves_note(self):
        rounds = [{"round": 1, "winner": "agentA"}]
        tally = recompute_tally(rounds, {"agentA": 9, "agentB": 9, "even": 9, "note": "a points win"})
        assert tally == {"agentA": 1, "agentB": 0, "even": 0, "note": "a points win"}

    def test_finalize_overwrites_inconsistent_tally(self):
        obj = _valid_judgment(
            rounds_winners=("agentA", "agentA", "agentB"),
            tally={"agentA": 1, "agentB": 1, "even": 1},  # wrong
        )
        judgment, errors = finalize_judgment(json.dumps(obj), "t.md", obj["judge"])
        assert errors == []
        assert judgment["tally"] == {"agentA": 2, "agentB": 1, "even": 0}


# --------------------------------------------------------------------------
# Slugging and output paths
# --------------------------------------------------------------------------

class TestSlugAndPaths:
    def test_slug_spaces_and_case(self):
        assert slugify("Claude Fable 5") == "claude-fable-5"

    def test_slug_model_id(self):
        assert slugify("anthropic/claude-opus-4.8") == "anthropic-claude-opus-4-8"

    def test_slug_collapses_and_trims(self):
        assert slugify("  **Judge!! 42**  ") == "judge-42"

    def test_slug_empty_fallback(self):
        assert slugify("///") == "judge"

    def test_output_path_strips_extension(self):
        p = judgment_output_path("judgments", "20260704_201301_a_vs_b.md", "claude-fable-5")
        assert p == Path("judgments/20260704_201301_a_vs_b/claude-fable-5.json")

    def test_output_path_accepts_full_transcript_path_basename(self):
        p = judgment_output_path("out", "run.md", "judge-x")
        assert p == Path("out/run/judge-x.json")


# --------------------------------------------------------------------------
# Transcript inspection
# --------------------------------------------------------------------------

class TestParseAgents:
    def test_distinct_agents(self):
        assert parse_transcript_agents(TRANSCRIPT) == ("Claude Opus 4.8", "GPT-5.5")

    def test_ignores_headers_inside_content(self):
        # 'A header inside my argument' must not be mistaken for an agent.
        a, b = parse_transcript_agents(TRANSCRIPT)
        assert a == "Claude Opus 4.8"
        assert b == "GPT-5.5"

    def test_mirror_match_reports_same_name(self):
        assert parse_transcript_agents(MIRROR_TRANSCRIPT) == ("Claude Opus 4.6", "Claude Opus 4.6")

    def test_count_rounds(self):
        assert count_rounds(TRANSCRIPT) == 2
        assert count_rounds(MIRROR_TRANSCRIPT) == 1


# --------------------------------------------------------------------------
# Judge block
# --------------------------------------------------------------------------

class TestJudgeBlock:
    def test_includes_thinking_level_when_set(self):
        block = build_judge_block("Judge", "m", "xhigh", "2026-07-05")
        assert block == {"name": "Judge", "model": "m", "judged_at": "2026-07-05", "thinking_level": "xhigh"}

    def test_omits_thinking_level_when_none(self):
        block = build_judge_block("Judge", "m", None, "2026-07-05")
        assert "thinking_level" not in block


# --------------------------------------------------------------------------
# End-to-end orchestration with a stub provider (no network)
# --------------------------------------------------------------------------

class _StubProvider:
    """Returns queued canned responses; records the messages it was sent."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.sent_messages = []

    def send(self, messages):
        from research_harness.providers.base import ProviderResponse

        self.sent_messages.append([dict(m) for m in messages])
        content = self._responses.pop(0)
        return ProviderResponse(content=content, input_tokens=100, output_tokens=50, thinking_tokens=5)


def _install_stub(monkeypatch, responses):
    stub = _StubProvider(responses)
    monkeypatch.setattr(judge_mod, "create_provider", lambda **kwargs: stub)
    return stub


def _write_transcript(tmp_path) -> Path:
    f = tmp_path / "20260704_201301_a_vs_b.md"
    f.write_text(TRANSCRIPT)
    return f


class TestRunJudge:
    def test_writes_valid_judgment(self, tmp_path, monkeypatch):
        model_json = json.dumps(_valid_judgment(rounds_winners=("agentA", "agentB")))
        _install_stub(monkeypatch, [f"```json\n{model_json}\n```"])
        transcript = _write_transcript(tmp_path)

        out = run_judge(
            transcript_path=transcript,
            model="anthropic/claude-opus-4.8",
            judge_name="Claude Fable 5",
            output_dir=tmp_path / "judgments",
            today="2026-07-05",
        )

        assert out == tmp_path / "judgments" / "20260704_201301_a_vs_b" / "claude-fable-5.json"
        data = json.loads(out.read_text())
        # Authoritative fields overwritten.
        assert data["transcript"] == "20260704_201301_a_vs_b.md"
        assert data["judge"] == {
            "name": "Claude Fable 5",
            "model": "anthropic/claude-opus-4.8",
            "judged_at": "2026-07-05",
        }
        # Tally recomputed from rounds.
        assert data["tally"] == {"agentA": 1, "agentB": 1, "even": 0}
        assert data["schema_version"] == 1

    def test_defaults_judge_name_to_model(self, tmp_path, monkeypatch):
        model_json = json.dumps(_valid_judgment(rounds_winners=("agentA",)))
        _install_stub(monkeypatch, [model_json])
        transcript = _write_transcript(tmp_path)

        out = run_judge(
            transcript_path=transcript,
            model="anthropic/claude-opus-4.8",
            output_dir=tmp_path / "judgments",
            today="2026-07-05",
        )
        assert out.name == "anthropic-claude-opus-4-8.json"
        assert json.loads(out.read_text())["judge"]["name"] == "anthropic/claude-opus-4.8"

    def test_retries_once_then_succeeds(self, tmp_path, monkeypatch):
        bad = "I think agent A won, honestly."  # not JSON
        good = json.dumps(_valid_judgment(rounds_winners=("agentB", "agentB")))
        stub = _install_stub(monkeypatch, [bad, good])
        transcript = _write_transcript(tmp_path)

        out = run_judge(
            transcript_path=transcript,
            model="m",
            output_dir=tmp_path / "judgments",
            today="2026-07-05",
        )
        assert out.exists()
        # Second call must carry the corrective follow-up conversation.
        assert len(stub.sent_messages) == 2
        second = stub.sent_messages[1]
        assert second[-1]["role"] == "user"
        assert "did not conform" in second[-1]["content"]

    def test_raises_after_two_failures(self, tmp_path, monkeypatch):
        stub = _install_stub(monkeypatch, ["nonsense one", "nonsense two"])
        transcript = _write_transcript(tmp_path)

        with pytest.raises(JudgeError):
            run_judge(
                transcript_path=transcript,
                model="m",
                output_dir=tmp_path / "judgments",
                today="2026-07-05",
            )
        assert len(stub.sent_messages) == 2

    def test_retry_reports_structural_errors(self, tmp_path, monkeypatch):
        # Parseable JSON but bad enum -> structural error should be reported back.
        bad_obj = _valid_judgment()
        bad_obj["rounds"][0]["winner"] = "draw"
        good = json.dumps(_valid_judgment(rounds_winners=("agentA",)))
        stub = _install_stub(monkeypatch, [json.dumps(bad_obj), good])
        transcript = _write_transcript(tmp_path)

        run_judge(
            transcript_path=transcript,
            model="m",
            output_dir=tmp_path / "judgments",
            today="2026-07-05",
        )
        correction = stub.sent_messages[1][-1]["content"]
        assert "rounds[0].winner" in correction
