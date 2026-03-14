import os
from openai import OpenAI
from .base import LLMProvider, ProviderResponse


class OpenAIProvider(LLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        self.client = OpenAI(api_key=api_key)

    def send(self, messages: list[dict]) -> ProviderResponse:
        msgs = []
        if self.system_prompt:
            msgs.append({"role": "system", "content": self.system_prompt})
        msgs.extend(messages)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=msgs,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )

        usage = response.usage
        return ProviderResponse(
            content=response.choices[0].message.content,
            input_tokens=usage.prompt_tokens,
            output_tokens=usage.completion_tokens,
        )
