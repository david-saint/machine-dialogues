from .base import EmptyResponseError, LLMProvider, ProviderResponse
from .openai_compat import (
    DeepSeekProvider,
    MoonshotProvider,
    OpenAICompatibleProvider,
    OpenAIProvider,
    ProviderTransientError,
    XAIProvider,
)
from .openrouter import OpenRouterProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .mock_provider import MockProvider

PROVIDERS: dict[str, type[LLMProvider]] = {
    "openrouter": OpenRouterProvider,
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "google": GoogleProvider,
    "xai": XAIProvider,
    "moonshot": MoonshotProvider,
    "deepseek": DeepSeekProvider,
    "openai-compatible": OpenAICompatibleProvider,
    "mock": MockProvider,
}


def create_provider(
    provider: str,
    model: str,
    system_prompt: str,
    temperature: float,
    max_tokens: int,
    **options,
) -> LLMProvider:
    """Instantiate a provider. `options` are the optional LLMProvider kwargs:
    no_thinking, google_search, thinking_level, api_model, base_url,
    api_key_env, extra_body."""
    cls = PROVIDERS.get(provider)
    if cls is None:
        raise ValueError(f"Unknown provider: {provider!r}. Choose from: {', '.join(PROVIDERS)}")
    return cls(model=model, system_prompt=system_prompt, temperature=temperature, max_tokens=max_tokens, **options)
