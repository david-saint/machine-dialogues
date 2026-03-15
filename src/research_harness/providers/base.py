from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ProviderResponse:
    content: str
    input_tokens: int
    output_tokens: int
    thinking_tokens: int = 0


class LLMProvider(ABC):
    def __init__(self, model: str, system_prompt: str, temperature: float, max_tokens: int, no_thinking: bool = False, google_search: bool = False):
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.no_thinking = no_thinking
        self.google_search = google_search

    @abstractmethod
    def send(self, messages: list[dict]) -> ProviderResponse: ...
