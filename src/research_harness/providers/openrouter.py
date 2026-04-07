import os
from openai import OpenAI
from .base import LLMProvider, ProviderResponse


class OpenRouterProvider(LLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
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

        response = self.client.chat.completions.create(**kwargs)

        usage = response.usage
        thinking_tokens = 0
        if hasattr(usage, "completion_tokens_details") and usage.completion_tokens_details:
            details = usage.completion_tokens_details
            reasoning = getattr(details, "reasoning_tokens", 0) or 0
            thinking_tokens = reasoning

        return ProviderResponse(
            content=response.choices[0].message.content or "",
            input_tokens=usage.prompt_tokens,
            output_tokens=usage.completion_tokens - thinking_tokens,
            thinking_tokens=thinking_tokens,
        )
