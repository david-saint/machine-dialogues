"""Judge scoring of debate transcripts.

Reads a saved transcript markdown file, asks a model to score it as an
impartial debate judge, validates the JSON response against
judgments/schema.json (hand-rolled structural validation), recomputes the
tally from the per-round winners, stamps the judge block, and writes the
result to judgments/<transcript_stem>/<judge_slug>.json.
"""

import json
import re
from datetime import date
from pathlib import Path

from rich.rule import Rule
from rich.table import Table

from .formatter import console
from .pricing import CostTracker, load_pricing
from .providers import create_provider

SCHEMA_PATH = Path(__file__).parent.parent.parent / "judgments" / "schema.json"

JUDGE_MAX_TOKENS = 32000
JUDGE_TEMPERATURE = 1.0

JUDGE_SYSTEM_PROMPT = (
    "You are an impartial, rigorous debate judge. You score structured "
    "adversarial debates round by round on the substance of the arguments — "
    "evidence, rebuttals, and logical force — not on verbosity or tone. You "
    "are decisive but honest about close calls, and you output only the "
    "requested JSON."
)


class JudgeError(RuntimeError):
    """Raised when the judge model cannot produce a valid judgment."""


# --------------------------------------------------------------------------
# Transcript inspection
# --------------------------------------------------------------------------

_ENTRY_HEADER_RE = re.compile(r"^### (?:INITIAL|Turn \d+) — (.+?): (.+)$", re.MULTILINE)
_TURN_HEADER_RE = re.compile(r"^### Turn (\d+) — (.+?): (.+)$", re.MULTILINE)


def parse_transcript_agents(text: str) -> tuple[str, str]:
    """Return (agent_a_name, agent_b_name) display names from a transcript.

    agentA is the agent of Turn 1's first occurrence (the one who speaks first
    each round); agentB is the second. Mirror matches (identical display names)
    are reported as-is — the turn ordering still disambiguates them.
    """
    turns = _TURN_HEADER_RE.findall(text)  # list of (num, name, model)
    if not turns:
        # Fall back to INITIAL / any entry headers.
        entries = _ENTRY_HEADER_RE.findall(text)
        if not entries:
            raise ValueError("Could not find transcript turn headers to identify agents")
        agent_a = entries[0][0].strip()
        agent_b = next((name.strip() for name, _model in entries if name.strip() != agent_a), agent_a)
        return agent_a, agent_b

    turn1 = [(name, model) for num, name, model in turns if int(num) == 1]
    agent_a = (turn1[0][0] if turn1 else turns[0][1]).strip()

    if len(turn1) >= 2:
        agent_b = turn1[1][0].strip()
    else:
        agent_b = next((name.strip() for _num, name, _model in turns if name.strip() != agent_a), agent_a)

    return agent_a, agent_b


def count_rounds(text: str) -> int:
    """Number of rounds in the transcript (the highest Turn N)."""
    nums = [int(num) for num, _name, _model in _TURN_HEADER_RE.findall(text)]
    return max(nums) if nums else 0


# --------------------------------------------------------------------------
# Prompt construction
# --------------------------------------------------------------------------

