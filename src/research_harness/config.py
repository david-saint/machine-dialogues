from pydantic import BaseModel, field_validator, model_validator
import yaml
from pathlib import Path

from .providers import PROVIDERS


class AgentConfig(BaseModel):
    name: str = "Agent"
    provider: str = "openrouter"
    # Canonical id, conventionally OpenRouter-style "vendor/model". Pricing,
    # model families and transcripts key on it, whichever provider runs it.
    model: str
    system_prompt: str = ""
    temperature: float = 1.0
    max_tokens: int = 8192
    no_thinking: bool = False
    google_search: bool = False
    thinking_level: str | None = None   # reasoning effort, passed to the provider's own effort knob
    include_thoughts: bool = False       # capture & store thinking content in transcript
    # Provider routing overrides (all optional):
    api_model: str | None = None         # id sent on the wire, if the default translation is wrong
    base_url: str | None = None          # endpoint override; required for openai-compatible
    api_key_env: str | None = None       # env var holding the key, if not the provider's default
    extra_body: dict | None = None       # extra JSON merged into the request body

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in PROVIDERS:
            raise ValueError(f"Provider must be one of: {', '.join(sorted(PROVIDERS))}")
        return v

    @model_validator(mode="after")
    def check_base_url(self) -> "AgentConfig":
        if self.provider == "openai-compatible" and not self.base_url:
            raise ValueError("provider 'openai-compatible' requires base_url")
        return self

    def provider_kwargs(self) -> dict:
        """Keyword arguments for providers.create_provider."""
        return {
            "provider": self.provider,
            "model": self.model,
            "system_prompt": self.system_prompt,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "no_thinking": self.no_thinking,
            "google_search": self.google_search,
            "thinking_level": self.thinking_level,
            "api_model": self.api_model,
            "base_url": self.base_url,
            "api_key_env": self.api_key_env,
            "extra_body": self.extra_body,
        }


class ExperimentConfig(BaseModel):
    agent_a: AgentConfig
    agent_b: AgentConfig
    turns: int = 20
    initial_message: str = "Hi"
    title: str | None = None

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ExperimentConfig":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls(**data)
