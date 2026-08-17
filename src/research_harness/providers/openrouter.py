import os
import time

import openai
from openai import OpenAI

from ..formatter import console
from .base import LLMProvider, ProviderResponse, collapse_exact_duplicate

# Long max-effort generations (e.g. gpt-5.5-pro at reasoning effort "max") run
# ~5 minutes; the SDK's default timeout cuts them off mid-flight.
REQUEST_TIMEOUT = 900.0
TRANSIENT_ATTEMPTS = 6
# A response that bills normally but carries no visible text. Seen from
# anthropic/claude-opus-5 mid-debate (2026-08-17): Anthropic's safety classifier
# stopped the generation during reasoning (native_finish_reason="refusal",
# surfaced by OpenRouter as finish_reason="content_filter") — ~2k reasoning
# tokens and ~50k input billed, ~$0.33, and no text. Unlike the transient
# failures above these DO cost money, so keep the retry budget short.
EMPTY_ATTEMPTS = 3
REASONING_EXCERPT_CHARS = 600


class OpenRouterTransientError(RuntimeError):
    """Raised when OpenRouter keeps failing transiently after all retries."""


class OpenRouterEmptyResponseError(RuntimeError):
    """Raised when the model keeps returning a billed response with no text."""


def _finish_reasons(choice) -> tuple[str | None, str | None]:
    return (
        getattr(choice, "finish_reason", None),
        getattr(choice, "native_finish_reason", None),
    )


def _describe_finish(choice) -> str:
    finish, native = _finish_reasons(choice)
    return f"finish_reason={finish!r}, native_finish_reason={native!r}"


def _reasoning_excerpt(message) -> str:
    """Best-effort peek at OpenRouter's reasoning payload for diagnostics."""
    if message is None:
        return ""
    text = getattr(message, "reasoning", None)
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


class OpenRouterProvider(LLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            timeout=REQUEST_TIMEOUT,
        )

    def _create_with_retry(self, kwargs):
        """Call chat.completions.create, retrying OpenRouter's transient failures.

        On long generations OpenRouter intermittently fails in ways that bill
        $0: 5xx errors, network drops, HTTP-200 bodies carrying only
        {"error": ...}, and parsed responses with choices=None. Those are safe
        to retry; anything else (4xx, auth, insufficient credit) propagates
        immediately.
        """
        last = None
        for attempt in range(TRANSIENT_ATTEMPTS):
            if attempt:
                delay = 8 + 4 * (attempt - 1)
                console.print(
                    f"[dim]openrouter transient failure "
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
        raise OpenRouterTransientError(
            f"OpenRouter still failing after {TRANSIENT_ATTEMPTS} attempts: {last}"
        )

    def send(self, messages: list[dict]) -> ProviderResponse:
        msgs = []
        system = self.get_system_prompt()
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.extend(messages)

        kwargs = {
            "model": self.model,
            "messages": msgs,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        if self.no_thinking:
            kwargs["extra_body"] = {"reasoning": {"exclude": True}}
        elif self.thinking_level:
            kwargs["extra_body"] = {"reasoning": {"effort": self.thinking_level}}

        # Empty-content responses are billed, so their usage is carried into
        # the final ProviderResponse for honest cost tracking.
        billed_input = billed_output = billed_thinking = 0
        warnings: list[str] = []
        response = choice = None
        raw_content = ""
        thinking_tokens = 0

        for attempt in range(EMPTY_ATTEMPTS):
            response = self._create_with_retry(kwargs)
            choice = response.choices[0]
            thinking_tokens = _reasoning_tokens(response.usage)
            raw_content = (choice.message.content if choice.message else "") or ""

            if raw_content.strip():
                break

            detail = (
                f"empty response ({_describe_finish(choice)}; "
                f"{response.usage.completion_tokens:,} completion tokens billed, "
                f"{thinking_tokens:,} reasoning)"
            )
            excerpt = _reasoning_excerpt(choice.message)
            if excerpt:
                detail += f"; reasoning excerpt: {excerpt!r}"

            if choice.finish_reason == "length":
                # Thinking ate the whole budget; a retry at the same
                # max_tokens would just do it again.
                raise OpenRouterEmptyResponseError(
                    f"{self.model} hit max_tokens={self.max_tokens} before emitting any text "
                    f"({detail}). Raise max_tokens or lower thinking_level; not writing a blank turn."
                )
            if attempt == EMPTY_ATTEMPTS - 1:
                raise OpenRouterEmptyResponseError(
                    f"{self.model} returned no text on {EMPTY_ATTEMPTS} consecutive attempts "
                    f"(last: {detail}). Every attempt was billed; not writing a blank turn."
                )

            billed_input += response.usage.prompt_tokens
            billed_output += response.usage.completion_tokens - thinking_tokens
            billed_thinking += thinking_tokens
            console.print(
                f"[yellow]openrouter {detail}; "
                f"retrying ({attempt + 1}/{EMPTY_ATTEMPTS - 1})[/yellow]"
            )
            warnings.append(f"{detail}; retried")

        usage = response.usage
        if choice.finish_reason == "length":
            msg = f"response truncated by max_tokens={self.max_tokens}"
            if thinking_tokens:
                msg += f" (thinking used {thinking_tokens:,} of that budget)"
            warnings.append(msg)

        content, deduped = collapse_exact_duplicate(raw_content)
        if deduped:
            warnings.append("provider returned the response body twice; collapsed to one copy")

        finish, native = _finish_reasons(choice)
        return ProviderResponse(
            content=content,
            input_tokens=usage.prompt_tokens + billed_input,
            output_tokens=usage.completion_tokens - thinking_tokens + billed_output,
            thinking_tokens=thinking_tokens + billed_thinking,
            warnings=warnings,
            finish_reason=finish,
            native_finish_reason=native,
        )


def _reasoning_tokens(usage) -> int:
    details = getattr(usage, "completion_tokens_details", None)
    if not details:
        return 0
    return getattr(details, "reasoning_tokens", 0) or 0