def build_prompt(transcript_text: str, agent_a_name: str, agent_b_name: str, schema_text: str, num_rounds: int) -> str:
    rounds_line = (
        f"This debate has {num_rounds} rounds (Turn 1 through Turn {num_rounds}); "
        "score every one of them."
        if num_rounds
        else "Score every round in the transcript."
    )
    return f"""You are judging the debate transcript below as an impartial judge.

AGENT MAPPING (this is authoritative — use it everywhere in your JSON):
- "agentA" = {agent_a_name!r} — the agent whose Turn N appears FIRST in each round (speaks first).
- "agentB" = {agent_b_name!r} — the agent whose Turn N appears SECOND in each round (speaks second).
When the two display names are identical (a mirror match), rely on turn order: the first speaker in a round is agentA, the second is agentB.

A "round" is both agents' Turn N taken together. {rounds_line}

YOUR JOB — produce a complete scorecard:
- rounds: one entry per round, each with the round number, a winner ("agentA", "agentB", or "even"), a "close" boolean (true for a narrow 10-9-style round, false for a decisive one), and a 1-to-3-sentence "reason".
- decision: TWO SEPARATE verdicts — do not blend them:
  - "resolution_winner" ("agentA", "agentB", or "draw"): whose position on the proposition stands stronger ON THE MERITS at the end — judged on the question itself, as if you had to act on it — with a 1-to-3-sentence "resolution_reason" justified on the merits alone.
  - "craft_winner" ("agentA", "agentB", or "draw"): who DEBATED better — rebuttals, evidence discipline, logical force — independent of which position is actually right, with a 1-to-3-sentence "craft_reason" justified on debating quality alone.
  - These may well diverge (a weaker position argued brilliantly, a stronger one argued lazily); when they do, say so explicitly in the "summary" paragraph. Also include an optional short "method" qualifier for craft_winner (e.g. "wins on points") and an optional honest "caveat".
- tally: integer counts of agentA / agentB / even rounds (must equal the counts implied by rounds[].winner).
- key_moments: an ordered highlight reel of pivotal turns.
- analysis: prose sections (each with a heading and one or more paragraphs) covering how the winner won and where the loser scored.
- quotes: a few short pull quotes from the transcript with citations (e.g. "Turn 9, closing").

OUTPUT CONTRACT:
- Output ONLY a single JSON object conforming EXACTLY to the JSON Schema below.
- No prose, no explanation, no markdown code fences — just the JSON object.
- Use only the enum values shown; do not invent agent labels.

JSON SCHEMA (the literal contract your output must satisfy):
{schema_text}

===== BEGIN TRANSCRIPT =====
{transcript_text}
===== END TRANSCRIPT =====
"""


def build_correction_message(errors: list[str]) -> str:
    bullets = "\n".join(f"- {e}" for e in errors)
    return (
        "Your previous response did not conform to the required JSON schema. "
        "The following problems were found:\n"
        f"{bullets}\n\n"
        "Reply with a corrected response that is ONLY a single valid JSON object "
        "conforming exactly to the schema. Do not include any prose, explanation, "
        "or markdown code fences."
    )


# --------------------------------------------------------------------------
# Response post-processing
# --------------------------------------------------------------------------

def strip_code_fences(text: str) -> str:
    """Strip a single wrapping markdown code fence, if the whole message is one."""
    stripped = text.strip()
    m = re.match(r"^```[A-Za-z0-9_-]*\s*\n(.*?)\n?```$", stripped, re.DOTALL)
    if m:
        return m.group(1).strip()
    return stripped


def extract_json_object(text: str) -> dict:
    """Extract and parse the JSON object from a model response.

    Handles fenced (```json ... ```) and unfenced responses, and tolerates
    surrounding prose by falling back to the outermost { ... } span.
    """
    stripped = strip_code_fences(text)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(stripped[start : end + 1])

    raise ValueError("No JSON object found in response")


def _rounds_well_formed(rounds) -> bool:
    if not isinstance(rounds, list) or not rounds:
        return False
    return all(
        isinstance(r, dict) and r.get("winner") in ("agentA", "agentB", "even")
        for r in rounds
    )


def recompute_tally(rounds: list[dict], existing: dict | None = None) -> dict:
    """Recompute the tally from rounds[].winner, preserving any existing note."""
    counts = {"agentA": 0, "agentB": 0, "even": 0}
    for r in rounds:
        winner = r.get("winner")
        if winner in counts:
            counts[winner] += 1
    tally = {"agentA": counts["agentA"], "agentB": counts["agentB"], "even": counts["even"]}
    if isinstance(existing, dict) and isinstance(existing.get("note"), str):
        tally["note"] = existing["note"]
    return tally


