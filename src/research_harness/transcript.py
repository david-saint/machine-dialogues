from datetime import datetime, timezone
from pathlib import Path

from .config import ExperimentConfig
from .pricing import CostTracker

TRANSCRIPTS_DIR = Path(__file__).parent.parent.parent / "transcripts"


def save_transcript(
    config: ExperimentConfig,
    entries: list[dict],
    tracker: CostTracker,
    output_dir: Path | None = None,
) -> Path:
    out = output_dir or TRANSCRIPTS_DIR
    out.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name_a = config.agent_a.name.replace(" ", "-").lower()
    name_b = config.agent_b.name.replace(" ", "-").lower()
    filename = f"{ts}_{name_a}_vs_{name_b}.md"
    filepath = out / filename

    lines = []
    lines.append(f"# Experiment: {config.agent_a.name} vs {config.agent_b.name}")
    lines.append(f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    lines.append(f"**Turns:** {config.turns}")
    lines.append("")
    lines.append("## Models")
    lines.append(f"- **{config.agent_a.name}:** {config.agent_a.model} [{config.agent_a.provider}]")
    lines.append(f"- **{config.agent_b.name}:** {config.agent_b.model} [{config.agent_b.provider}]")
    lines.append("")

    if config.agent_a.system_prompt or config.agent_b.system_prompt:
        lines.append("## System Prompts")
        if config.agent_a.system_prompt:
            lines.append(f"### {config.agent_a.name}")
            lines.append(config.agent_a.system_prompt)
            lines.append("")
        if config.agent_b.system_prompt:
            lines.append(f"### {config.agent_b.name}")
            lines.append(config.agent_b.system_prompt)
            lines.append("")

    lines.append("## Conversation")
    lines.append("")

    for entry in entries:
        lines.append(f"### {entry['label']}")
        if entry.get("timestamp"):
            lines.append(f"*{entry['timestamp']}*")
        lines.append("")
        lines.append(entry["content"])
        lines.append("")

    # Cost summary
    if tracker.total_cost > 0:
        lines.append("## Cost Summary")
        lines.append("")
        lines.append("| Agent | Input Tokens | Output Tokens | Thinking Tokens | Total Cost |")
        lines.append("|-------|-------------|---------------|-----------------|------------|")
        for name, data in tracker.per_agent.items():
            total = data["input_cost"] + data["output_cost"] + data["thinking_cost"]
            lines.append(f"| {name} | {data['input_tokens']:,} | {data['output_tokens']:,} | {data['thinking_tokens']:,} | ${total:.6f} |")
        lines.append(f"| **Total** | {tracker.totals['input_tokens']:,} | {tracker.totals['output_tokens']:,} | {tracker.totals['thinking_tokens']:,} | **${tracker.total_cost:.6f}** |")
        lines.append("")

    filepath.write_text("\n".join(lines))
    return filepath
