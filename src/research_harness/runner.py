import signal
import sys
from datetime import datetime, timezone

from .config import ExperimentConfig
from .providers import create_provider
from .pricing import CostTracker, load_pricing
from .formatter import print_header, print_initial_message, print_turn, print_cost_summary, console
from .transcript import save_transcript, parse_transcript, rebuild_histories


def run_experiment(config: ExperimentConfig):
    pricing_data = load_pricing()
    tracker = CostTracker(pricing=pricing_data)

    provider_a = create_provider(
        provider=config.agent_a.provider,
        model=config.agent_a.model,
        system_prompt=config.agent_a.system_prompt,
        temperature=config.agent_a.temperature,
        max_tokens=config.agent_a.max_tokens,
        no_thinking=config.agent_a.no_thinking,
        google_search=config.agent_a.google_search,
    )
    provider_b = create_provider(
        provider=config.agent_b.provider,
        model=config.agent_b.model,
        system_prompt=config.agent_b.system_prompt,
        temperature=config.agent_b.temperature,
        max_tokens=config.agent_b.max_tokens,
        no_thinking=config.agent_b.no_thinking,
        google_search=config.agent_b.google_search,
    )

    print_header(config, pricing_enabled=bool(pricing_data))

    history_a: list[dict] = []
    history_b: list[dict] = []
    entries: list[dict] = []
    current_message = config.initial_message

    print_initial_message(config.agent_a.model, current_message)
    entries.append({
        "label": f"INITIAL — {config.agent_a.name}: {config.agent_a.model}",
        "content": current_message,
        "timestamp": None,
    })

    interrupted = False

    def handle_interrupt(sig, frame):
        nonlocal interrupted
        interrupted = True
        console.print("\n[bold red]Interrupted! Saving partial transcript...[/bold red]")

    original_handler = signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGINT, handle_interrupt)

    try:
        for turn in range(1, config.turns + 1):
            if interrupted:
                break

            # Agent A responds
            history_a.append({"role": "user", "content": current_message})
            try:
                response_a = provider_a.send(history_a)
            except Exception as e:
                console.print(f"[bold red]Error from {config.agent_a.name}: {e}[/bold red]")
                break

            content_a = response_a.content or "[empty response]"
            history_a.append({"role": "assistant", "content": content_a})
            cost_a = tracker.add(
                config.agent_a.name, config.agent_a.model,
                response_a.input_tokens, response_a.output_tokens, response_a.thinking_tokens,
            )
            ts_a = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print_turn(turn, config.agent_a.name, config.agent_a.model, content_a, cost_a)
            entries.append({
                "label": f"Turn {turn} — {config.agent_a.name}: {config.agent_a.model}",
                "content": content_a,
                "timestamp": ts_a,
            })

            if interrupted:
                break

            # Agent B responds
            history_b.append({"role": "user", "content": content_a})
            try:
                response_b = provider_b.send(history_b)
            except Exception as e:
                console.print(f"[bold red]Error from {config.agent_b.name}: {e}[/bold red]")
                break

            content_b = response_b.content or "[empty response]"
            history_b.append({"role": "assistant", "content": content_b})
            cost_b = tracker.add(
                config.agent_b.name, config.agent_b.model,
                response_b.input_tokens, response_b.output_tokens, response_b.thinking_tokens,
            )
            ts_b = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print_turn(turn, config.agent_b.name, config.agent_b.model, content_b, cost_b)
            entries.append({
                "label": f"Turn {turn} — {config.agent_b.name}: {config.agent_b.model}",
                "content": content_b,
                "timestamp": ts_b,
            })

            current_message = content_b
    finally:
        signal.signal(signal.SIGINT, original_handler)

    print_cost_summary(tracker)

    transcript_path = save_transcript(config, entries, tracker)
    console.print(f"[bold green]Transcript saved:[/bold green] {transcript_path}")
    console.print()


