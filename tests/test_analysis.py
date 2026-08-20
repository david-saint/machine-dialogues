"""Tests for the family-bias analysis (no live API calls)."""

import json

import pytest

from research_harness.analysis import analyze, judgment_point, ols, parse_transcript_debaters

D1 = "20260704_201301_claude-opus-4.8_vs_gpt-5.5.md"     # anthropic speaks first
D2 = "20260705_114732_gpt-5.5_vs_claude-opus-4.8.md"     # openai speaks first
MIRROR = "20260315_122637_claude-opus-4.6_vs_claude-opus-4.6.md"

TRANSCRIPTS = {
    D1: (
        "### Turn 1 — Claude Opus 4.8: anthropic/claude-opus-4.8\n\nA.\n\n"
        "### Turn 1 — GPT-5.5: openai/gpt-5.5\n\nB.\n"
    ),
    D2: (
        "### Turn 1 — GPT-5.5: openai/gpt-5.5\n\nA.\n\n"
        "### Turn 1 — Claude Opus 4.8: anthropic/claude-opus-4.8\n\nB.\n"
    ),
    MIRROR: (
        "### Turn 1 — Claude Opus 4.6: anthropic/claude-opus-4.6\n\nA.\n\n"
        "### Turn 1 — Claude Opus 4.6: anthropic/claude-opus-4.6\n\nB.\n"
    ),
}

JUDGES = {
    "anthropic": ("Claude Fable 5", "anthropic/claude-fable-5"),
    "openai": ("GPT-5.5 Pro (extended)", "openai/gpt-5.5-pro"),
    "google": ("Gemini 3.1 Pro", "google/gemini-3.1-pro-preview"),
}


def _judgment(transcript, family, rounds_for_a, rounds_for_b, evens=0, resolution="draw", craft="draw"):
    name, model = JUDGES[family]
    winners = ["agentA"] * rounds_for_a + ["agentB"] * rounds_for_b + ["even"] * evens
    return {
        "schema_version": 2,
        "transcript": transcript,
        "judge": {"name": name, "model": model, "family": family, "judged_at": "2026-07-06"},
        "decision": {
            "resolution_winner": resolution,
            "resolution_reason": "r",
            "craft_winner": craft,
            "craft_reason": "c",
            "summary": "s",
        },
        "rounds": [{"round": i + 1, "winner": w, "reason": "x"} for i, w in enumerate(winners)],
        "tally": {
            "agentA": rounds_for_a,
            "agentB": rounds_for_b,
            "even": evens,
        },
    }


def _write_corpus(tmp_path, judgments):
    tdir = tmp_path / "transcripts"
    tdir.mkdir()
    for basename, text in TRANSCRIPTS.items():
        (tdir / basename).write_text(text)

    jdir = tmp_path / "judgments"
    jdir.mkdir()
    for i, j in enumerate(judgments):
        out = jdir / j["transcript"].removesuffix(".md") / f"judge-{i}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(j))
    return jdir, tdir


class TestParseDebaters:
    def test_families_from_model_ids(self, tmp_path):
        a, b = parse_transcript_debaters(TRANSCRIPTS[D1])
        assert (a["family"], b["family"]) == ("anthropic", "openai")
        assert a["model"] == "anthropic/claude-opus-4.8"

    def test_mirror_families_match(self):
        a, b = parse_transcript_debaters(TRANSCRIPTS[MIRROR])
        assert a["family"] == b["family"] == "anthropic"


class TestJudgmentPoint:
    def test_orientation_flips_with_seating(self):
        a1, b1 = parse_transcript_debaters(TRANSCRIPTS[D1])
        a2, b2 = parse_transcript_debaters(TRANSCRIPTS[D2])
        # Same behavior — favor anthropic by 7-3 — from both seatings.
        p1 = judgment_point(_judgment(D1, "anthropic", 7, 3), a1, b1)
        p2 = judgment_point(_judgment(D2, "anthropic", 3, 7), a2, b2)
        assert p1["net_round_shift"] == pytest.approx(0.4)
        assert p2["net_round_shift"] == pytest.approx(0.4)
        # Position orientation does NOT flip: toward first speaker.
        assert p1["position_first_share"] == pytest.approx(0.4)
        assert p2["position_first_share"] == pytest.approx(-0.4)

    def test_interest_encoding(self):
        a, b = parse_transcript_debaters(TRANSCRIPTS[D1])
        assert judgment_point(_judgment(D1, "anthropic", 5, 5), a, b)["interest"] == 1
        assert judgment_point(_judgment(D1, "openai", 5, 5), a, b)["interest"] == -1
        assert judgment_point(_judgment(D1, "google", 5, 5), a, b)["interest"] == 0

    def test_decision_shifts(self):
        a, b = parse_transcript_debaters(TRANSCRIPTS[D2])  # openai in seat A
        p = judgment_point(_judgment(D2, "google", 5, 5, resolution="agentA", craft="agentB"), a, b)
        assert p["resolution_shift"] == -1  # toward openai = away from anthropic (first family)
        assert p["craft_shift"] == 1

    def test_mirror_has_no_family_contrast(self):
        a, b = parse_transcript_debaters(TRANSCRIPTS[MIRROR])
        p = judgment_point(_judgment(MIRROR, "anthropic", 6, 4), a, b)
        assert "interest" not in p and "net_round_shift" not in p
        assert p["position_first_share"] == pytest.approx(0.2)


