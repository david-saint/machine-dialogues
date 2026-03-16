#!/usr/bin/env python3
"""
Import conversations from the Wyattwalls/AI_convos format into the local transcript format.

Usage:
    # Import a single local file
    python scripts/import_from_wyattwalls.py path/to/file

    # Import from a raw GitHub URL
    python scripts/import_from_wyattwalls.py https://raw.githubusercontent.com/Wyattwalls/AI_convos/main/filename

    # Import a whole GitHub repo (lists all files and imports each)
    python scripts/import_from_wyattwalls.py --repo https://github.com/Wyattwalls/AI_convos

    # Dry run (print what would be created, don't write)
    python scripts/import_from_wyattwalls.py path/to/file --dry-run
"""

import argparse
import re
import sys
import urllib.request
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
TRANSCRIPTS_DIR = REPO_ROOT / "transcripts"

# ──────────────────────────────────────────────────────────────────────────────
# Parsing
# ──────────────────────────────────────────────────────────────────────────────

def _fetch_text(source: str) -> str:
    """Return text content from a local path or URL."""
    if source.startswith("http://") or source.startswith("https://"):
        with urllib.request.urlopen(source) as resp:
            return resp.read().decode("utf-8")
    return Path(source).read_text(encoding="utf-8")


def _to_raw_url(url: str) -> str:
    """Convert a github.com blob URL to a raw.githubusercontent.com URL."""
    # https://github.com/owner/repo/blob/branch/path → https://raw.githubusercontent.com/owner/repo/branch/path
    url = url.replace("https://github.com/", "https://raw.githubusercontent.com/")
    url = url.replace("/blob/", "/")
    return url


def _list_repo_files(repo_url: str) -> list[str]:
    """Return raw content URLs for all files in a GitHub repo using the API."""
    # https://github.com/owner/repo  →  owner/repo
    repo_url = repo_url.rstrip("/")
    parts = repo_url.replace("https://github.com/", "").split("/")
    owner, repo = parts[0], parts[1]
    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/"
    req = urllib.request.Request(api_url, headers={"User-Agent": "import-script"})
    with urllib.request.urlopen(req) as resp:
        entries = json.loads(resp.read())
    return [
        e["download_url"]
        for e in entries
        if e["type"] == "file" and e["download_url"]
    ]


