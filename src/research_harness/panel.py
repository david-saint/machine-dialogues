"""Run the judge panel — one judge per model family — over transcripts.

The panel is defined in judgments/panel.json. Runs are idempotent: a judgment
file that already exists is skipped unless force=True, so an interrupted
matrix can be resumed by re-running the same command. One judge failing does
not abort the matrix; failures are collected and reported at the end.
"""

import json
from pathlib import Path

from rich.table import Table

from .formatter import console
from .judge import judgment_output_path, run_judge, slugify

PANEL_PATH = Path(__file__).parent.parent.parent / "judgments" / "panel.json"


def model_family(model_id: str) -> str:
    """Family slug for a model id, e.g. 'anthropic/claude-opus-4.8' -> 'anthropic'.

    Used to relate judges to debaters; the OpenRouter vendor prefixes that
    differ from our family slugs are normalized.
    """
    vendor = model_id.split("/", 1)[0].lower() if "/" in model_id else model_id.lower()
    aliases = {"moonshotai": "moonshot", "x-ai": "xai"}
    return aliases.get(vendor, vendor)


def load_panel(panel_path: str | Path = PANEL_PATH) -> list[dict]:
    """Load and sanity-check the panel: exactly one judge per family."""
    data = json.loads(Path(panel_path).read_text())
    judges = data["judges"]
    families = [j["family"] for j in judges]
    duplicates = sorted({f for f in families if families.count(f) > 1})
    if duplicates:
        raise ValueError(
            f"panel violates one-vote-per-family: duplicate families {duplicates}"
        )
    for j in judges:
        for key in ("family", "name", "model"):
            if not j.get(key):
                raise ValueError(f"panel judge missing required key {key!r}: {j}")
    return judges


def run_panel(
    transcript_paths: list[str | Path],
    output_dir: str | Path = "judgments",
    force: bool = False,
    panel_path: str | Path = PANEL_PATH,
) -> list[dict]:
    """Judge every transcript with every panel judge. Returns one result row
    per (transcript, judge) with status ok / skipped / error."""
    judges = load_panel(panel_path)
    results: list[dict] = []

    for transcript_path in transcript_paths:
        basename = Path(transcript_path).name
        for spec in judges:
            row = {"transcript": basename, "family": spec["family"], "judge": spec["name"]}
            out_path = judgment_output_path(output_dir, basename, slugify(spec["name"]))
            if out_path.exists() and not force:
                results.append({**row, "status": "skipped", "detail": "judgment exists"})
                continue

            console.print(f"[bold]Judging[/bold] {basename} with {spec['name']} ({spec['family']})")
            try:
                run_judge(
                    transcript_path=transcript_path,
                    model=spec["model"],
                    provider=spec.get("provider", "openrouter"),
                    thinking_level=spec.get("thinking_level"),
                    judge_name=spec["name"],
                    judge_family=spec["family"],
                    output_dir=output_dir,
                )
            except Exception as e:  # noqa: BLE001 — finish the matrix, report failures at the end
                console.print(f"[bold red]FAILED[/bold red] {spec['name']} on {basename}: {e}")
                results.append({**row, "status": "error", "detail": f"{type(e).__name__}: {e}"})
            else:
                results.append({**row, "status": "ok", "detail": str(out_path)})

    _print_matrix(results)
    return results


def _print_matrix(results: list[dict]) -> None:
    table = Table(show_header=True, header_style="bold", title="Judge panel matrix")
    table.add_column("Transcript")
    table.add_column("Judge")
    table.add_column("Family")
    table.add_column("Status")
    styles = {"ok": "green", "skipped": "dim", "error": "bold red"}
    for r in results:
        table.add_row(
            Path(r["transcript"]).stem,
            r["judge"],
            r["family"],
            f"[{styles[r['status']]}]{r['status']}[/{styles[r['status']]}]",
        )
    console.print(table)
