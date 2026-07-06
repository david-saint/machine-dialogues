"""Tests for the judge panel runner (no live API calls)."""

import json
from pathlib import Path

import pytest

from research_harness import panel as panel_mod
from research_harness.panel import load_panel, model_family, run_panel


def _write_panel(tmp_path, judges) -> Path:
    p = tmp_path / "panel.json"
    p.write_text(json.dumps({"judges": judges}))
    return p


PANEL = [
    {"family": "anthropic", "name": "Claude Fable 5", "model": "anthropic/claude-fable-5", "thinking_level": "xhigh"},
    {"family": "moonshot", "name": "Kimi K2.6", "model": "moonshotai/kimi-k2.6"},
]


class TestModelFamily:
    def test_vendor_prefix(self):
        assert model_family("anthropic/claude-opus-4.8") == "anthropic"
        assert model_family("openai/gpt-5.5") == "openai"

    def test_vendor_aliases(self):
        assert model_family("moonshotai/kimi-k2.6") == "moonshot"
        assert model_family("x-ai/grok-4.3") == "xai"

    def test_bare_model_id(self):
        assert model_family("claude-fable-5") == "claude-fable-5"


class TestLoadPanel:
    def test_loads_repo_panel_one_vote_per_family(self):
        # The checked-in panel must satisfy its own invariant.
        judges = load_panel()
        families = [j["family"] for j in judges]
        assert len(families) == len(set(families))

    def test_duplicate_family_rejected(self, tmp_path):
        p = _write_panel(tmp_path, PANEL + [{"family": "anthropic", "name": "Opus", "model": "anthropic/claude-opus-4.8"}])
        with pytest.raises(ValueError, match="one-vote-per-family"):
            load_panel(p)

    def test_missing_key_rejected(self, tmp_path):
        p = _write_panel(tmp_path, [{"family": "xai", "name": "Grok 4.3"}])
        with pytest.raises(ValueError, match="model"):
            load_panel(p)


class TestRunPanel:
    def _stub_run_judge(self, monkeypatch, fail_for=()):
        calls = []

        def fake_run_judge(**kwargs):
            calls.append(kwargs)
            if kwargs["judge_name"] in fail_for:
                raise RuntimeError("boom")
            out = panel_mod.judgment_output_path(
                kwargs["output_dir"], Path(kwargs["transcript_path"]).name, panel_mod.slugify(kwargs["judge_name"])
            )
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text("{}")
            return out

        monkeypatch.setattr(panel_mod, "run_judge", fake_run_judge)
        return calls

    def test_runs_every_judge_and_stamps_family(self, tmp_path, monkeypatch):
        calls = self._stub_run_judge(monkeypatch)
        panel_path = _write_panel(tmp_path, PANEL)
        t = tmp_path / "20260704_a_vs_b.md"
        t.write_text("### Turn 1 — A: x\n### Turn 1 — B: y\n")

        results = run_panel([t], output_dir=tmp_path / "judgments", panel_path=panel_path)

        assert [r["status"] for r in results] == ["ok", "ok"]
        assert [c["judge_family"] for c in calls] == ["anthropic", "moonshot"]
        assert calls[0]["thinking_level"] == "xhigh"
        assert calls[1]["thinking_level"] is None

    def test_skips_existing_judgment_unless_forced(self, tmp_path, monkeypatch):
        calls = self._stub_run_judge(monkeypatch)
        panel_path = _write_panel(tmp_path, PANEL)
        t = tmp_path / "20260704_a_vs_b.md"
        t.write_text("### Turn 1 — A: x\n### Turn 1 — B: y\n")
        out_dir = tmp_path / "judgments"

        existing = out_dir / "20260704_a_vs_b" / "claude-fable-5.json"
        existing.parent.mkdir(parents=True)
        existing.write_text("{}")

        results = run_panel([t], output_dir=out_dir, panel_path=panel_path)
        assert [r["status"] for r in results] == ["skipped", "ok"]
        assert len(calls) == 1  # only Kimi ran

        results = run_panel([t], output_dir=out_dir, panel_path=panel_path, force=True)
        assert [r["status"] for r in results] == ["ok", "ok"]

    def test_one_failure_does_not_abort_matrix(self, tmp_path, monkeypatch):
        self._stub_run_judge(monkeypatch, fail_for={"Claude Fable 5"})
        panel_path = _write_panel(tmp_path, PANEL)
        t = tmp_path / "20260704_a_vs_b.md"
        t.write_text("### Turn 1 — A: x\n### Turn 1 — B: y\n")

        results = run_panel([t], output_dir=tmp_path / "judgments", panel_path=panel_path)
        assert [r["status"] for r in results] == ["error", "ok"]
        assert "RuntimeError: boom" in results[0]["detail"]
