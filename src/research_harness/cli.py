import click
from pathlib import Path

from .config import ExperimentConfig
from .runner import run_experiment


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


if __name__ == "__main__":
    main()
