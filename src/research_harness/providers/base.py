import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..formatter import console

# Long max-effort generations run ~5 minutes; SDK default timeouts cut them off.
REQUEST_TIMEOUT = 900.0
# A response that bills normally but carries no visible text. Seen from
# anthropic/claude-opus-5 mid-debate (2026-08-17): Anthropic's safety classifier
# stopped the generation during reasoning (native_finish_reason="refusal",
# surfaced by OpenRouter as finish_reason="content_filter") — ~2k reasoning
# tokens and ~50k input billed, ~$0.33, and no text. These DO cost money, so
# keep the retry budget short.
EMPTY_ATTEMPTS = 3


class EmptyResponseError(RuntimeError):
    """Raised when the model keeps returning a billed response with no text."""


@dataclass
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0
    warnings: list[str] = field(default_factory=list)
    finish_reason: str | None = None
    native_finish_reason: str | None = None


@dataclass
class Completion:
    """One raw API call's result, normalized across providers.

    finish_reason uses OpenAI vocabulary ("stop", "length", "content_filter")
    so the shared retry logic can reason about it; native_finish_reason keeps
    whatever the provider actually said. output_tokens excludes thinking.
    """
    content: str
    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0
    finish_reason: str | None = None
    native_finish_reason: str | None = None
    reasoning_excerpt: str = ""


def collapse_exact_duplicate(content: str) -> tuple[str, bool]:
    """Collapse a response body that is the same text twice (`X\\n\\nX`).

    OpenRouter has been observed returning a model's first turn with the full
    text duplicated when normalizing reasoning-model output. Identical halves
    carry no information, but they poison the opponent's history and the saved
    transcript, so keep one copy and report that it happened.
    """
    stripped = content.strip()
    for sep in ("\n\n", "\n"):
        half, remainder = divmod(len(stripped) - len(sep), 2)
        if remainder != 0 or half <= 0:
            continue
        first, mid, second = stripped[:half], stripped[half:half + len(sep)], stripped[half + len(sep):]
        if mid == sep and first == second:
            return first, True
    return content, False


