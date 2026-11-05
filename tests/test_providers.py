"""Provider routing: model-id translation, request shapes, config validation.
No live API calls — clients are replaced with stubs that record the request."""

from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from research_harness.config import AgentConfig
from research_harness.providers import PROVIDERS, create_provider

BASE = dict(system_prompt="sys", temperature=1.0, max_tokens=1000)


@pytest.fixture(autouse=True)
def _keys(monkeypatch):
    for env in ("OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY",
                "XAI_API_KEY", "MOONSHOT_API_KEY", "DEEPSEEK_API_KEY", "MY_KEY"):
        monkeypatch.setenv(env, "test-key")


class _RecordingCompletions:
    def __init__(self, content="hi"):
        self.kwargs = None
        self.content = content

    def create(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.content), finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, completion_tokens_details=None),
        )


def _compat(provider, model, **options):
    p = create_provider(provider=provider, model=model, **{**BASE, **options})
    rec = _RecordingCompletions()
    p.client = SimpleNamespace(chat=SimpleNamespace(completions=rec))
    p.send([{"role": "user", "content": "go"}])
    return p, rec.kwargs


class TestModelIdTranslation:
    @pytest.mark.parametrize("provider,model,expected", [
        ("openrouter", "anthropic/claude-opus-5", "anthropic/claude-opus-5"),
        ("anthropic", "anthropic/claude-opus-4.8", "claude-opus-4-8"),
        ("anthropic", "anthropic/claude-fable-5", "claude-fable-5"),
        ("anthropic", "claude-opus-5-5", "claude-opus-5-5"),
        ("openai", "openai/gpt-5.5", "gpt-5.5"),
        ("google", "google/gemini-3.7-flash", "gemini-3.7-flash"),
        ("xai", "x-ai/grok-4.6", "grok-4.6"),
        ("moonshot", "moonshotai/kimi-k3", "kimi-k3"),
        ("deepseek", "deepseek/deepseek-v4-pro", "deepseek-v4-pro"),
    ])
    def test_default_translation(self, provider, model, expected):
        p = create_provider(provider=provider, model=model, **BASE)
        assert p.api_model_id() == expected

    def test_api_model_overrides(self):
        p = create_provider(provider="deepseek", model="deepseek/deepseek-v4-pro-0813", api_model="deepseek-reasoner", **BASE)
        assert p.api_model_id() == "deepseek-reasoner"
        assert p.model == "deepseek/deepseek-v4-pro-0813"  # canonical id untouched

    def test_generic_endpoint_sends_id_verbatim(self):
        p = create_provider(provider="openai-compatible", model="meta-llama/llama-4-maverick",
                            base_url="https://example.test/v1", **BASE)
        assert p.api_model_id() == "meta-llama/llama-4-maverick"


class TestOpenAICompatibleRequests:
    def test_openrouter_unchanged_shape(self):
        _, kw = _compat("openrouter", "x-ai/grok-4.6", thinking_level="xhigh")
        assert kw["model"] == "x-ai/grok-4.6"
        assert kw["max_tokens"] == 1000
        assert kw["temperature"] == 1.0
        assert kw["extra_body"] == {"reasoning": {"effort": "xhigh"}}
        assert "reasoning_effort" not in kw

    def test_openrouter_no_thinking_excludes(self):
        _, kw = _compat("openrouter", "x-ai/grok-4.6", no_thinking=True, thinking_level="high")
        assert kw["extra_body"] == {"reasoning": {"exclude": True}}

    def test_openai_uses_completion_tokens_and_effort(self):
        _, kw = _compat("openai", "openai/gpt-5.5", thinking_level="high")
        assert kw["model"] == "gpt-5.5"
        assert kw["max_completion_tokens"] == 1000 and "max_tokens" not in kw
        assert kw["reasoning_effort"] == "high"
        assert "temperature" not in kw  # reasoning models reject it

    def test_openai_sends_non_default_temperature(self):
        _, kw = _compat("openai", "openai/gpt-4o", temperature=0.3)
        assert kw["temperature"] == 0.3

    def test_lab_presets_point_at_lab_endpoints(self):
        for provider, host in (("xai", "api.x.ai"), ("moonshot", "api.moonshot.ai"), ("deepseek", "api.deepseek.com")):
            p = create_provider(provider=provider, model="v/m", **BASE)
            assert host in str(p.client.base_url)

    def test_extra_body_merged(self):
        _, kw = _compat("openrouter", "a/b", thinking_level="high", extra_body={"provider": {"order": ["x"]}})
        assert kw["extra_body"] == {"reasoning": {"effort": "high"}, "provider": {"order": ["x"]}}

    def test_custom_key_env_required(self, monkeypatch):
        monkeypatch.delenv("XAI_API_KEY")
        with pytest.raises(ValueError, match="XAI_API_KEY"):
            create_provider(provider="xai", model="x-ai/grok-4.6", **BASE)
        p = create_provider(provider="xai", model="x-ai/grok-4.6", api_key_env="MY_KEY", **BASE)
        assert p.client.api_key == "test-key"