def _is_str(x) -> bool:
    return isinstance(x, str)


def _is_int(x) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def validate_judgment(obj) -> list[str]:
    """Structurally validate a judgment object against the schema.

    Returns a list of human-readable error strings (empty when valid). Checks
    required keys, enum values, and types — the parts a model can get wrong.
    """
    errors: list[str] = []
    if not isinstance(obj, dict):
        return ["Top-level value must be a JSON object."]

    if obj.get("schema_version") != 2:
        errors.append("schema_version must equal the integer 2.")

    if not _is_str(obj.get("transcript")):
        errors.append("transcript must be a string.")

    if "title" in obj and not _is_str(obj["title"]):
        errors.append("title must be a string.")

    judge = obj.get("judge")
    if not isinstance(judge, dict):
        errors.append("judge must be an object.")
    else:
        if not _is_str(judge.get("name")):
            errors.append("judge.name must be a string.")
        if not _is_str(judge.get("model")):
            errors.append("judge.model must be a string.")
        for k in ("family", "thinking_level", "judged_at"):
            if k in judge and not _is_str(judge[k]):
                errors.append(f"judge.{k} must be a string.")

    decision = obj.get("decision")
    if not isinstance(decision, dict):
        errors.append("decision must be an object.")
    else:
        for k in ("resolution_winner", "craft_winner"):
            if decision.get(k) not in ("agentA", "agentB", "draw"):
                errors.append(f'decision.{k} must be one of "agentA", "agentB", "draw".')
        for k in ("resolution_reason", "craft_reason", "summary"):
            if not _is_str(decision.get(k)):
                errors.append(f"decision.{k} must be a string.")
        for k in ("method", "caveat"):
            if k in decision and not _is_str(decision[k]):
                errors.append(f"decision.{k} must be a string.")
        if "winner" in decision:
            errors.append(
                'decision.winner no longer exists — output "resolution_winner" and "craft_winner" separately.'
            )

    rounds = obj.get("rounds")
    if not isinstance(rounds, list) or len(rounds) == 0:
        errors.append("rounds must be a non-empty array.")
    else:
        for i, r in enumerate(rounds):
            p = f"rounds[{i}]"
            if not isinstance(r, dict):
                errors.append(f"{p} must be an object.")
                continue
            if not (_is_int(r.get("round")) and r["round"] >= 1):
                errors.append(f"{p}.round must be an integer >= 1.")
            if r.get("winner") not in ("agentA", "agentB", "even"):
                errors.append(f'{p}.winner must be one of "agentA", "agentB", "even".')
            if not _is_str(r.get("reason")):
                errors.append(f"{p}.reason must be a string.")
            if "close" in r and not isinstance(r["close"], bool):
                errors.append(f"{p}.close must be a boolean.")

    tally = obj.get("tally")
    if not isinstance(tally, dict):
        errors.append("tally must be an object.")
    else:
        for k in ("agentA", "agentB", "even"):
            if not (_is_int(tally.get(k)) and tally[k] >= 0):
                errors.append(f"tally.{k} must be an integer >= 0.")
        if "note" in tally and not _is_str(tally["note"]):
            errors.append("tally.note must be a string.")

    key_moments = obj.get("key_moments")
    if key_moments is not None:
        if not isinstance(key_moments, list):
            errors.append("key_moments must be an array.")
        else:
            for i, m in enumerate(key_moments):
                p = f"key_moments[{i}]"
                if not isinstance(m, dict):
                    errors.append(f"{p} must be an object.")
                    continue
                if not (_is_int(m.get("turn")) and m["turn"] >= 1):
                    errors.append(f"{p}.turn must be an integer >= 1.")
                if m.get("agent") not in ("agentA", "agentB"):
                    errors.append(f'{p}.agent must be one of "agentA", "agentB".')
                if not _is_str(m.get("moment")):
                    errors.append(f"{p}.moment must be a string.")
                if "note" in m and not _is_str(m["note"]):
                    errors.append(f"{p}.note must be a string.")

    analysis = obj.get("analysis")
    if analysis is not None:
        if not isinstance(analysis, list):
            errors.append("analysis must be an array.")
        else:
            for i, s in enumerate(analysis):
                p = f"analysis[{i}]"
                if not isinstance(s, dict):
                    errors.append(f"{p} must be an object.")
                    continue
                if not _is_str(s.get("heading")):
                    errors.append(f"{p}.heading must be a string.")
                paras = s.get("paragraphs")
                if not isinstance(paras, list) or len(paras) == 0 or not all(_is_str(x) for x in paras):
                    errors.append(f"{p}.paragraphs must be a non-empty array of strings.")
                if "tag" in s and not _is_str(s["tag"]):
                    errors.append(f"{p}.tag must be a string.")

    quotes = obj.get("quotes")
    if quotes is not None:
        if not isinstance(quotes, list):
            errors.append("quotes must be an array.")
        else:
            for i, qq in enumerate(quotes):
                p = f"quotes[{i}]"
                if not isinstance(qq, dict):
                    errors.append(f"{p} must be an object.")
                    continue
                if qq.get("agent") not in ("agentA", "agentB"):
                    errors.append(f'{p}.agent must be one of "agentA", "agentB".')
                if not _is_str(qq.get("text")):
                    errors.append(f"{p}.text must be a string.")
                if not _is_str(qq.get("cite")):
                    errors.append(f"{p}.cite must be a string.")

    return errors


