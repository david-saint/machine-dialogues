import click
from pathlib import Path

from .analysis import write_analysis
from .config import ExperimentConfig
from .judge import JudgeError, run_judge
from .panel import PANEL_PATH, run_panel
from .runner import run_experiment, resume_experiment


@click.group()
def main():
    """Research Harness — agent-to-agent conversation experiments."""
    pass


@main.command()
@click.argument("config_path", type=click.Path(exists=True))
@click.option("--turns", type=int, default=None, help="Override number of turns")
@click.option("--initial-message", type=str, default=None, help="Override initial message")
def run(config_path: str, turns: int | None, initial_message: str | None):
    """Run an experiment from a YAML config file."""
    config = ExperimentConfig.from_yaml(config_path)

    if turns is not None:
        config.turns = turns
    if initial_message is not None:
        config.initial_message = initial_message

    run_experiment(config)


@main.command()
@click.argument("config_path", type=click.Path(exists=True))
@click.argument("transcript_path", type=click.Path(exists=True))
@click.option("--turns", type=int, default=1, help="Number of additional turns to run (default: 1)")
def resume(config_path: str, transcript_path: str, turns: int):
    """Resume an experiment from a saved transcript."""
    config = ExperimentConfig.from_yaml(config_path)
    resume_experiment(config, transcript_path, additional_turns=turns)


@main.command()
@click.argument("transcript_path", type=click.Path(exists=True))
@click.option("--model", required=True, help="Judge model id, e.g. anthropic/claude-opus-4.8")
@click.option("--provider", default="openrouter", show_default=True, help="Provider to route the judge model through")
@click.option("--thinking-level", default=None, help="Reasoning effort for the judge, e.g. high, xhigh, max")
@click.option("--judge-name", default=None, help="Human-readable judge name (defaults to the model id)")
@click.option("--output-dir", default="judgments", show_default=True, type=click.Path(), help="Directory to write judgments under")
def judge(transcript_path: str, model: str, provider: str, thinking_level: str | None, judge_name: str | None, output_dir: str):
    """Score a debate transcript with a judge model."""
    try:
        run_judge(
            transcript_path=transcript_path,
            model=model,
            provider=provider,
            thinking_level=thinking_level,
            judge_name=judge_name,
            output_dir=output_dir,
        )
    except JudgeError as e:
        raise click.ClickException(str(e))


@main.command("judge-panel")
@click.argument("transcript_paths", nargs=-1, required=True, type=click.Path(exists=True))
@click.option("--panel", "panel_path", default=str(PANEL_PATH), show_default=True, type=click.Path(exists=True), help="Panel definition (one judge per family)")
@click.option("--output-dir", default="judgments", show_default=True, type=click.Path(), help="Directory to write judgments under")
@click.option("--force", is_flag=True, help="Re-judge transcripts whose judgment files already exist")
def judge_panel(transcript_paths: tuple[str, ...], panel_path: str, output_dir: str, force: bool):
    """Score transcripts with the full judge panel (one judge per model family).

    Idempotent: existing judgments are skipped, so re-running the same command
    resumes an interrupted matrix.
    """
    results = run_panel(
        list(transcript_paths),
        output_dir=output_dir,
        force=force,
        panel_path=panel_path,
    )
    failures = [r for r in results if r["status"] == "error"]
    if failures:
        detail = "\n".join(f"  - {r['judge']} on {r['transcript']}: {r['detail']}" for r in failures)
        raise click.ClickException(f"{len(failures)} judge run(s) failed:\n{detail}")


@main.command("analyze-bias")
@click.option("--judgments-dir", default="judgments", show_default=True, type=click.Path(exists=True), help="Directory holding judgments (archive/ is excluded)")
@click.option("--transcripts-dir", default="transcripts", show_default=True, type=click.Path(exists=True), help="Directory holding the judged transcripts")
@click.option("--output", "output_path", default="judgments/analysis.json", show_default=True, type=click.Path(), help="Where to write the analysis JSON")
def analyze_bias(judgments_dir: str, transcripts_dir: str, output_path: str):
    """Regress each judge's net-round shift against family interest.

    Also regresses the split resolution/craft verdicts and measures
    first-speaker position bias, writing everything to one JSON the viewer
    can consume.
    """
    out = write_analysis(judgments_dir, transcripts_dir, output_path)
    click.echo(f"Analysis written: {out}")


if __name__ == "__main__":
    main()
