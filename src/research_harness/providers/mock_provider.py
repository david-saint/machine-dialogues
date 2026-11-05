from .base import Completion, LLMProvider


class MockProvider(LLMProvider):
    """Provider that echoes back turn info for testing. No API calls."""

    label = "mock"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.call_count = 0
        self.captured_system_prompts: list[str] = []

    def _complete(self, messages: list[dict]) -> Completion:
        self.call_count += 1
        system = self.get_system_prompt()
        self.captured_system_prompts.append(system)

        last_msg = messages[-1]["content"] if messages else ""
        return Completion(
            content=f"[{self.model} | call #{self.call_count}] Responding to: {last_msg[:80]}...",
            input_tokens=100,
            output_tokens=50,
            finish_reason="stop",
        )
