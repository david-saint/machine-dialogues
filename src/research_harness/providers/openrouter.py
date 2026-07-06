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


class OpenRouterTransientError(RuntimeError):
    """Raised when OpenRouter keeps failing transiently after all retries."""


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

        response = self._create_with_retry(kwargs)

        usage = response.usage
        thinking_tokens = 0
        if hasattr(usage, "completion_tokens_details") and usage.completion_tokens_details:
            details = usage.completion_tokens_details
            reasoning = getattr(details, "reasoning_tokens", 0) or 0
            thinking_tokens = reasoning

        choice = response.choices[0]
        warnings = []
        if choice.finish_reason == "length":
            msg = f"response truncated by max_tokens={self.max_tokens}"
            if thinking_tokens:
                msg += f" (thinking used {thinking_tokens:,} of that budget)"
            warnings.append(msg)

        raw_content = (choice.message.content if choice.message else "") or ""
        content, deduped = collapse_exact_duplicate(raw_content)
        if deduped:
            warnings.append("provider returned the response body twice; collapsed to one copy")

        return ProviderResponse(
            content=content,
            input_tokens=usage.prompt_tokens,
            output_tokens=usage.completion_tokens - thinking_tokens,
            thinking_tokens=thinking_tokens,
            warnings=warnings,
        )
