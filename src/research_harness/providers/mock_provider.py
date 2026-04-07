from .base import LLMProvider, ProviderResponse


class MockProvider(LLMProvider):
    """Provider that echoes back turn info for testing. No API calls."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.call_count = 0
        self.captured_system_prompts: list[str] = []

    def send(self, messages: list[dict]) -> ProviderResponse:
        self.call_count += 1
        system = self.get_system_prompt()
        self.captured_system_prompts.append(system)

        last_msg = messages[-1]["content"] if messages else ""
        content = f"[{self.model} | call #{self.call_count}] Responding to: {last_msg[:80]}..."

        return ProviderResponse(
            content=content,
            input_tokens=100,
            output_tokens=50,
            thinking_tokens=0,
        )