def parse_wyattwalls(text: str) -> dict:
    """
    Parse a Wyattwalls-format conversation file into a dict with keys:
      timestamp, max_turns, model_a, model_b, provider_a, provider_b,
      thinking_a, thinking_b, system_prompt_a, system_prompt_b,
      turns: list[{turn_number, model_key, thinking, content}]
    """
    result: dict = {
        "timestamp": None,
        "max_turns": 20,
        "model_a": None,
        "model_b": None,
        "provider_a": None,
        "provider_b": None,
        "thinking_a": None,
        "thinking_b": None,
        "system_prompt_a": "",
        "system_prompt_b": "",
        "turns": [],
    }

    # ── Parameters block ──────────────────────────────────────────────────────
    param_match = re.search(r"Parameters:(.*?)(?=\nModels:|\n={5,})", text, re.DOTALL)
    if param_match:
        params_text = param_match.group(1)
        ts = re.search(r"Timestamp:\s*(.+)", params_text)
        if ts:
            result["timestamp"] = ts.group(1).strip()
        mt = re.search(r"Max Turns:\s*(\d+)", params_text)
        if mt:
            result["max_turns"] = int(mt.group(1))
        ta = re.search(r"Thinking A:\s*(.+)", params_text)
        if ta:
            result["thinking_a"] = ta.group(1).strip()
        tb = re.search(r"Thinking B:\s*(.+)", params_text)
        if tb:
            result["thinking_b"] = tb.group(1).strip()

    # ── Models block ──────────────────────────────────────────────────────────
    models_match = re.search(r"Models:(.*?)(?=\n(?:Pricing|System Prompt|={5,}))", text, re.DOTALL)
    if models_match:
        models_text = models_match.group(1)
        ma = re.search(r"Model A:\s*(.+?)\s*\[(.+?)\]", models_text)
        if ma:
            result["model_a"] = ma.group(1).strip()
            result["provider_a"] = ma.group(2).strip()
        mb = re.search(r"Model B:\s*(.+?)\s*\[(.+?)\]", models_text)
        if mb:
            result["model_b"] = mb.group(1).strip()
            result["provider_b"] = mb.group(2).strip()

    # ── System Prompts ────────────────────────────────────────────────────────
    spa = re.search(r"System Prompt A:\s*(.+?)(?=System Prompt B:|={5,})", text, re.DOTALL)
    if spa:
        result["system_prompt_a"] = spa.group(1).strip()
    spb = re.search(r"System Prompt B:\s*(.+?)(?=={5,})", text, re.DOTALL)
    if spb:
        result["system_prompt_b"] = spb.group(1).strip()

    # ── Turn blocks ───────────────────────────────────────────────────────────
    # Split on the ═══ dividers that precede each `█` header.
    # The pattern is: =====\n█ TURN N - MODEL X: model\n=====\ncontent
    divider = re.compile(r"={5,}\n█ ((?:INITIAL PROMPT|TURN \d+)) - MODEL ([AB]):\s*(.+?)\n={5,}", re.MULTILINE)

    segments = []
    prev_end = 0
    for m in divider.finditer(text):
        if prev_end > 0:
            segments[-1]["body"] = text[prev_end:m.start()]
        segments.append({
            "label_raw": m.group(1),
            "model_key": m.group(2),  # "A" or "B"
            "model_name": m.group(3).strip(),
            "body": "",
        })
        prev_end = m.end()
    if segments:
        segments[-1]["body"] = text[prev_end:]

    for seg in segments:
        label = seg["label_raw"]
        body = seg["body"].strip()

        # Determine turn number
        if label.startswith("INITIAL"):
            turn_number = 0
        else:
            tn_match = re.search(r"TURN (\d+)", label)
            turn_number = int(tn_match.group(1)) if tn_match else 0

        # Split [THINKING] / [RESPONSE]
        thinking = None
        content = body
        thinking_match = re.search(r"\[THINKING\](.*?)(?=\[RESPONSE\]|$)", body, re.DOTALL)
        response_match = re.search(r"\[RESPONSE\](.*)", body, re.DOTALL)
        if thinking_match:
            thinking = thinking_match.group(1).strip()
        if response_match:
            content = response_match.group(1).strip()
        elif not thinking_match:
            # No markers at all — whole body is content
            content = body

        result["turns"].append({
            "turn_number": turn_number,
            "model_key": seg["model_key"],
            "model_name": seg["model_name"],
            "thinking": thinking,
            "content": content,
        })

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Name helpers
# ──────────────────────────────────────────────────────────────────────────────

# Map model identifiers to human-readable names matching the avatars dict
_MODEL_NAME_MAP = {
    "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
    "gemini-3.1-pro": "Gemini 3.1 Pro",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    "gemini-3-flash": "Gemini 3 Flash",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "gpt-5.4": "GPT-5.4",
}

def _friendly_name(model_id: str) -> str:
    for key, name in _MODEL_NAME_MAP.items():
        if key in model_id.lower():
            return name
    # Fallback: title-case the model id
    return model_id.replace("-", " ").title()


# ──────────────────────────────────────────────────────────────────────────────
# Formatting
# ──────────────────────────────────────────────────────────────────────────────

