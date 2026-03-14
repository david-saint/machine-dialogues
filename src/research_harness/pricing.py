import json
from pathlib import Path
from dataclasses import dataclass, field

PRICING_PATH = Path(__file__).parent.parent.parent / "pricing.json"


@dataclass
class CostTracker:
    pricing: dict = field(default_factory=dict)
    totals: dict = field(default_factory=lambda: {
        "input_tokens": 0,
        "output_tokens": 0,
        "thinking_tokens": 0,
        "input_cost": 0.0,
        "output_cost": 0.0,
        "thinking_cost": 0.0,
    })
    per_agent: dict = field(default_factory=dict)

    def _ensure_agent(self, name: str):
        if name not in self.per_agent:
            self.per_agent[name] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "thinking_tokens": 0,
                "input_cost": 0.0,
                "output_cost": 0.0,
                "thinking_cost": 0.0,
            }

    def add(self, agent_name: str, model: str, input_tokens: int, output_tokens: int, thinking_tokens: int = 0) -> dict:
        self._ensure_agent(agent_name)
        rates = self.pricing.get(model, {})
        input_rate = rates.get("input", 0)
        output_rate = rates.get("output", 0)
        thinking_rate = rates.get("thinking", output_rate)

        input_cost = input_tokens * input_rate / 1_000_000
        output_cost = output_tokens * output_rate / 1_000_000
        thinking_cost = thinking_tokens * thinking_rate / 1_000_000

        for store in [self.totals, self.per_agent[agent_name]]:
            store["input_tokens"] += input_tokens
            store["output_tokens"] += output_tokens
            store["thinking_tokens"] += thinking_tokens
            store["input_cost"] += input_cost
            store["output_cost"] += output_cost
            store["thinking_cost"] += thinking_cost

        return {
            "input_cost": input_cost,
            "output_cost": output_cost,
            "thinking_cost": thinking_cost,
            "total_cost": input_cost + output_cost + thinking_cost,
        }

    @property
    def total_cost(self) -> float:
        t = self.totals
        return t["input_cost"] + t["output_cost"] + t["thinking_cost"]


def load_pricing(path: Path | None = None) -> dict:
    p = path or PRICING_PATH
    if not p.exists():
        return {}
    with open(p) as f:
        return json.load(f)