def resume_experiment(config: ExperimentConfig, transcript_path: str, additional_turns: int = 1):
    pricing_data = load_pricing()
    tracker = CostTracker(pricing=pricing_data)

    entries = parse_transcript(transcript_path)
    if len(entries) < 1:
        raise ValueError("Transcript has no entries")

    history_a, history_b, current_message, last_turn = rebuild_histories(entries)

    # Detect incomplete last turn (Agent A responded but B didn't)
    agent_entries = len(entries) - 1
    last_turn_complete = agent_entries % 2 == 0

    console.print(f"[bold]Resuming from turn {last_turn}[/bold] ({len(entries)} entries loaded)")
    console.print(f"[bold]Running {additional_turns} additional turn(s)[/bold]")
    console.print()

    provider_a = create_provider(
        provider=config.agent_a.provider,
        model=config.agent_a.model,
        system_prompt=config.agent_a.system_prompt,
        temperature=config.agent_a.temperature,
        max_tokens=config.agent_a.max_tokens,
        no_thinking=config.agent_a.no_thinking,
        google_search=config.agent_a.google_search,
    )
    provider_b = create_provider(
        provider=config.agent_b.provider,
        model=config.agent_b.model,
        system_prompt=config.agent_b.system_prompt,
        temperature=config.agent_b.temperature,
        max_tokens=config.agent_b.max_tokens,
        no_thinking=config.agent_b.no_thinking,
        google_search=config.agent_b.google_search,
    )

    print_header(config, pricing_enabled=bool(pricing_data))

    interrupted = False

    def handle_interrupt(sig, frame):
        nonlocal interrupted
        interrupted = True
        console.print("\n[bold red]Interrupted! Saving partial transcript...[/bold red]")

    original_handler = signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGINT, handle_interrupt)

    start_turn = last_turn + 1

    try:
        # Handle incomplete last turn — Agent B still needs to respond
        if not last_turn_complete and not interrupted:
            history_b.append({"role": "user", "content": current_message})
            try:
                response_b = provider_b.send(history_b)
            except Exception as e:
                console.print(f"[bold red]Error from {config.agent_b.name}: {e}[/bold red]")
                return

            content_b = response_b.content or "[empty response]"
            history_b.append({"role": "assistant", "content": content_b})
            cost_b = tracker.add(
                config.agent_b.name, config.agent_b.model,
                response_b.input_tokens, response_b.output_tokens, response_b.thinking_tokens,
            )
            ts_b = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print_turn(last_turn, config.agent_b.name, config.agent_b.model, content_b, cost_b)
            entries.append({
                "label": f"Turn {last_turn} — {config.agent_b.name}: {config.agent_b.model}",
                "content": content_b,
                "timestamp": ts_b,
            })
            current_message = content_b

        for turn in range(start_turn, start_turn + additional_turns):
            if interrupted:
                break

            # Agent A responds
            history_a.append({"role": "user", "content": current_message})
            try:
                response_a = provider_a.send(history_a)
            except Exception as e:
                console.print(f"[bold red]Error from {config.agent_a.name}: {e}[/bold red]")
                break

            content_a = response_a.content or "[empty response]"
            history_a.append({"role": "assistant", "content": content_a})
            cost_a = tracker.add(
                config.agent_a.name, config.agent_a.model,
                response_a.input_tokens, response_a.output_tokens, response_a.thinking_tokens,
            )
            ts_a = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print_turn(turn, config.agent_a.name, config.agent_a.model, content_a, cost_a)
            entries.append({
                "label": f"Turn {turn} — {config.agent_a.name}: {config.agent_a.model}",
                "content": content_a,
                "timestamp": ts_a,
            })

            if interrupted:
                break

            # Agent B responds
            history_b.append({"role": "user", "content": content_a})
            try:
                response_b = provider_b.send(history_b)
            except Exception as e:
                console.print(f"[bold red]Error from {config.agent_b.name}: {e}[/bold red]")
                break

            content_b = response_b.content or "[empty response]"
            history_b.append({"role": "assistant", "content": content_b})
            cost_b = tracker.add(
                config.agent_b.name, config.agent_b.model,
                response_b.input_tokens, response_b.output_tokens, response_b.thinking_tokens,
            )
            ts_b = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            print_turn(turn, config.agent_b.name, config.agent_b.model, content_b, cost_b)
            entries.append({
                "label": f"Turn {turn} — {config.agent_b.name}: {config.agent_b.model}",
                "content": content_b,
                "timestamp": ts_b,
            })

            current_message = content_b
    finally:
        signal.signal(signal.SIGINT, original_handler)

    print_cost_summary(tracker)

    config.turns = last_turn + additional_turns
    new_transcript_path = save_transcript(config, entries, tracker)
    console.print(f"[bold green]Transcript saved:[/bold green] {new_transcript_path}")
    console.print()
