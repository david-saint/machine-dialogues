import os

from google import genai
from google.genai import types

from .base import REQUEST_TIMEOUT, Completion, LLMProvider

GEMINI_THINKING_LEVELS = {"minimal", "low", "medium", "high"}

_FILTERED = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"}


class GoogleProvider(LLMProvider):
    """Gemini via the Gemini API (google-genai).

    Model ids: "google/gemini-3.1-pro-preview" -> "gemini-3.1-pro-preview".
    thinking_level maps to ThinkingConfig.thinking_level, which Gemini limits
    to minimal | low | medium | high.
    """

    label = "google"
    default_api_key_env = "GEMINI_API_KEY"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        api_key = self._api_key(required=False) or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable is required for provider 'google'")
        if self.wants_reasoning and self.thinking_level not in GEMINI_THINKING_LEVELS:
            raise ValueError(
                f"Gemini thinking_level must be one of {sorted(GEMINI_THINKING_LEVELS)}, "
                f"got {self.thinking_level!r}"
            )
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                base_url=self.base_url,
                timeout=int(REQUEST_TIMEOUT * 1000),  # milliseconds
                retry_options=types.HttpRetryOptions(attempts=6),
                extra_body=self.extra_body,
            ),
        )

    def _complete(self, messages: list[dict]) -> Completion:
        contents = [
            types.Content(
                role="user" if msg["role"] == "user" else "model",
                parts=[types.Part(text=msg["content"])],
            )
            for msg in messages
        ]

        config = types.GenerateContentConfig(max_output_tokens=self.max_tokens, temperature=self.temperature)
        if self.google_search:
            config.tools = [types.Tool(google_search=types.GoogleSearch())]
        if self.wants_reasoning:
            config.thinking_config = types.ThinkingConfig(thinking_level=self.thinking_level)
        system = self.get_system_prompt()
        if system:
            config.system_instruction = system

        response = self.client.models.generate_content(
            model=self.api_model_id(),
            contents=contents,
            config=config,
        )

        meta = response.usage_metadata
        native = None
        if response.candidates and response.candidates[0].finish_reason:
            native = response.candidates[0].finish_reason.name
        elif response.prompt_feedback and response.prompt_feedback.block_reason:
            native = f"PROMPT_{response.prompt_feedback.block_reason.name}"

        if native == "MAX_TOKENS":
            finish = "length"
        elif native in _FILTERED or (native or "").startswith("PROMPT_"):
            finish = "content_filter"
        elif native == "STOP":
            finish = "stop"
        else:
            finish = native and native.lower()

        return Completion(
            content=response.text or "",
            input_tokens=(meta.prompt_token_count or 0) if meta else 0,
            output_tokens=(meta.candidates_token_count or 0) if meta else 0,
            thinking_tokens=(meta.thoughts_token_count or 0) if meta else 0,
            finish_reason=finish,
            native_finish_reason=native,
        )
