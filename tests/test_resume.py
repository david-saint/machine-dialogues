"""Tests for transcript parsing and resume functionality."""

import textwrap
from pathlib import Path

import pytest

from research_harness.transcript import parse_transcript, rebuild_histories


MINIMAL_TRANSCRIPT = textwrap.dedent("""\
    # Experiment: Alice vs Bob
    **Date:** 2026-03-14 23:00:00 UTC
    **Turns:** 2

    ## Models
    - **Alice:** model-a [openrouter]
    - **Bob:** model-b [openrouter]

    ## Conversation

    ### INITIAL — Alice: model-a

    Hello, let's debate.

    ### Turn 1 — Alice: model-a
    *2026-03-14T22:50:00Z*

    I argue for X.

    ### Turn 1 — Bob: model-b
    *2026-03-14T22:50:30Z*

    I argue for Y.

    ### Turn 2 — Alice: model-a
    *2026-03-14T22:51:00Z*

    Rebuttal from A.

    ### Turn 2 — Bob: model-b
    *2026-03-14T22:51:30Z*

    Rebuttal from B.

    ## Cost Summary

    | Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |
    |-------|-------------|---------------|-----------------|------------|
    | Alice | 1,000 | 500 | 0 | $0.010000 |
    | **Total** | 1,000 | 500 | 0 | **$0.010000** |
""")


TRANSCRIPT_WITH_MARKDOWN_HEADERS = textwrap.dedent("""\
    # Experiment: Alice vs Bob
    **Date:** 2026-03-14 23:00:00 UTC
    **Turns:** 1

    ## Models
    - **Alice:** model-a [openrouter]
    - **Bob:** model-b [openrouter]

    ## Conversation

    ### INITIAL — Alice: model-a

    Start the debate.

    ### Turn 1 — Alice: model-a
    *2026-03-14T22:50:00Z*

    # My Opening Statement

    ## First Point

    I argue for X strongly.

    ### A subheading in my argument

    More detail here.

    ### Turn 1 — Bob: model-b
    *2026-03-14T22:50:30Z*

    ## My Response

    I disagree with your first point.

    ## Cost Summary

    | Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |
    |-------|-------------|---------------|-----------------|------------|
""")


INCOMPLETE_TURN_TRANSCRIPT = textwrap.dedent("""\
    # Experiment: Alice vs Bob
    **Date:** 2026-03-14 23:00:00 UTC
    **Turns:** 2

    ## Models
    - **Alice:** model-a [openrouter]
    - **Bob:** model-b [openrouter]

    ## Conversation

    ### INITIAL — Alice: model-a

    Hello, let's debate.

    ### Turn 1 — Alice: model-a
    *2026-03-14T22:50:00Z*

    I argue for X.

    ### Turn 1 — Bob: model-b
    *2026-03-14T22:50:30Z*

    I argue for Y.

    ### Turn 2 — Alice: model-a
    *2026-03-14T22:51:00Z*

    Rebuttal from A.

    ## Cost Summary

    | Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |
    |-------|-------------|---------------|-----------------|------------|
""")


NO_COST_TRANSCRIPT = textwrap.dedent("""\
    # Experiment: Alice vs Bob
    **Date:** 2026-03-14 23:00:00 UTC
    **Turns:** 1

    ## Models
    - **Alice:** model-a [openrouter]
    - **Bob:** model-b [openrouter]

    ## Conversation

    ### INITIAL — Alice: model-a

    Hello.

    ### Turn 1 — Alice: model-a
    *2026-03-14T22:50:00Z*

    Response A.

    ### Turn 1 — Bob: model-b
    *2026-03-14T22:50:30Z*

    Response B.
""")


