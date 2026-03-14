import os
from google import genai
from google.genai import types
from .base import LLMProvider, ProviderResponse


class GoogleProvider(LLMProvider):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable is required")
        self.client = genai.Client(api_key=api_key)

    def send(self, messages: list[dict]) -> ProviderResponse:
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

        config = types.GenerateContentConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
        )
        if self.system_prompt:
            config.system_instruction = self.system_prompt

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        input_tokens = response.usage_metadata.prompt_token_count or 0
        output_tokens = response.usage_metadata.candidates_token_count or 0
        thinking_tokens = getattr(response.usage_metadata, "thoughts_token_count", 0) or 0

        return ProviderResponse(
            content=response.text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            thinking_tokens=thinking_tokens,
        )
