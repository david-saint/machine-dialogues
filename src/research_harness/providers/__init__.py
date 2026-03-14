from .base import LLMProvider, ProviderResponse
from .openrouter import OpenRouterProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider

PROVIDERS = {
    "openrouter": OpenRouterProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "google": GoogleProvider,
}


def create_provider(provider: str, model: str, system_prompt: str, temperature: float, max_tokens: int, no_thinking: bool = False) -> LLMProvider:
    cls = PROVIDERS.get(provider)
    if cls is None:
        raise ValueError(f"Unknown provider: {provider!r}. Choose from: {', '.join(PROVIDERS)}")
    return cls(model=model, system_prompt=system_prompt, temperature=temperature, max_tokens=max_tokens, no_thinking=no_thinking)