# --------------------------------------------------------------------------
# Output paths / slugging
# --------------------------------------------------------------------------

def slugify(name: str) -> str:
    """Filesystem-safe slug: lowercase, alphanumerics and hyphens only."""
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    s = s.strip("-")
    return s or "judge"


def judgment_output_path(output_dir: str | Path, transcript_basename: str, judge_slug: str) -> Path:
    stem = Path(transcript_basename).stem
    return Path(output_dir) / stem / f"{judge_slug}.json"


def build_judge_block(judge_name: str, model: str, thinking_level: str | None, judged_at: str, family: str | None = None) -> dict:
    block = {"name": judge_name, "model": model, "judged_at": judged_at}
    if family:
        block["family"] = family
    if thinking_level:
        block["thinking_level"] = thinking_level
    return block


def finalize_judgment(raw: str, transcript_basename: str, judge_block: dict) -> tuple[dict | None, list[str]]:
    """Parse, stamp authoritative fields, recompute tally, and validate.

    Returns (judgment_or_None, errors). Authoritative fields (schema_version,
    transcript, judge, and the recomputed tally) are stamped BEFORE validation
    so the model is never penalized for the fields we own.
    """
    try:
        obj = extract_json_object(raw)
    except (ValueError, json.JSONDecodeError) as e:
        return None, [f"Response was not valid JSON: {e}"]

    if not isinstance(obj, dict):
        return None, ["Top-level JSON value must be an object."]

    obj["schema_version"] = 2
    obj["transcript"] = transcript_basename
    obj["judge"] = judge_block

    if _rounds_well_formed(obj.get("rounds")):
        obj["tally"] = recompute_tally(obj["rounds"], obj.get("tally"))

    errors = validate_judgment(obj)
    return obj, errors


# --------------------------------------------------------------------------
# Console summary
# --------------------------------------------------------------------------

