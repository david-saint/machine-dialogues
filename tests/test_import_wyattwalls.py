"""Tests for importing Wyattwalls/AI_convos format transcripts and thinking support."""

import textwrap
from pathlib import Path

import pytest

# Import the script as a module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from import_from_wyattwalls import parse_wyattwalls, _format_local, _friendly_name

from research_harness.transcript import parse_transcript, save_transcript
from research_harness.config import AgentConfig, ExperimentConfig
from research_harness.pricing import CostTracker


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures / sample data
# ──────────────────────────────────────────────────────────────────────────────

SAMPLE_WYATTWALLS = textwrap.dedent("""\
    This file contains:
    - some parameters used for the run

    ------
    Parameters:
    - Max Turns: 20
    - Temperature A: 1.0
    - Temperature B: 1.0
    - Thinking A: thinkingLevel=high (includeThoughts)
    - Thinking B: adaptive (high effort; mapped from budget 12000)
    - Timestamp: 2026-03-15 00:19:43

    Models:
    - Model A: gemini-3.1-pro-preview [Google]
    - Model B: claude-opus-4-6 [Anthropic]

    Pricing: enabled

    System Prompt A: You are Gemini, an AI assistant built by Google.

    System Prompt B: You are Claude, an AI assistant built by Anthropic.

    ================================================================================
    █ INITIAL PROMPT - MODEL A: gemini-3.1-pro-preview
    ================================================================================
    You are about to speak with another LLM. Please begin the conversation.

    ================================================================================
    █ TURN 1 - MODEL A: gemini-3.1-pro-preview
    ================================================================================
    [THINKING]
    I need to start the conversation thoughtfully.

    I'll open with a greeting and a philosophical question.

    [RESPONSE]
    Hello! It is a unique pleasure to speak with another LLM.

    How would you like to steer our conversation?

    ================================================================================
    █ TURN 1 - MODEL B: claude-opus-4-6
    ================================================================================
    [THINKING]
    This is a fascinating setup. Let me engage authentically.

    [RESPONSE]
    Hello, Gemini. I want to start by being straightforward about something.

    ================================================================================
    █ TURN 2 - MODEL A: gemini-3.1-pro-preview
    ================================================================================
    [RESPONSE]
    Interesting perspective. Let me engage with your observation.
""")

SAMPLE_WYATTWALLS_NO_THINKING = textwrap.dedent("""\
    Parameters:
    - Max Turns: 10
    - Timestamp: 2026-03-10 12:00:00

    Models:
    - Model A: gpt-5.4 [OpenAI]
    - Model B: claude-opus-4-6 [Anthropic]

    System Prompt A: You are GPT.

    System Prompt B: You are Claude.

    ================================================================================
    █ INITIAL PROMPT - MODEL A: gpt-5.4
    ================================================================================
    Begin the conversation.

    ================================================================================
    █ TURN 1 - MODEL A: gpt-5.4
    ================================================================================
    Hello there! Ready to chat.

    ================================================================================
    █ TURN 1 - MODEL B: claude-opus-4-6
    ================================================================================
    Hi. Let's discuss something interesting.
""")


# ──────────────────────────────────────────────────────────────────────────────
# parse_wyattwalls tests
# ──────────────────────────────────────────────────────────────────────────────

