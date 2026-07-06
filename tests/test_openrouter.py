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
    OpenRouterProvider,
    OpenRouterTransientError,
    TRANSIENT_ATTEMPTS,
)


def _good_response(content="hello", reasoning_tokens=0, finish_reason="stop"):
    details = SimpleNamespace(reasoning_tokens=reasoning_tokens) if reasoning_tokens else None
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content), finish_reason=finish_reason)],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, completion_tokens_details=details),
    )


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

    def test_none_message_treated_as_empty(self, monkeypatch):
        bad = SimpleNamespace(
            choices=[SimpleNamespace(message=None, finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=0, completion_tokens_details=None),
        )
        provider, _ = _make_provider(monkeypatch, [bad])
        response = provider.send([{"role": "user", "content": "judge this"}])
        assert response.content == ""
