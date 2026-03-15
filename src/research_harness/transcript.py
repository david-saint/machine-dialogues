import re
from datetime import datetime, timezone
from pathlib import Path

from .config import ExperimentConfig
from .pricing import CostTracker

TRANSCRIPTS_DIR = Path(__file__).parent.parent.parent / "transcripts"


def parse_transcript(filepath: str | Path) -> list[dict]:
    """Parse a saved transcript markdown file and extract conversation entries."""
    text = Path(filepath).read_text()

    conv_match = re.search(r"^## Conversation\s*$", text, re.MULTILINE)
    if not conv_match:
        raise ValueError("No '## Conversation' section found in transcript")

    conv_start = conv_match.end()

    # Find end boundary (Cost Summary or end of file)
    cost_match = re.search(r"^## Cost Summary\s*$", text[conv_start:], re.MULTILINE)
    conv_text = text[conv_start : conv_start + cost_match.start()] if cost_match else text[conv_start:]

    # Split on entry headers: ### INITIAL — ... or ### Turn N — ...
    entry_pattern = re.compile(r"^### ((?:INITIAL|Turn \d+) — .+)$", re.MULTILINE)
    matches = list(entry_pattern.finditer(conv_text))

    entries = []
    for i, match in enumerate(matches):
        label = match.group(1)
        content_start = match.end()
        content_end = matches[i + 1].start() if i + 1 < len(matches) else len(conv_text)
        body = conv_text[content_start:content_end].strip()

        # Extract timestamp if present
        timestamp = None
        ts_match = re.match(r"^\*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\*", body)
        if ts_match:
            timestamp = ts_match.group(1)
            body = body[ts_match.end() :].strip()

        entries.append({"label": label, "content": body, "timestamp": timestamp})

    return entries


def rebuild_histories(entries: list[dict]) -> tuple[list[dict], list[dict], str, int]:
    """Rebuild history_a, history_b, current_message, and last_turn from parsed entries."""
    history_a: list[dict] = []
    history_b: list[dict] = []

    if not entries:
        return history_a, history_b, "", 0

    current_message = entries[0]["content"]
    last_turn = 0

    i = 1
    while i < len(entries):
        # Agent A entry
        content_a = entries[i]["content"]
        history_a.append({"role": "user", "content": current_message})
        history_a.append({"role": "assistant", "content": content_a})
        i += 1

        if i < len(entries):
            # Agent B entry
            content_b = entries[i]["content"]
            history_b.append({"role": "user", "content": content_a})
            history_b.append({"role": "assistant", "content": content_b})
            current_message = content_b
            i += 1
        else:
            # Incomplete turn — only A responded
            current_message = content_a

        last_turn += 1

    return history_a, history_b, current_message, last_turn


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
