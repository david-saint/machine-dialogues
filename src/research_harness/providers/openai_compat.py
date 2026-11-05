"""Providers that speak the OpenAI Chat Completions protocol.

One implementation serves OpenAI itself, OpenRouter, the labs that expose an
OpenAI-compatible endpoint (xAI, Moonshot, DeepSeek), and any other endpoint
via `provider: openai-compatible` + `base_url` (+ `api_key_env`).
"""

import time

import openai
from openai import OpenAI

from ..formatter import console
from .base import REQUEST_TIMEOUT, Completion, LLMProvider

TRANSIENT_ATTEMPTS = 6
REASONING_EXCERPT_CHARS = 600


class ProviderTransientError(RuntimeError):
    """Raised when an endpoint keeps failing transiently after all retries."""


def _reasoning_excerpt(message) -> str:
    """Best-effort peek at the reasoning payload for diagnostics.

    OpenRouter uses `reasoning` / `reasoning_details`; DeepSeek and Moonshot
    use `reasoning_content`.
    """
    if message is None:
        return ""
    text = getattr(message, "reasoning", None) or getattr(message, "reasoning_content", None)
    if not text:
        details = getattr(message, "reasoning_details", None) or []
        parts = []
        for d in details:
            t = d.get("text") if isinstance(d, dict) else getattr(d, "text", None)
            if t:
                parts.append(t)
        text = "\n".join(parts)
    if not text:
        return ""
    text = str(text).strip()
    if len(text) > REASONING_EXCERPT_CHARS:
        text = text[:REASONING_EXCERPT_CHARS] + "…"
    return text


def _reasoning_tokens(usage) -> int:
    details = getattr(usage, "completion_tokens_details", None)
    if not details:
        return 0
    return getattr(details, "reasoning_tokens", 0) or 0


class OpenAICompatibleProvider(LLMProvider):
    """Generic Chat Completions endpoint. Requires `base_url`; the model id is
    sent exactly as written (or as `api_model`)."""

    label = "openai-compatible"
    default_base_url: str | None = None
    strip_vendor_prefix = False
    # Name of the output-cap parameter. OpenAI's reasoning models reject
    # `max_tokens`; most compatible endpoints only know `max_tokens`.
    token_param = "max_tokens"
    # OpenAI's reasoning models reject any explicit temperature, so presets
    # can opt to send it only when it differs from the default 1.0. Most
    # other endpoints default to something other than 1.0 (Kimi 0.6,
    # Mistral 0.7), so they always get it.
    send_default_temperature = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        base_url = self.base_url or self.default_base_url
        if self.label == "openai-compatible":
            if not base_url:
                raise ValueError("provider 'openai-compatible' requires base_url")
            # Local servers (vLLM, Ollama, LM Studio) often need no key.
            api_key = self._api_key() if self.api_key_env else "unused"
        else:
            api_key = self._api_key()
        self.client = OpenAI(base_url=base_url, api_key=api_key, timeout=REQUEST_TIMEOUT)

    def _reasoning_params(self) -> dict:
        """Request kwargs that ask for reasoning. Default: OpenAI-style
        `reasoning_effort`, passed through verbatim."""
        if self.wants_reasoning:
            return {"reasoning_effort": self.thinking_level}
        return {}

    def _request_kwargs(self, messages: list[dict]) -> dict:
        msgs = []
        system = self.get_system_prompt()
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.extend(messages)

        kwargs = {
            "model": self.api_model_id(),
            "messages": msgs,
            self.token_param: self.max_tokens,
        }
        if self.send_default_temperature or self.temperature != 1.0:
            kwargs["temperature"] = self.temperature
        kwargs.update(self._reasoning_params())
        if self.extra_body:
            kwargs["extra_body"] = {**kwargs.get("extra_body", {}), **self.extra_body}
        return kwargs

    def _create_with_retry(self, kwargs):
        """Call chat.completions.create, retrying failures that bill $0.

        On long generations OpenRouter in particular fails intermittently:
        5xx errors, network drops, HTTP-200 bodies carrying only
        {"error": ...}, and parsed responses with choices=None. Those are
        safe to retry; anything else (4xx, auth, insufficient credit)
        propagates immediately.
        """
        last = None
        for attempt in range(TRANSIENT_ATTEMPTS):
            if attempt:
                delay = 8 + 4 * (attempt - 1)
                console.print(
                    f"[dim]{self.label} transient failure "
                    f"({attempt}/{TRANSIENT_ATTEMPTS - 1} retries): {last}; "
                    f"retrying in {delay}s[/dim]"
                )
                time.sleep(delay)
            try:
                response = self.client.chat.completions.create(**kwargs)
            except (openai.APIConnectionError, openai.InternalServerError) as e:
                last = f"{type(e).__name__}: {e}"
                continue
            if response.choices:
                return response
            error = getattr(response, "error", None)
            last = f"error body: {error}" if error else "response had no choices"
        raise ProviderTransientError(
            f"{self.label} still failing after {TRANSIENT_ATTEMPTS} attempts: {last}"
        )

    def _complete(self, messages: list[dict]) -> Completion:
        response = self._create_with_retry(self._request_kwargs(messages))
        choice = response.choices[0]
        usage = response.usage
        thinking = _reasoning_tokens(usage)
        return Completion(
            content=(choice.message.content if choice.message else "") or "",
            input_tokens=usage.prompt_tokens,
            output_tokens=usage.completion_tokens - thinking,
            thinking_tokens=thinking,
            finish_reason=getattr(choice, "finish_reason", None),
            native_finish_reason=getattr(choice, "native_finish_reason", None),
            reasoning_excerpt=_reasoning_excerpt(choice.message),
        )


# -- Lab presets ---------------------------------------------------------------
# Each strips the OpenRouter vendor prefix ("x-ai/grok-4.6" -> "grok-4.6").
# When a lab's own id differs from that, set `api_model` in the config.

class OpenAIProvider(OpenAICompatibleProvider):
    label = "openai"
    default_api_key_env = "OPENAI_API_KEY"
    strip_vendor_prefix = True
    token_param = "max_completion_tokens"
    send_default_temperature = False


class XAIProvider(OpenAICompatibleProvider):
    label = "xai"
    default_base_url = "https://api.x.ai/v1"
    default_api_key_env = "XAI_API_KEY"
    strip_vendor_prefix = True


class MoonshotProvider(OpenAICompatibleProvider):
    label = "moonshot"
    default_base_url = "https://api.moonshot.ai/v1"
    default_api_key_env = "MOONSHOT_API_KEY"
    strip_vendor_prefix = True


class DeepSeekProvider(OpenAICompatibleProvider):
    label = "deepseek"
    default_base_url = "https://api.deepseek.com"
    default_api_key_env = "DEEPSEEK_API_KEY"
    strip_vendor_prefix = True