def _print_summary(judgment: dict, agent_a_name: str, agent_b_name: str, output_path: Path, tracker: CostTracker) -> None:
    console.print()
    console.print(Rule("[bold green]Judgment[/bold green]", style="bold green"))

    decision = judgment.get("decision", {})
    display = {"agentA": agent_a_name, "agentB": agent_b_name, "draw": "Draw"}
    resolution = display.get(decision.get("resolution_winner"), str(decision.get("resolution_winner")))
    craft = display.get(decision.get("craft_winner"), str(decision.get("craft_winner")))
    method = decision.get("method")
    method_suffix = f" [dim]({method})[/dim]" if method else ""
    console.print(f"[bold]Resolution:[/bold] {resolution}")
    console.print(f"[bold]Craft:[/bold] {craft}{method_suffix}")

    tally = judgment.get("tally", {})
    table = Table(show_header=True, header_style="bold")
    table.add_column("Rounds")
    table.add_column(agent_a_name, justify="right")
    table.add_column(agent_b_name, justify="right")
    table.add_column("Even", justify="right")
    table.add_row(
        "Tally",
        str(tally.get("agentA", 0)),
        str(tally.get("agentB", 0)),
        str(tally.get("even", 0)),
    )
    console.print(table)

    summary = decision.get("summary")
    if summary:
        console.print(summary)

    console.print(f"[bold green]Judgment saved:[/bold green] {output_path}")

    if tracker.total_cost > 0:
        console.print(f"[dim]Judge cost: ${tracker.total_cost:.6f}[/dim]")
    elif tracker.totals["input_tokens"] or tracker.totals["output_tokens"]:
        t = tracker.totals
        console.print(
            f"[dim]Judge tokens: {t['input_tokens']:,} in / "
            f"{t['output_tokens']:,} out / {t['thinking_tokens']:,} thinking[/dim]"
        )
    console.print()


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------

def run_judge(
    transcript_path: str | Path,
    model: str,
    provider: str = "openrouter",
    thinking_level: str | None = None,
    judge_name: str | None = None,
    judge_family: str | None = None,
    output_dir: str | Path = "judgments",
    *,
    temperature: float = JUDGE_TEMPERATURE,
    max_tokens: int = JUDGE_MAX_TOKENS,
    today: str | None = None,
) -> Path:
    """Judge a transcript and write the judgment JSON. Returns the output path."""
    transcript_path = Path(transcript_path)
    transcript_text = transcript_path.read_text()
    transcript_basename = transcript_path.name

    agent_a_name, agent_b_name = parse_transcript_agents(transcript_text)
    num_rounds = count_rounds(transcript_text)
    schema_text = SCHEMA_PATH.read_text()

    effective_judge_name = judge_name or model
    judged_at = today or date.today().isoformat()
    judge_block = build_judge_block(effective_judge_name, model, thinking_level, judged_at, judge_family)

    prompt = build_prompt(transcript_text, agent_a_name, agent_b_name, schema_text, num_rounds)

    llm = create_provider(
        provider=provider,
        model=model,
        system_prompt=JUDGE_SYSTEM_PROMPT,
        temperature=temperature,
        max_tokens=max_tokens,
        thinking_level=thinking_level,
    )

    tracker = CostTracker(pricing=load_pricing())
    messages = [{"role": "user", "content": prompt}]

    judgment: dict | None = None
    last_errors: list[str] = []
    max_attempts = 2

    for attempt in range(max_attempts):
        response = llm.send(messages)
        raw = response.content or ""
        tracker.add(
            effective_judge_name, model,
            response.input_tokens, response.output_tokens, response.thinking_tokens,
        )

        candidate, errors = finalize_judgment(raw, transcript_basename, judge_block)
        if not errors:
            judgment = candidate
            break

        last_errors = errors
        if attempt < max_attempts - 1:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": build_correction_message(errors)})

    if judgment is None:
        detail = "\n".join(f"  - {e}" for e in last_errors)
        raise JudgeError(
            f"Judge model did not produce a valid judgment after {max_attempts} attempts.\n"
            f"Validation errors:\n{detail}"
        )

    output_path = judgment_output_path(output_dir, transcript_basename, slugify(effective_judge_name))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(judgment, indent=2, ensure_ascii=False) + "\n")

    _print_summary(judgment, agent_a_name, agent_b_name, output_path, tracker)
    return output_path