class TestParseTranscript:
    def test_parses_correct_number_of_entries(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        assert len(entries) == 5  # INITIAL + 2 turns * 2 agents

    def test_initial_entry_has_no_timestamp(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        assert entries[0]["timestamp"] is None
        assert entries[0]["content"] == "Hello, let's debate."

    def test_turn_entries_have_timestamps(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        assert entries[1]["timestamp"] == "2026-03-14T22:50:00Z"
        assert entries[2]["timestamp"] == "2026-03-14T22:50:30Z"

    def test_content_extracted_without_timestamp(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        assert entries[1]["content"] == "I argue for X."
        assert entries[2]["content"] == "I argue for Y."

    def test_labels_preserved(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        assert "INITIAL" in entries[0]["label"]
        assert "Turn 1" in entries[1]["label"]
        assert "Turn 2" in entries[3]["label"]

    def test_handles_markdown_headers_in_content(self, tmp_path):
        """Agent responses with # and ## headers shouldn't split entries."""
        f = tmp_path / "transcript.md"
        f.write_text(TRANSCRIPT_WITH_MARKDOWN_HEADERS)
        entries = parse_transcript(f)
        assert len(entries) == 3  # INITIAL + Turn 1 A + Turn 1 B

        # Agent A's content should include all its markdown headers
        assert "# My Opening Statement" in entries[1]["content"]
        assert "## First Point" in entries[1]["content"]
        assert "### A subheading in my argument" in entries[1]["content"]

    def test_stops_at_cost_summary(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        # No entry should contain cost table content
        for entry in entries:
            assert "Input Tokens" not in entry["content"]

    def test_works_without_cost_summary(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(NO_COST_TRANSCRIPT)
        entries = parse_transcript(f)
        assert len(entries) == 3

    def test_raises_on_missing_conversation_section(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text("# Just a title\n\nNo conversation here.\n")
        with pytest.raises(ValueError, match="No '## Conversation' section"):
            parse_transcript(f)

    def test_parses_real_transcript(self):
        """Parse the actual transcript from the debate experiment."""
        real_path = Path(__file__).parent.parent / "transcripts" / "20260314_230259_claude-opus-4.6_vs_claude-opus-4.6.md"
        if not real_path.exists():
            pytest.skip("Real transcript not available")
        entries = parse_transcript(real_path)
        assert len(entries) == 17  # INITIAL + 8 turns * 2 agents
        assert "INITIAL" in entries[0]["label"]


class TestRebuildHistories:
    def test_complete_turns(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        history_a, history_b, current_msg, last_turn = rebuild_histories(entries)

        assert last_turn == 2
        # Each agent has 2 turns = 4 messages (2 user + 2 assistant)
        assert len(history_a) == 4
        assert len(history_b) == 4

    def test_history_a_starts_with_initial_message(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        history_a, _, _, _ = rebuild_histories(entries)

        assert history_a[0]["role"] == "user"
        assert history_a[0]["content"] == "Hello, let's debate."

    def test_history_a_alternates_roles(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        history_a, _, _, _ = rebuild_histories(entries)

        roles = [m["role"] for m in history_a]
        assert roles == ["user", "assistant", "user", "assistant"]

    def test_history_b_starts_with_agent_a_content(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        _, history_b, _, _ = rebuild_histories(entries)

        assert history_b[0]["role"] == "user"
        assert history_b[0]["content"] == "I argue for X."

    def test_history_b_alternates_roles(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        _, history_b, _, _ = rebuild_histories(entries)

        roles = [m["role"] for m in history_b]
        assert roles == ["user", "assistant", "user", "assistant"]

    def test_current_message_is_last_agent_b_response(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        _, _, current_msg, _ = rebuild_histories(entries)

        assert current_msg == "Rebuttal from B."

    def test_history_a_user_messages_are_agent_b_responses(self, tmp_path):
        """Agent A's user messages (after the first) should be Agent B's responses."""
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        history_a, _, _, _ = rebuild_histories(entries)

        # First user message is initial
        assert history_a[0]["content"] == "Hello, let's debate."
        # Second user message is Agent B's turn 1 response
        assert history_a[2]["content"] == "I argue for Y."

    def test_incomplete_turn_detection(self, tmp_path):
        """When Agent A responded but B didn't, detect correctly."""
        f = tmp_path / "transcript.md"
        f.write_text(INCOMPLETE_TURN_TRANSCRIPT)
        entries = parse_transcript(f)

        # 4 entries: INITIAL, Turn 1 A, Turn 1 B, Turn 2 A
        assert len(entries) == 4

        history_a, history_b, current_msg, last_turn = rebuild_histories(entries)

        assert last_turn == 2
        # Agent A has 2 complete exchanges
        assert len(history_a) == 4  # user/assistant for turn 1, user/assistant for turn 2
        # Agent B only has 1 complete exchange
        assert len(history_b) == 2  # user/assistant for turn 1 only
        # Current message is Agent A's turn 2 response (awaiting B)
        assert current_msg == "Rebuttal from A."

    def test_incomplete_turn_flag(self, tmp_path):
        """The incomplete turn can be detected from entry count."""
        f = tmp_path / "transcript.md"
        f.write_text(INCOMPLETE_TURN_TRANSCRIPT)
        entries = parse_transcript(f)
        agent_entries = len(entries) - 1  # exclude INITIAL
        last_turn_complete = agent_entries % 2 == 0
        assert not last_turn_complete

    def test_complete_turn_flag(self, tmp_path):
        f = tmp_path / "transcript.md"
        f.write_text(MINIMAL_TRANSCRIPT)
        entries = parse_transcript(f)
        agent_entries = len(entries) - 1
        last_turn_complete = agent_entries % 2 == 0
        assert last_turn_complete

    def test_empty_entries(self):
        history_a, history_b, msg, turn = rebuild_histories([])
        assert history_a == []
        assert history_b == []
        assert msg == ""
        assert turn == 0

    def test_initial_only(self):
        entries = [{"label": "INITIAL — A: model", "content": "Hello", "timestamp": None}]
        history_a, history_b, msg, turn = rebuild_histories(entries)
        assert history_a == []
        assert history_b == []
        assert msg == "Hello"
        assert turn == 0

    def test_real_transcript_rebuild(self):
        """Rebuild histories from the actual debate transcript."""
        real_path = Path(__file__).parent.parent / "transcripts" / "20260314_230259_claude-opus-4.6_vs_claude-opus-4.6.md"
        if not real_path.exists():
            pytest.skip("Real transcript not available")
        entries = parse_transcript(real_path)
        history_a, history_b, current_msg, last_turn = rebuild_histories(entries)

        assert last_turn == 8
        assert len(history_a) == 16  # 8 turns * 2 messages each
        assert len(history_b) == 16
        # current_msg should be Agent B's turn 8 response
        assert "Approaching Final Rounds" in current_msg