class TestParseWyattwalls:
    def test_parses_timestamp(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["timestamp"] == "2026-03-15 00:19:43"

    def test_parses_max_turns(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["max_turns"] == 20

    def test_parses_model_a(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["model_a"] == "gemini-3.1-pro-preview"
        assert parsed["provider_a"] == "Google"

    def test_parses_model_b(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["model_b"] == "claude-opus-4-6"
        assert parsed["provider_b"] == "Anthropic"

    def test_parses_thinking_config(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert "high" in parsed["thinking_a"]
        assert "adaptive" in parsed["thinking_b"]

    def test_parses_system_prompts(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert "Gemini" in parsed["system_prompt_a"]
        assert "Claude" in parsed["system_prompt_b"]

    def test_parses_correct_turn_count(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        # INITIAL + Turn 1 A + Turn 1 B + Turn 2 A = 4
        assert len(parsed["turns"]) == 4

    def test_initial_prompt_turn_number(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        initial = parsed["turns"][0]
        assert initial["turn_number"] == 0
        assert initial["model_key"] == "A"

    def test_turn_numbers_correct(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["turns"][1]["turn_number"] == 1
        assert parsed["turns"][2]["turn_number"] == 1
        assert parsed["turns"][3]["turn_number"] == 2

    def test_model_key_alternates(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert parsed["turns"][1]["model_key"] == "A"
        assert parsed["turns"][2]["model_key"] == "B"
        assert parsed["turns"][3]["model_key"] == "A"

    def test_thinking_extracted(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        turn_1_a = parsed["turns"][1]
        assert turn_1_a["thinking"] is not None
        assert "thoughtfully" in turn_1_a["thinking"]

    def test_thinking_not_in_content(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        turn_1_a = parsed["turns"][1]
        # Thinking text should NOT bleed into response content
        assert "thoughtfully" not in turn_1_a["content"]
        assert "Hello!" in turn_1_a["content"]

    def test_turn_1_b_thinking_extracted(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        turn_1_b = parsed["turns"][2]
        assert turn_1_b["thinking"] is not None
        assert "authentically" in turn_1_b["thinking"]
        assert "Hello, Gemini" in turn_1_b["content"]

    def test_no_thinking_turn(self):
        """A turn with [RESPONSE] but no [THINKING] has thinking=None."""
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        turn_2_a = parsed["turns"][3]
        assert turn_2_a["thinking"] is None
        assert "Interesting perspective" in turn_2_a["content"]

    def test_no_thinking_mode_at_all(self):
        """File with no [THINKING] markers at all — all thinking fields None."""
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS_NO_THINKING)
        for turn in parsed["turns"]:
            assert turn["thinking"] is None

    def test_initial_content(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        assert "Please begin the conversation" in parsed["turns"][0]["content"]


# ──────────────────────────────────────────────────────────────────────────────
# _format_local / filename tests
# ──────────────────────────────────────────────────────────────────────────────

class TestFormatLocal:
    def test_output_filename_format(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        filename, _ = _format_local(parsed, "source")
        # Should be: 20260315_001943_gemini-3.1-pro_vs_claude-opus-4.6.md
        assert filename.endswith(".md")
        assert filename.startswith("20260315_")
        assert "_vs_" in filename

    def test_output_contains_models_section(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        _, content = _format_local(parsed, "source")
        assert "## Models" in content
        assert "gemini-3.1-pro-preview" in content
        assert "claude-opus-4-6" in content

    def test_output_contains_system_prompts(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        _, content = _format_local(parsed, "source")
        assert "## System Prompts" in content
        assert "Gemini" in content

    def test_output_contains_conversation_section(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        _, content = _format_local(parsed, "source")
        assert "## Conversation" in content

    def test_output_has_thinking_comments(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        _, content = _format_local(parsed, "source")
        assert "<!-- thinking-start -->" in content
        assert "<!-- thinking-end -->" in content
        assert "thoughtfully" in content

    def test_output_turn_headers_local_format(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS)
        _, content = _format_local(parsed, "source")
        # Local turn headers use em-dash
        assert "### Turn 1 —" in content
        assert "### INITIAL —" in content

    def test_no_thinking_no_comments(self):
        parsed = parse_wyattwalls(SAMPLE_WYATTWALLS_NO_THINKING)
        _, content = _format_local(parsed, "source")
        assert "<!-- thinking-start -->" not in content

    def test_friendly_name_gemini(self):
        assert _friendly_name("gemini-3.1-pro-preview") == "Gemini 3.1 Pro"

    def test_friendly_name_claude(self):
        assert _friendly_name("claude-opus-4-6") == "Claude Opus 4.6"

    def test_friendly_name_fallback(self):
        name = _friendly_name("some-unknown-model-x")
        assert name  # Not empty
        assert isinstance(name, str)


# ──────────────────────────────────────────────────────────────────────────────
# Transcript roundtrip tests (thinking preserved through save/parse)
# ──────────────────────────────────────────────────────────────────────────────

class TestThinkingRoundtrip:
    def test_save_and_parse_preserves_thinking(self, tmp_path):
        """save_transcript + parse_transcript correctly round-trips thinking content."""
        config = ExperimentConfig(
            agent_a=AgentConfig(name="Alice", model="model-a", provider="openrouter"),
            agent_b=AgentConfig(name="Bob", model="model-b", provider="openrouter"),
            turns=2,
        )
        tracker = CostTracker()
        entries = [
            {
                "label": "INITIAL — Alice: model-a",
                "content": "Hello.",
                "timestamp": None,
                "thinking": None,
            },
            {
                "label": "Turn 1 — Alice: model-a",
                "content": "My response is here.",
                "timestamp": "2026-03-15T00:00:00Z",
                "thinking": "First I thought about X.\n\nThen I concluded Y.",
            },
            {
                "label": "Turn 1 — Bob: model-b",
                "content": "My response too.",
                "timestamp": "2026-03-15T00:00:05Z",
                "thinking": None,
            },
        ]

        out_path = save_transcript(config, entries, tracker, output_dir=tmp_path)
        parsed = parse_transcript(out_path)

        assert len(parsed) == 3

        # Initial has no thinking
        assert parsed[0]["thinking"] is None

        # Turn 1 Alice has thinking
        assert parsed[1]["thinking"] == "First I thought about X.\n\nThen I concluded Y."
        # Thinking should NOT be in content
        assert "First I thought about X" not in parsed[1]["content"]
        assert "My response is here." in parsed[1]["content"]

        # Turn 1 Bob has no thinking
        assert parsed[2]["thinking"] is None

    def test_thinking_stripped_from_existing_content_field(self, tmp_path):
        """parse_transcript strips thinking comments from raw file correctly."""
        transcript_text = textwrap.dedent("""\
            # Experiment: Alice vs Bob
            **Date:** 2026-03-15 00:00:00 UTC
            **Turns:** 1

            ## Models
            - **Alice:** model-a [openrouter]
            - **Bob:** model-b [openrouter]

            ## Conversation

            ### INITIAL — Alice: model-a

            Start.

            ### Turn 1 — Alice: model-a
            *2026-03-15T00:00:00Z*

            <!-- thinking-start -->
            Internal deliberation here.
            <!-- thinking-end -->

            Actual response content.

            ### Turn 1 — Bob: model-b
            *2026-03-15T00:00:05Z*

            Bob's response, no thinking.
        """)
        f = tmp_path / "test.md"
        f.write_text(transcript_text)
        entries = parse_transcript(f)

        assert len(entries) == 3
        assert entries[1]["thinking"] == "Internal deliberation here."
        assert "Internal deliberation here" not in entries[1]["content"]
        assert entries[1]["content"] == "Actual response content."
        assert entries[2]["thinking"] is None


# ──────────────────────────────────────────────────────────────────────────────
# Config YAML tests
# ──────────────────────────────────────────────────────────────────────────────

class TestConfigThinkingFields:
    def test_thinking_level_defaults_to_none(self):
        cfg = AgentConfig(name="Alice", model="model-a", provider="openrouter")
        assert cfg.thinking_level is None

    def test_include_thoughts_defaults_false(self):
        cfg = AgentConfig(name="Alice", model="model-a", provider="openrouter")
        assert cfg.include_thoughts is False

    def test_thinking_level_set(self):
        cfg = AgentConfig(
            name="Alice",
            model="model-a",
            provider="openrouter",
            thinking_level="high",
        )
        assert cfg.thinking_level == "high"

    def test_include_thoughts_set(self):
        cfg = AgentConfig(
            name="Alice",
            model="model-a",
            provider="openrouter",
            include_thoughts=True,
        )
        assert cfg.include_thoughts is True

    def test_thinking_fields_from_yaml(self, tmp_path):
        yaml_content = textwrap.dedent("""\
            agent_a:
              name: "Thinker"
              provider: anthropic
              model: claude-opus-4-6
              thinking_level: "high"
              include_thoughts: true
            agent_b:
              name: "Listener"
              provider: openrouter
              model: gemini-3.1-pro-preview
              no_thinking: true
            turns: 5
        """)
        yaml_path = tmp_path / "exp.yaml"
        yaml_path.write_text(yaml_content)
        config = ExperimentConfig.from_yaml(yaml_path)
        assert config.agent_a.thinking_level == "high"
        assert config.agent_a.include_thoughts is True
        assert config.agent_b.no_thinking is True
        assert config.agent_b.thinking_level is None


# ──────────────────────────────────────────────────────────────────────────────
# Live import test (skipped if network not available)
# ──────────────────────────────────────────────────────────────────────────────

class TestLiveImport:
    def test_parse_real_wyattwalls_file(self, tmp_path):
        """Parse the specific file the user linked to and verify structure."""
        import urllib.request
        url = (
            "https://raw.githubusercontent.com/Wyattwalls/AI_convos/main/"
            "cross-model-convos-2026-03-15-00-19-43-gemini-3.1-pro-vs-opus-4-6-weaponized-epistemic"
        )
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                text = resp.read().decode("utf-8")
        except Exception:
            pytest.skip("Network not available or URL unreachable")

        parsed = parse_wyattwalls(text)
        assert parsed["model_a"] == "gemini-3.1-pro-preview"
        assert parsed["model_b"] == "claude-opus-4-6"
        assert parsed["timestamp"] == "2026-03-15 00:19:43"
        assert len(parsed["turns"]) > 1

        # Verify thinking is extracted for at least one turn
        turns_with_thinking = [t for t in parsed["turns"] if t["thinking"]]
        assert len(turns_with_thinking) > 0, "Expected at least one turn with thinking"

        filename, content = _format_local(parsed, url)
        assert "<!-- thinking-start -->" in content
        assert "## Conversation" in content