class _RecordingAnthropicMessages:
    def __init__(self, blocks, stop_reason="end_turn"):
        self.kwargs = None
        self.blocks = blocks
        self.stop_reason = stop_reason

    @contextmanager
    def stream(self, **kwargs):
        self.kwargs = kwargs
        msg = SimpleNamespace(
            content=self.blocks,
            stop_reason=self.stop_reason,
            usage=SimpleNamespace(input_tokens=10, output_tokens=7,
                                  cache_creation_input_tokens=None, cache_read_input_tokens=None),
        )
        yield SimpleNamespace(get_final_message=lambda: msg)


class TestAnthropic:
    def _run(self, blocks, stop_reason="end_turn", **options):
        p = create_provider(provider="anthropic", model="anthropic/claude-opus-5", **BASE, **options)
        rec = _RecordingAnthropicMessages(blocks, stop_reason)
        p.client = SimpleNamespace(messages=rec)
        return p.send([{"role": "user", "content": "go"}]), rec.kwargs

    def test_effort_maps_to_adaptive_thinking(self):
        resp, kw = self._run([SimpleNamespace(type="thinking"), SimpleNamespace(type="text", text="answer")],
                             thinking_level="xhigh")
        assert kw["model"] == "claude-opus-5"
        assert kw["thinking"] == {"type": "adaptive"}
        assert kw["output_config"] == {"effort": "xhigh"}
        assert kw["system"] == "sys"
        assert "temperature" not in kw
        assert resp.content == "answer"
        assert (resp.input_tokens, resp.output_tokens) == (10, 7)

    def test_no_thinking_config_without_level(self):
        _, kw = self._run([SimpleNamespace(type="text", text="a")])
        assert "thinking" not in kw and "output_config" not in kw

    def test_text_blocks_joined(self):
        resp, _ = self._run([SimpleNamespace(type="text", text="one "), SimpleNamespace(type="text", text="two")])
        assert resp.content == "one two"

    def test_max_tokens_warns(self):
        resp, _ = self._run([SimpleNamespace(type="text", text="cut")], stop_reason="max_tokens")
        assert resp.finish_reason == "length"
        assert any("truncated" in w for w in resp.warnings)

    def test_partial_refusal_warns(self):
        resp, _ = self._run([SimpleNamespace(type="text", text="partial")], stop_reason="refusal")
        assert resp.native_finish_reason == "refusal"
        assert any("safety filter" in w for w in resp.warnings)


class TestGoogle:
    def test_rejects_effort_levels_gemini_lacks(self):
        with pytest.raises(ValueError, match="thinking_level"):
            create_provider(provider="google", model="google/gemini-3.7-flash", thinking_level="xhigh", **BASE)

    def test_accepts_gemini_levels(self):
        create_provider(provider="google", model="google/gemini-3.7-flash", thinking_level="high", **BASE)


class TestConfig:
    def test_every_provider_is_accepted(self):
        for name in PROVIDERS:
            extra = {"base_url": "https://example.test/v1"} if name == "openai-compatible" else {}
            AgentConfig(model="a/b", provider=name, **extra)

    def test_unknown_provider_rejected(self):
        with pytest.raises(ValidationError, match="Provider must be one of"):
            AgentConfig(model="a/b", provider="nope")

    def test_openai_compatible_needs_base_url(self):
        with pytest.raises(ValidationError, match="base_url"):
            AgentConfig(model="a/b", provider="openai-compatible")

    def test_provider_kwargs_round_trip(self):
        cfg = AgentConfig(model="anthropic/claude-opus-5", provider="anthropic", thinking_level="max", api_model="claude-opus-5")
        p = create_provider(**cfg.provider_kwargs())
        assert p.api_model_id() == "claude-opus-5" and p.thinking_level == "max"
