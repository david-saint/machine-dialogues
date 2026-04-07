"""Tests for dynamic turn counter and pacing enforcement."""

import pytest

from research_harness.config import ExperimentConfig
from research_harness.providers.mock_provider import MockProvider
from research_harness.runner import run_experiment


def make_mock_config(turns: int = 3) -> ExperimentConfig:
    return ExperimentConfig(
        agent_a={
            "name": "MockA",
            "provider": "mock",
            "model": "mock-model-a",
            "system_prompt": "You are Agent A.",
            "temperature": 0.0,
            "max_tokens": 100,
        },
        agent_b={
            "name": "MockB",
            "provider": "mock",
            "model": "mock-model-b",
            "system_prompt": "You are Agent B.",
            "temperature": 0.0,
            "max_tokens": 100,
        },
        turns=turns,
        initial_message="Begin the debate.",
    )


class TestSetTurnInfo:
    def test_turn_number_in_suffix(self):
        p = MockProvider(model="test", system_prompt="Base prompt.", temperature=0, max_tokens=100)
        p.set_turn_info(3, 20)
        prompt = p.get_system_prompt()
        assert "TURN 3 OF 20" in prompt

    def test_suffix_updates_each_call(self):
        p = MockProvider(model="test", system_prompt="Base prompt.", temperature=0, max_tokens=100)
        p.set_turn_info(1, 10)
        assert "TURN 1 OF 10" in p.get_system_prompt()
        p.set_turn_info(5, 10)
        assert "TURN 5 OF 10" in p.get_system_prompt()
        assert "TURN 1 OF" not in p.get_system_prompt()

    def test_no_suffix_by_default(self):
        p = MockProvider(model="test", system_prompt="Base prompt.", temperature=0, max_tokens=100)
        assert p.get_system_prompt() == "Base prompt."


class TestPacingEnforcement:
    """Verify that the turn counter enforces pacing rules correctly."""

    def test_early_turns_forbid_closing(self):
        """Turns before the closing threshold must tell the model NOT to close."""
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        # For 20 turns, closing_threshold = 18. Turns 1-17 should forbid closing.
        for turn in range(1, 18):
            p.set_turn_info(turn, 20)
            prompt = p.get_system_prompt()
            assert "DO NOT deliver closing" in prompt, f"Turn {turn}/20 should forbid closing"
            assert "Stay adversarial" in prompt, f"Turn {turn}/20 should demand adversarial stance"
            assert "NEW arguments" in prompt, f"Turn {turn}/20 should demand new arguments"

    def test_closing_threshold_turn_permits_closing(self):
        """The first closing-eligible turn should say MAY begin closing."""
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        p.set_turn_info(18, 20)
        prompt = p.get_system_prompt()
        assert "MAY begin your closing" in prompt

    def test_final_turns_encourage_closing(self):
        """Turns after the threshold should prompt for closing."""
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        for turn in [19, 20]:
            p.set_turn_info(turn, 20)
            prompt = p.get_system_prompt()
            assert "FINAL turns" in prompt, f"Turn {turn}/20 should signal final turns"
            assert "closing statement" in prompt

    def test_remaining_turns_count_accurate(self):
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        p.set_turn_info(5, 20)
        assert "15 turns remaining" in p.get_system_prompt()
        p.set_turn_info(17, 20)
        assert "3 turns remaining" in p.get_system_prompt()

    def test_pacing_with_small_turn_count(self):
        """Even with 3 turns, closing_threshold = 1, so turn 1 is the first closing-eligible turn."""
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        p.set_turn_info(1, 3)
        prompt = p.get_system_prompt()
        assert "MAY begin your closing" in prompt

    def test_pacing_with_10_turns(self):
        """With 10 turns, closing_threshold = 8. Turns 1-7 forbid, 8 permits, 9-10 encourage."""
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        for turn in range(1, 8):
            p.set_turn_info(turn, 10)
            assert "DO NOT deliver closing" in p.get_system_prompt(), f"Turn {turn}/10 should forbid"
        p.set_turn_info(8, 10)
        assert "MAY begin your closing" in p.get_system_prompt()
        for turn in [9, 10]:
            p.set_turn_info(turn, 10)
            assert "FINAL turns" in p.get_system_prompt()


class TestMockProviderCapturesPrompts:
    def test_captures_system_prompt_per_call(self):
        p = MockProvider(model="test", system_prompt="Base.", temperature=0, max_tokens=100)
        p.set_turn_info(1, 5)
        p.send([{"role": "user", "content": "hi"}])
        p.set_turn_info(2, 5)
        p.send([{"role": "user", "content": "hi again"}])

        assert len(p.captured_system_prompts) == 2
        assert "TURN 1 OF 5" in p.captured_system_prompts[0]
        assert "TURN 2 OF 5" in p.captured_system_prompts[1]


class TestRunExperimentWithMock:
    def _capture_providers(self, monkeypatch):
        providers = {}
        original_create = __import__("research_harness.providers", fromlist=["create_provider"]).create_provider

        def capture_create(**kwargs):
            p = original_create(**kwargs)
            providers.setdefault(kwargs["model"], p)
            return p

        monkeypatch.setattr("research_harness.runner.create_provider", capture_create)
        return providers

    def test_completes_all_turns(self, monkeypatch):
        config = make_mock_config(turns=3)
        providers = self._capture_providers(monkeypatch)
        run_experiment(config)

        assert providers["mock-model-a"].call_count == 3
        assert providers["mock-model-b"].call_count == 3

    def test_turn_counter_injected_correctly(self, monkeypatch):
        config = make_mock_config(turns=5)
        providers = self._capture_providers(monkeypatch)
        run_experiment(config)

        pa = providers["mock-model-a"]
        pb = providers["mock-model-b"]

        for i, prompt in enumerate(pa.captured_system_prompts, 1):
            assert f"TURN {i} OF 5" in prompt, f"Agent A call {i}: expected 'TURN {i} OF 5'"

        for i, prompt in enumerate(pb.captured_system_prompts, 1):
            assert f"TURN {i} OF 5" in prompt, f"Agent B call {i}: expected 'TURN {i} OF 5'"

    def test_pacing_enforced_across_full_run(self, monkeypatch):
        """With 20 turns, verify turns 1-17 forbid closing, 18 permits, 19-20 encourage."""
        config = make_mock_config(turns=20)
        providers = self._capture_providers(monkeypatch)
        run_experiment(config)

        for agent_key in ["mock-model-a", "mock-model-b"]:
            prompts = providers[agent_key].captured_system_prompts
            assert len(prompts) == 20, f"{agent_key} should have 20 captured prompts"

            # Turns 1-17: must forbid closing
            for i in range(17):
                assert "DO NOT deliver closing" in prompts[i], (
                    f"{agent_key} turn {i+1}/20: should forbid closing"
                )

            # Turn 18: must permit closing
            assert "MAY begin your closing" in prompts[17], (
                f"{agent_key} turn 18/20: should permit closing"
            )

            # Turns 19-20: must encourage closing
            for i in [18, 19]:
                assert "FINAL turns" in prompts[i], (
                    f"{agent_key} turn {i+1}/20: should signal final turns"
                )

    def test_base_prompt_preserved(self, monkeypatch):
        config = make_mock_config(turns=2)
        providers = self._capture_providers(monkeypatch)
        run_experiment(config)

        for prompt in providers["mock-model-a"].captured_system_prompts:
            assert prompt.startswith("You are Agent A.")
