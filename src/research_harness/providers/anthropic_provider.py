import os
from anthropic import Anthropic
from .base import LLMProvider, ProviderResponse


class AnthropicProvider(LLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        self.client = Anthropic(api_key=api_key)

    def send(self, messages: list[dict]) -> ProviderResponse:
        kwargs = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
        if self.system_prompt:
            kwargs["system"] = self.system_prompt

        response = self.client.messages.create(**kwargs)

        content = ""
        for block in response.content:
            if block.type == "text":
                content = block.text
                break

        return ProviderResponse(
            content=content,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