def _format_local(parsed: dict, source_name: str) -> tuple[str, str]:
    """
    Convert a parsed Wyattwalls dict to (filename, markdown_content) in local format.
    """
    model_a = parsed["model_a"] or "model-a"
    model_b = parsed["model_b"] or "model-b"
    provider_a = parsed["provider_a"] or "unknown"
    provider_b = parsed["provider_b"] or "unknown"
    name_a = _friendly_name(model_a)
    name_b = _friendly_name(model_b)

    # ── Filename ──────────────────────────────────────────────────────────────
    ts_raw = parsed.get("timestamp") or ""
    try:
        dt = datetime.strptime(ts_raw, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        dt = datetime.now(timezone.utc)
    ts_file = dt.strftime("%Y%m%d_%H%M%S")
    slug_a = name_a.replace(" ", "-").lower()
    slug_b = name_b.replace(" ", "-").lower()
    filename = f"{ts_file}_{slug_a}_vs_{slug_b}.md"

    # ── Header ────────────────────────────────────────────────────────────────
    lines: list[str] = []
    lines.append(f"# Experiment: {name_a} vs {name_b}")
    date_str = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    lines.append(f"**Date:** {date_str}")
    lines.append(f"**Turns:** {parsed['max_turns']}")
    lines.append("")

    # ── Models ────────────────────────────────────────────────────────────────
    lines.append("## Models")
    lines.append(f"- **{name_a}:** {model_a} [{provider_a}]")
    lines.append(f"- **{name_b}:** {model_b} [{provider_b}]")
    lines.append("")

    # ── System Prompts ────────────────────────────────────────────────────────
    sp_a = parsed.get("system_prompt_a", "").strip()
    sp_b = parsed.get("system_prompt_b", "").strip()
    if sp_a or sp_b:
        lines.append("## System Prompts")
        if sp_a:
            lines.append(f"### {name_a}")
            lines.append(sp_a)
            lines.append("")
        if sp_b:
            lines.append(f"### {name_b}")
            lines.append(sp_b)
            lines.append("")

    # ── Conversation ─────────────────────────────────────────────────────────
    lines.append("## Conversation")
    lines.append("")

    model_map = {"A": (name_a, model_a), "B": (name_b, model_b)}

    for turn in parsed["turns"]:
        name, model = model_map[turn["model_key"]]
        tn = turn["turn_number"]

        if tn == 0:
            lines.append(f"### INITIAL — {name}: {model}")
        else:
            lines.append(f"### Turn {tn} — {name}: {model}")

        # No per-turn timestamps in Wyattwalls format; omit.
        lines.append("")

        if turn.get("thinking"):
            lines.append("<!-- thinking-start -->")
            lines.append(turn["thinking"])
            lines.append("<!-- thinking-end -->")
            lines.append("")

        lines.append(turn["content"])
        lines.append("")

    return filename, "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Entry points
# ──────────────────────────────────────────────────────────────────────────────

def import_source(source: str, dry_run: bool = False, overwrite: bool = False) -> Path | None:
    """
    Import a single Wyattwalls file (local path or URL).
    Returns the output path, or None if skipped.
    """
    print(f"→ Reading: {source}")
    text = _fetch_text(source)

    parsed = parse_wyattwalls(text)
    if not parsed["model_a"] and not parsed["turns"]:
        print("  ✗ Could not parse — no models or turns found. Skipping.")
        return None

    filename, content = _format_local(parsed, source)
    out_path = TRANSCRIPTS_DIR / filename

    if out_path.exists() and not overwrite:
        print(f"  ↷ Already exists, skipping: {filename}")
        return None

    if dry_run:
        print(f"  ✓ [dry-run] Would write: {filename}")
        print(f"    ({len(parsed['turns'])} turns, model_a={parsed['model_a']}, model_b={parsed['model_b']})")
        return out_path

    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(content, encoding="utf-8")
    print(f"  ✓ Written: {filename}")
    return out_path


def main():
    parser = argparse.ArgumentParser(
        description="Import Wyattwalls/AI_convos conversations into local transcript format"
    )
    parser.add_argument(
        "source",
        nargs="?",
        help="Local file path or URL (raw or blob) to a single Wyattwalls file",
    )
    parser.add_argument(
        "--repo",
        metavar="GITHUB_URL",
        help="Import all files from a GitHub repo (e.g. https://github.com/Wyattwalls/AI_convos)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without writing anything",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing transcripts (default: skip)",
    )
    args = parser.parse_args()

    if not args.source and not args.repo:
        parser.print_help()
        sys.exit(1)

    sources: list[str] = []

    if args.repo:
        print(f"Listing files from repo: {args.repo}")
        sources = _list_repo_files(args.repo)
        print(f"Found {len(sources)} files\n")
    else:
        src = args.source
        # Convert blob GitHub URL to raw
        if "github.com" in src and "/blob/" in src:
            src = _to_raw_url(src)
        sources = [src]

    imported = 0
    for src in sources:
        result = import_source(src, dry_run=args.dry_run, overwrite=args.overwrite)
        if result:
            imported += 1

    action = "Would import" if args.dry_run else "Imported"
    print(f"\n{action} {imported}/{len(sources)} file(s).")


if __name__ == "__main__":
    main()