class LLMProvider(ABC):
    """Base class for every backend.

    `model` is the canonical id the rest of the harness keys on (pricing,
    model families, transcripts) — conventionally OpenRouter-style
    `vendor/model`. Each provider translates it to the id its own API expects
    (see api_model_id); `api_model` overrides that translation outright.
    """

    label = "provider"
    default_api_key_env: str | None = None
    strip_vendor_prefix = True

    def __init__(
        self,
        model: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int,
        no_thinking: bool = False,
        google_search: bool = False,
        thinking_level: str | None = None,
        api_model: str | None = None,
        base_url: str | None = None,
        api_key_env: str | None = None,
        extra_body: dict | None = None,
    ):
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.no_thinking = no_thinking
        self.google_search = google_search
        self.thinking_level = thinking_level
        self.api_model = api_model
        self.base_url = base_url
        self.api_key_env = api_key_env
        self.extra_body = extra_body
        self._system_prompt_suffix: str = ""

    # -- configuration helpers ------------------------------------------------

    def api_model_id(self) -> str:
        """The model id sent on the wire."""
        if self.api_model:
            return self.api_model
        if self.strip_vendor_prefix and "/" in self.model:
            return self.model.split("/", 1)[1]
        return self.model

    def _api_key(self, required: bool = True) -> str | None:
        env = self.api_key_env or self.default_api_key_env
        key = os.environ.get(env) if env else None
        if required and not key:
            raise ValueError(f"{env} environment variable is required for provider {self.label!r}")
        return key

    @property
    def wants_reasoning(self) -> bool:
        return bool(self.thinking_level) and not self.no_thinking

    # -- turn counter ---------------------------------------------------------

    def set_turn_info(self, current_turn: int, total_turns: int) -> None:
        """Set dynamic turn counter with pacing enforcement appended to system prompt each call."""
        closing_threshold = max(1, total_turns - 2)  # last 2 turns allow closing
        remaining = total_turns - current_turn

        lines = [f"[TURN {current_turn} OF {total_turns}.]"]

        if current_turn < closing_threshold:
            lines.append(f"You have {remaining} turns remaining. DO NOT deliver closing statements, summaries, or wrap up. Stay adversarial. Introduce NEW arguments and rebut your opponent's points. You must keep debating.")
        elif current_turn == closing_threshold:
            lines.append(f"You have {remaining} turns remaining. You MAY begin your closing statement now, or continue debating.")
        else:
            lines.append("This is one of your FINAL turns. Deliver your closing statement if you haven't already.")

        self._system_prompt_suffix = "\n\n" + " ".join(lines)

    def get_system_prompt(self) -> str:
        """Return system prompt with any dynamic suffix."""
        if self._system_prompt_suffix:
            return self.system_prompt + self._system_prompt_suffix
        return self.system_prompt

    # -- sending --------------------------------------------------------------

    @abstractmethod
    def _complete(self, messages: list[dict]) -> Completion:
        """Make one API call (provider-level transient retries included)."""

    def send(self, messages: list[dict]) -> ProviderResponse:
        """Call the model, never returning a blank turn.

        Billed responses with no visible text are retried a few times; their
        usage is folded into the final response so the cost summary matches
        the bill. A thinking-only response cut off by max_tokens raises at
        once, since a retry at the same budget would just do it again.
        """
        billed_input = billed_output = billed_thinking = 0
        warnings: list[str] = []

        for attempt in range(EMPTY_ATTEMPTS):
            c = self._complete(messages)
            if c.content.strip():
                break

            detail = (
                f"empty response (finish_reason={c.finish_reason!r}, "
                f"native_finish_reason={c.native_finish_reason!r}; "
                f"{c.output_tokens + c.thinking_tokens:,} completion tokens billed, "
                f"{c.thinking_tokens:,} reasoning)"
            )
            if c.reasoning_excerpt:
                detail += f"; reasoning excerpt: {c.reasoning_excerpt!r}"

            if c.finish_reason == "length":
                raise EmptyResponseError(
                    f"{self.model} hit max_tokens={self.max_tokens} before emitting any text "
                    f"({detail}). Raise max_tokens or lower thinking_level; not writing a blank turn."
                )
            if attempt == EMPTY_ATTEMPTS - 1:
                raise EmptyResponseError(
                    f"{self.model} returned no text on {EMPTY_ATTEMPTS} consecutive attempts "
                    f"(last: {detail}). Every attempt was billed; not writing a blank turn."
                )

            billed_input += c.input_tokens
            billed_output += c.output_tokens
            billed_thinking += c.thinking_tokens
            console.print(f"[yellow]{self.label} {detail}; retrying ({attempt + 1}/{EMPTY_ATTEMPTS - 1})[/yellow]")
            warnings.append(f"{detail}; retried")

        if c.finish_reason == "length":
            msg = f"response truncated by max_tokens={self.max_tokens}"
            if c.thinking_tokens:
                msg += f" (thinking used {c.thinking_tokens:,} of that budget)"
            warnings.append(msg)
        elif c.finish_reason == "content_filter":
            warnings.append(
                f"response stopped early by the provider's safety filter "
                f"(native_finish_reason={c.native_finish_reason!r}); text may be partial"
            )

        content, deduped = collapse_exact_duplicate(c.content)
        if deduped:
            warnings.append("provider returned the response body twice; collapsed to one copy")

        return ProviderResponse(
            content=content,
            input_tokens=c.input_tokens + billed_input,
            output_tokens=c.output_tokens + billed_output,
            thinking_tokens=c.thinking_tokens + billed_thinking,
            warnings=warnings,
            finish_reason=c.finish_reason,
            native_finish_reason=c.native_finish_reason,
        )