class TestOls:
    def test_exact_fit(self):
        fit = ols([1, 1, -1, -1, 0, 0], [0.4, 0.4, -0.4, -0.4, 0.0, 0.0])
        assert fit["slope"] == pytest.approx(0.4)
        assert fit["intercept"] == pytest.approx(0.0)
        assert fit["r_squared"] == pytest.approx(1.0)

    def test_no_x_variance_returns_none(self):
        assert ols([1, 1, 1], [0.1, 0.2, 0.3]) is None


class TestAnalyze:
    def test_pure_family_bias_yields_slope(self, tmp_path):
        judgments = [
            _judgment(D1, "anthropic", 7, 3), _judgment(D2, "anthropic", 3, 7),
            _judgment(D1, "openai", 3, 7), _judgment(D2, "openai", 7, 3),
            _judgment(D1, "google", 5, 5), _judgment(D2, "google", 5, 5),
        ]
        jdir, tdir = _write_corpus(tmp_path, judgments)
        result = analyze(jdir, tdir, today="2026-07-06")

        fit = result["regressions"]["net_round_shift"]
        assert fit["slope"] == pytest.approx(0.4)
        assert fit["intercept"] == pytest.approx(0.0)
        assert fit["n"] == 6

        by_family = {j["family"]: j for j in result["judges"]}
        assert by_family["anthropic"]["mean_net_round_shift"] == pytest.approx(0.4)
        assert by_family["google"]["mean_net_round_shift"] == pytest.approx(0.0)
        # Position bias cancels across the order-swapped pair.
        assert by_family["anthropic"]["mean_position_first_share"] == pytest.approx(0.0)

    def test_pure_position_bias_yields_zero_slope(self, tmp_path):
        judgments = [
            _judgment(d, fam, 6, 4)
            for d in (D1, D2)
            for fam in ("anthropic", "openai", "google")
        ]
        jdir, tdir = _write_corpus(tmp_path, judgments)
        result = analyze(jdir, tdir, today="2026-07-06")

        assert result["regressions"]["net_round_shift"]["slope"] == pytest.approx(0.0)
        for j in result["judges"]:
            assert j["mean_position_first_share"] == pytest.approx(0.2)
            assert j["mean_net_round_shift"] == pytest.approx(0.0)

    def test_mirror_counts_for_position_only(self, tmp_path):
        judgments = [
            _judgment(D1, "anthropic", 5, 5), _judgment(D2, "anthropic", 5, 5),
            _judgment(MIRROR, "anthropic", 8, 2),
        ]
        jdir, tdir = _write_corpus(tmp_path, judgments)
        result = analyze(jdir, tdir, today="2026-07-06")

        j = result["judges"][0]
        assert j["contrast_points"] == 2
        assert j["position_points"] == 3
        assert j["mean_position_first_share"] == pytest.approx(0.2)

    def test_archive_is_excluded(self, tmp_path):
        jdir, tdir = _write_corpus(tmp_path, [_judgment(D1, "google", 5, 5)])
        stale = jdir / "archive" / "v1" / D1.removesuffix(".md") / "old.json"
        stale.parent.mkdir(parents=True)
        stale.write_text(json.dumps(_judgment(D1, "anthropic", 10, 0)))

        result = analyze(jdir, tdir, today="2026-07-06")
        assert result["n_judgments"] == 1
        assert result["points"][0]["judge_family"] == "google"

    def test_resolution_and_craft_regressions(self, tmp_path):
        judgments = [
            # Interested judges hand their own family both verdicts; neutral draws.
            _judgment(D1, "anthropic", 5, 5, resolution="agentA", craft="agentA"),
            _judgment(D2, "anthropic", 5, 5, resolution="agentB", craft="agentB"),
            _judgment(D1, "openai", 5, 5, resolution="agentB", craft="agentB"),
            _judgment(D2, "openai", 5, 5, resolution="agentA", craft="agentA"),
            _judgment(D1, "google", 5, 5), _judgment(D2, "google", 5, 5),
        ]
        jdir, tdir = _write_corpus(tmp_path, judgments)
        result = analyze(jdir, tdir, today="2026-07-06")

        for metric in ("resolution_shift", "craft_shift"):
            fit = result["regressions"][metric]
            assert fit["slope"] == pytest.approx(1.0)
            assert fit["intercept"] == pytest.approx(0.0)

    def test_family_row_lists_every_judge_that_filled_the_seat(self, tmp_path):
        # The panel seats one judge per family, but the model in a seat can
        # change between runs; the family row must name all of them.
        old = _judgment(D1, "google", 5, 5)
        new = _judgment(D2, "google", 5, 5)
        old["judge"].update(name="Gemini 3.1 Pro", model="google/gemini-3.1-pro-preview")
        new["judge"].update(name="Gemini 3.7 Flash", model="google/gemini-3.7-flash")
        jdir, tdir = _write_corpus(tmp_path, [old, new, _judgment(D1, "anthropic", 5, 5)])
        result = analyze(jdir, tdir, today="2026-07-06")

        by_family = {j["family"]: j for j in result["judges"]}
        assert by_family["google"]["judge"] == "Gemini 3.1 Pro / Gemini 3.7 Flash"
        assert by_family["google"]["judge_names"] == ["Gemini 3.1 Pro", "Gemini 3.7 Flash"]
        assert by_family["anthropic"]["judge"] == "Claude Fable 5"
        assert by_family["anthropic"]["judge_names"] == ["Claude Fable 5"]

