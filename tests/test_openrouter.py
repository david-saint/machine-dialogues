"""Tests for OpenRouterProvider's transient-failure retry (no live API calls).

OpenRouter's observed transient failures on long generations: 5xx / dropped
connections, HTTP-200 bodies carrying only {"error": ...} (parsed by the SDK
as choices=None), and plain choices=None responses. All bill $0, so the
provider retries them; everything else must propagate untouched.
"""

from types import SimpleNamespace

import httpx
import openai
import pytest

from research_harness.providers import openrouter as openrouter_mod
from research_harness.providers.openrouter import (
    EMPTY_ATTEMPTS,
    OpenRouterEmptyResponseError,
    OpenRouterProvider,
    OpenRouterTransientError,
    TRANSIENT_ATTEMPTS,
)


def _good_response(content="hello", reasoning_tokens=0, finish_reason="stop", native_finish_reason=None, reasoning=None):
    details = SimpleNamespace(reasoning_tokens=reasoning_tokens) if reasoning_tokens else None
    message = SimpleNamespace(content=content)
    if reasoning is not None:
        message.reasoning = reasoning
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message, finish_reason=finish_reason, native_finish_reason=native_finish_reason)],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, completion_tokens_details=details),
    )


def _empty_response(reasoning_tokens=40, finish_reason="stop", native_finish_reason="end_turn", reasoning=None, message=True):
    """A billed response with no visible text: 100 in, 50 completion of which 40 reasoning."""
    resp = _good_response("", reasoning_tokens, finish_reason, native_finish_reason, reasoning)
    if not message:
        resp.choices[0].message = None
    return resp


class _StubCompletions:
    """Yields queued results; a callable in the queue is raised/invoked."""

    def __init__(self, results):
        self._results = list(results)
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def _make_provider(monkeypatch, results):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(openrouter_mod.time, "sleep", lambda s: None)
    provider = OpenRouterProvider(
        model="openai/gpt-5.5-pro",
        system_prompt="You are a judge.",
        temperature=1.0,
        max_tokens=32000,
        thinking_level="max",
    )
    stub = _StubCompletions(results)
    provider.client = SimpleNamespace(chat=SimpleNamespace(completions=stub))
    return provider, stub


def _connection_error():
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    return openai.APIConnectionError(request=request)


class TestTransientRetry:
    def test_retries_none_choices_then_succeeds(self, monkeypatch):
        provider, stub = _make_provider(
            monkeypatch,
            [SimpleNamespace(choices=None), SimpleNamespace(choices=None), _good_response()],
        )
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == "hello"
        assert stub.calls == 3

    def test_retries_error_body_then_succeeds(self, monkeypatch):
        error_body = SimpleNamespace(choices=None, error={"code": 500, "message": "upstream"})
        provider, stub = _make_provider(monkeypatch, [error_body, _good_response()])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == "hello"
        assert stub.calls == 2

    def test_retries_connection_error_then_succeeds(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_connection_error(), _good_response()])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == "hello"
        assert stub.calls == 2

    def test_exhaustion_raises_with_last_failure(self, monkeypatch):
        provider, stub = _make_provider(
            monkeypatch,
            [SimpleNamespace(choices=None, error={"code": 500})] * TRANSIENT_ATTEMPTS,
        )
        with pytest.raises(OpenRouterTransientError, match="error body"):
            provider.send([{"role": "user", "content": "judge this"}])
        assert stub.calls == TRANSIENT_ATTEMPTS

    def test_non_transient_error_propagates_immediately(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [ValueError("bad request")])
        with pytest.raises(ValueError, match="bad request"):
            provider.send([{"role": "user", "content": "judge this"}])
        assert stub.calls == 1


class TestSendPostprocessing:
    def test_reasoning_tokens_split_from_output(self, monkeypatch):
        provider, _ = _make_provider(monkeypatch, [_good_response(reasoning_tokens=30)])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.thinking_tokens == 30
        assert response.output_tokens == 20
        assert response.input_tokens == 100

    def test_length_truncation_warning(self, monkeypatch):
        provider, _ = _make_provider(monkeypatch, [_good_response(finish_reason="length")])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert any("truncated" in w for w in response.warnings)

    def test_finish_reasons_recorded(self, monkeypatch):
        provider, _ = _make_provider(monkeypatch, [_good_response(native_finish_reason="end_turn")])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.finish_reason == "stop"
        assert response.native_finish_reason == "end_turn"


class TestEmptyResponseRetry:
    """Billed responses with no text (seen from claude-opus-5 mid-debate: the
    model reasoned, then ended the turn without a text block). Retried a few
    times; the wasted usage is folded into the final response's token counts so
    the cost summary matches the bill; a blank turn is never returned."""

    def test_none_message_is_retried_then_succeeds(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_empty_response(message=False), _good_response()])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == "hello"
        assert stub.calls == 2

    def test_empty_text_retried_and_usage_accumulated(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_empty_response(), _empty_response(), _good_response(reasoning_tokens=10)])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert stub.calls == 3
        assert response.content == "hello"
        # 2 wasted attempts (100 in, 10 out, 40 reasoning each) + the good one (100 in, 40 out, 10 reasoning)
        assert response.input_tokens == 300
        assert response.output_tokens == 60
        assert response.thinking_tokens == 90
        assert sum("empty response" in w for w in response.warnings) == 2
        assert "finish_reason='stop'" in response.warnings[0]
        assert "native_finish_reason='end_turn'" in response.warnings[0]

    def test_reasoning_excerpt_surfaced(self, monkeypatch):
        provider, _ = _make_provider(monkeypatch, [_empty_response(reasoning="I should concede the FIPS point"), _good_response()])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert "FIPS" in response.warnings[0]

    def test_exhaustion_raises_instead_of_blank_turn(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_empty_response()] * EMPTY_ATTEMPTS)
        with pytest.raises(OpenRouterEmptyResponseError, match="no text"):
            provider.send([{"role": "user", "content": "judge this"}])
        assert stub.calls == EMPTY_ATTEMPTS

    def test_thinking_only_truncation_raises_immediately(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_empty_response(finish_reason="length"), _good_response()])
        with pytest.raises(OpenRouterEmptyResponseError, match="max_tokens"):
            provider.send([{"role": "user", "content": "judge this"}])
        assert stub.calls == 1

    def test_whitespace_only_counts_as_empty(self, monkeypatch):
        provider, stub = _make_provider(monkeypatch, [_good_response("  \n"), _good_response()])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == "hello"
        assert stub.calls == 2
