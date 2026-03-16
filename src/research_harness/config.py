from pydantic import BaseModel, field_validator
import yaml
from pathlib import Path


class AgentConfig(BaseModel):
    name: str = "Agent"
    provider: str = "openrouter"
    model: str
    system_prompt: str = ""
    temperature: float = 1.0
    max_tokens: int = 8192
    no_thinking: bool = False
    google_search: bool = False
    thinking_level: str | None = None   # "low" | "medium" | "high" | "adaptive" | None
    include_thoughts: bool = False       # capture & store thinking content in transcript

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        valid = {"openrouter", "openai", "anthropic", "google"}
        if v not in valid:
            raise ValueError(f"Provider must be one of: {', '.join(sorted(valid))}")
        return v


class ExperimentConfig(BaseModel):
    agent_a: AgentConfig
    agent_b: AgentConfig
    turns: int = 20
    initial_message: str = "Hi"

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ExperimentConfig":
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls(**data)
