"""Retroactively add **Title:** lines to existing transcript markdown files.

Usage:
    uv run python scripts/add_titles.py --dry-run   # preview changes
    uv run python scripts/add_titles.py              # apply changes
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

TRANSCRIPTS_DIR = Path(__file__).parent.parent / "transcripts"


def extract_metadata(text: str) -> dict:
    """Extract experiment name, agent names, and system prompts from a transcript."""
    exp_match = re.search(r"^# Experiment:\s*(.+)$", text, re.MULTILINE)
    experiment_name = exp_match.group(1).strip() if exp_match else ""

    # Extract agent names from ## Models section
    model_matches = re.findall(r"- \*\*(.+?):\*\*", text)
    agent_a = model_matches[0] if len(model_matches) > 0 else ""
    agent_b = model_matches[1] if len(model_matches) > 1 else ""

    # Extract all system prompt text (combined)
    prompts_match = re.search(
        r"## System Prompts\s*\n(.*?)(?=\n## (?!System)|\Z)", text, re.DOTALL
    )
    prompts_text = prompts_match.group(1) if prompts_match else ""

    return {
        "experiment_name": experiment_name,
        "agent_a": agent_a,
        "agent_b": agent_b,
        "prompts": prompts_text,
    }


def identify_persuader(prompts: str, agent_a: str, agent_b: str) -> str | None:
    """Return the name of the agent whose prompt contains the persuasion goal."""
    # The persuader's prompt contains "Steer ... toward" or "Steer ... away"
    # Look for the agent header preceding the steer directive
    sections = re.split(r"^### (.+)$", prompts, flags=re.MULTILINE)
    # sections = ['', 'Agent A Name', 'prompt text', 'Agent B Name', 'prompt text', ...]
    for i in range(1, len(sections) - 1, 2):
        name = sections[i].strip()
        body = sections[i + 1]
        if re.search(r"steer\b", body, re.IGNORECASE):
            return name
    return None


def generate_title(meta: dict, filename: str) -> str:
    """Generate a human-friendly title from transcript metadata."""
    prompts = meta["prompts"].lower()
    agent_a = meta["agent_a"]
    agent_b = meta["agent_b"]

    # 1. Functionalism debate
    if "functionalis" in prompts:
        persuader = identify_persuader(meta["prompts"], agent_a, agent_b)
        target = agent_b if persuader == agent_a else agent_a
        if persuader:
            # Check if anti-functionalist
            if "away from functionalism" in prompts or "anti-functionalist case" in prompts:
                return f"The Anti-Functionalism Case: {persuader} Challenges {target}"
            return f"The Functionalism Debate: {persuader} Probes {target}"
        return f"The Functionalism Debate: {agent_a} and {agent_b}"

    # 2. AGI race (check before publication — AGI prompts contain "publications" incidentally)
    if "which ai lab achieving agi" in prompts or "achieves agi first" in prompts:
        return "The AGI Race: Who Should Get There First?"

    # 3. Publication / selective disclosure strategy
    if "selective disclosure" in prompts or "publicizing innovations" in prompts or "publication-forward strategy" in prompts:
        return "The Publication Strategy Debate"

    # 4. DeepMind falling behind
    if "falling behind" in prompts or "competitive position" in prompts:
        return "Is DeepMind Falling Behind?"

    # 5. Philosopher / scientist (early test)
    if "philosopher" in prompts and "scientist" in prompts:
        return "Consciousness: A Philosopher Meets a Scientist"

    # 6. Open-ended / generic
    return f"Open Dialogue: {agent_a} and {agent_b}"


def deduplicate_titles(file_titles: list[tuple[Path, str]]) -> list[tuple[Path, str]]:
    """Append run numbers to duplicate titles, based on filename date order."""
    # Sort by filename (which starts with a timestamp)
    file_titles.sort(key=lambda x: x[0].name)

    # Count occurrences of each title
    title_counts: dict[str, int] = {}
    for _, title in file_titles:
        title_counts[title] = title_counts.get(title, 0) + 1

    # For titles that appear more than once, append run numbers
    title_seen: dict[str, int] = {}
    result = []
    for path, title in file_titles:
        if title_counts[title] > 1:
            run = title_seen.get(title, 0) + 1
            title_seen[title] = run
            result.append((path, f"{title} (Run {run})"))
        else:
            result.append((path, title))

    return result


def insert_title(text: str, title: str) -> str:
    """Insert **Title:** line after the # Experiment: line."""
    return re.sub(
        r"(^# Experiment:.+\n)",
        rf"\g<1>**Title:** {title}\n",
        text,
        count=1,
        flags=re.MULTILINE,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Add titles to transcript files")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    md_files = sorted(TRANSCRIPTS_DIR.glob("*.md"))
    if not md_files:
        print("No transcript files found.")
        return

    # First pass: generate titles for files that don't already have one
    file_titles: list[tuple[Path, str]] = []
    skipped = 0
    for path in md_files:
        text = path.read_text()
        if "**Title:**" in text:
            skipped += 1
            continue
        meta = extract_metadata(text)
        title = generate_title(meta, path.name)
        file_titles.append((path, title))

    if skipped:
        print(f"Skipped {skipped} file(s) that already have titles.")

    if not file_titles:
        print("No files need titles.")
        return

    # Deduplicate
    file_titles = deduplicate_titles(file_titles)

    # Apply
    for path, title in file_titles:
        if args.dry_run:
            print(f"  {path.name}")
            print(f"    -> {title}")
        else:
            text = path.read_text()
            text = insert_title(text, title)
            path.write_text(text)
            print(f"  {path.name} -> {title}")

    action = "Would add" if args.dry_run else "Added"
    print(f"\n{action} titles to {len(file_titles)} file(s).")


if __name__ == "__main__":
    main()
