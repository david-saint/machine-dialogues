from .openai_compat import OpenAICompatibleProvider


class OpenRouterProvider(OpenAICompatibleProvider):
    """OpenRouter: one key, every lab. Model ids are sent as written
    (`vendor/model`), and reasoning uses OpenRouter's unified `reasoning`
    object rather than OpenAI's `reasoning_effort`."""

    label = "openrouter"
    default_base_url = "https://openrouter.ai/api/v1"
    default_api_key_env = "OPENROUTER_API_KEY"

    def _reasoning_params(self) -> dict:
        if self.no_thinking:
            return {"extra_body": {"reasoning": {"exclude": True}}}
        if self.thinking_level:
            return {"extra_body": {"reasoning": {"effort": self.thinking_level}}}
        return {}
