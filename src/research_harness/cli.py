import click
from pathlib import Path

from .config import ExperimentConfig
from .judge import JudgeError, run_judge
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


if __name__ == "__main__":
    main()
