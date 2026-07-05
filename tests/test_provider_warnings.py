"""Tests for provider response hygiene: duplicate collapse and truncation warnings."""

from research_harness.providers.base import ProviderResponse, collapse_exact_duplicate


def test_collapses_exact_double_body():
    body = "**Turn 1**\n\nArgument text here.\n\n> quoted line"
    content, deduped = collapse_exact_duplicate(body + "\n\n" + body)
    assert deduped
    assert content == body


def test_collapses_single_newline_double_body():
    body = "one line of output"
    content, deduped = collapse_exact_duplicate(body + "\n" + body)
    assert deduped
    assert content == body


def test_leaves_normal_content_alone():
    body = "First paragraph.\n\nSecond paragraph, different from the first."
    content, deduped = collapse_exact_duplicate(body)
    assert not deduped
    assert content == body


def test_leaves_partial_repetition_alone():
    # Repeated opening but divergent endings must not be collapsed.
    body = "Same opening line.\n\nSame opening line. But this half differs."
    content, deduped = collapse_exact_duplicate(body)
    assert not deduped
    assert content == body


def test_leaves_empty_content_alone():
    content, deduped = collapse_exact_duplicate("")
    assert not deduped
    assert content == ""


def test_provider_response_warnings_default_empty():
    r = ProviderResponse(content="x", input_tokens=1, output_tokens=1)
    assert r.warnings == []
