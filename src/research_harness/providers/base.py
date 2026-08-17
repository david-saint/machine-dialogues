from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0
    warnings: list[str] = field(default_factory=list)
    finish_reason: str | None = None
    native_finish_reason: str | None = None


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
    def __init__(self, model: str, system_prompt: str, temperature: float, max_tokens: int, no_thinking: bool = False, google_search: bool = False, thinking_level: str | None = None):
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.no_thinking = no_thinking
        self.google_search = google_search
        self.thinking_level = thinking_level
        self._system_prompt_suffix: str = ""

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

    @abstractmethod
    def send(self, messages: list[dict]) -> ProviderResponse: ...
