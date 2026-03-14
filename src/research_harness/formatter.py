from datetime import datetime, timezone
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

from .config import ExperimentConfig
from .pricing import CostTracker

console = Console()


def print_header(config: ExperimentConfig, pricing_enabled: bool):
    console.print()
    console.print("[bold]Models:[/bold]")

    def _model_line(label: str, agent):
        thinking = " (no thinking)" if agent.no_thinking else ""
        console.print(f"  - {label}: {agent.model} [dim][{agent.provider}][/dim]{thinking}")

    _model_line("Model A", config.agent_a)
    _model_line("Model B", config.agent_b)
    console.print()

    status = "enabled (pricing.json)" if pricing_enabled else "disabled"
    console.print(f"[bold]Pricing:[/bold] {status}")
    console.print()

    if config.agent_a.system_prompt:
        console.print(f"[bold]System Prompt A:[/bold] {config.agent_a.system_prompt}")
    if config.agent_b.system_prompt:
        console.print(f"[bold]System Prompt B:[/bold] {config.agent_b.system_prompt}")
    if config.agent_a.system_prompt or config.agent_b.system_prompt:
        console.print()


def print_initial_message(model: str, message: str):
    console.print(Rule(f"[bold yellow]INITIAL — Model A: {model}[/bold yellow]", style="bold yellow"))
    console.print(message)
    console.print()


def print_turn(turn: int, agent_name: str, model: str, content: str, cost_info: dict | None = None):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    console.print(Rule(f"[bold cyan]Turn {turn} — {agent_name}: {model}[/bold cyan]", style="bold cyan"))
    console.print(f"[dim][Captured {now}][/dim]")

    if cost_info and cost_info.get("total_cost", 0) > 0:
        console.print(f"[dim][Cost: ${cost_info['total_cost']:.6f}][/dim]")

    console.print(content)
    console.print()


def print_cost_summary(tracker: CostTracker):
    console.print()
    console.print(Rule("[bold green]Cost Summary[/bold green]", style="bold green"))

    table = Table(show_header=True, header_style="bold")
    table.add_column("Agent")
    table.add_column("Input Tokens", justify="right")
    table.add_column("Output Tokens", justify="right")
    table.add_column("Thinking Tokens", justify="right")
    table.add_column("Input Cost", justify="right")
    table.add_column("Output Cost", justify="right")
    table.add_column("Thinking Cost", justify="right")
    table.add_column("Total", justify="right")

    for name, data in tracker.per_agent.items():
        total = data["input_cost"] + data["output_cost"] + data["thinking_cost"]
        table.add_row(
            name,
            f"{data['input_tokens']:,}",
            f"{data['output_tokens']:,}",
            f"{data['thinking_tokens']:,}",
            f"${data['input_cost']:.6f}",
            f"${data['output_cost']:.6f}",
            f"${data['thinking_cost']:.6f}",
            f"[bold]${total:.6f}[/bold]",
        )

    t = tracker.totals
    grand = t["input_cost"] + t["output_cost"] + t["thinking_cost"]
    table.add_row(
        "[bold]Total[/bold]",
        f"[bold]{t['input_tokens']:,}[/bold]",
        f"[bold]{t['output_tokens']:,}[/bold]",
        f"[bold]{t['thinking_tokens']:,}[/bold]",
        f"[bold]${t['input_cost']:.6f}[/bold]",
        f"[bold]${t['output_cost']:.6f}[/bold]",
        f"[bold]${t['thinking_cost']:.6f}[/bold]",
        f"[bold green]${grand:.6f}[/bold green]",
        style="bold",
    )

    console.print(table)
    console.print()
