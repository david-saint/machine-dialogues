"""Family-bias analysis over judgments: net-round shift vs. family interest.

Every judgment of a debate between two model families is placed in "family
space": the net round share toward the alphabetically-first family of the
pair. Judge interest is encoded the same way (+1 when the judge belongs to
that family, -1 for the opposing family, 0 for a neutral family), which makes
the bias the dependent variable: the OLS slope of shift-vs-interest is the
family-interest gradient, and the intercept is the panel-wide lean.

Mirror debates (both debaters from one family) carry no family contrast and
are excluded from the family regression, but still contribute to the
position-bias measurement (share of rounds toward the first speaker).
"""

import json
import math
from datetime import date
from pathlib import Path

from .judge import _TURN_HEADER_RE
from .panel import model_family

ANALYSIS_SCHEMA_VERSION = 1

WINNER_SIGN = {"agentA": 1, "agentB": -1, "draw": 0, "even": 0}


# --------------------------------------------------------------------------
# Inputs
# --------------------------------------------------------------------------

def parse_transcript_debaters(text: str) -> tuple[dict, dict]:
    """Return ({name, model, family} for agentA, same for agentB).

    Mirrors judge.parse_transcript_agents' seat assignment (first Turn-1
    speaker is agentA) but keeps the model id so the family can be derived.
    """
    turns = _TURN_HEADER_RE.findall(text)  # (num, name, model)
    turn1 = [(name, model) for num, name, model in turns if int(num) == 1]
    if len(turn1) < 2:
        raise ValueError("Transcript does not contain two Turn 1 entries")

    def debater(name: str, model: str) -> dict:
        model = model.strip()
        return {"name": name.strip(), "model": model, "family": model_family(model)}

    return debater(*turn1[0]), debater(*turn1[1])


def load_judgments(judgments_dir: str | Path) -> list[dict]:
    """All live judgment objects under judgments/<stem>/*.json (archive excluded)."""
    judgments = []
    root = Path(judgments_dir)
    for subdir in sorted(p for p in root.iterdir() if p.is_dir() and p.name != "archive"):
        for f in sorted(subdir.glob("*.json")):
            judgments.append(json.loads(f.read_text()))
    return judgments


# --------------------------------------------------------------------------
# Per-judgment measurements
# --------------------------------------------------------------------------

def judgment_point(judgment: dict, agent_a: dict, agent_b: dict) -> dict:
    """One observation: this judge's shifts on this debate.

    All *_shift values are oriented toward the alphabetically-first family of
    the debate pair (positive = toward that family); position_first_share is
    oriented toward the first speaker (agentA).
    """
    rounds = judgment["rounds"]
    n = len(rounds)
    net_a = sum(WINNER_SIGN[r["winner"]] for r in rounds)  # rounds toward agentA

    judge = judgment["judge"]
    judge_family = judge.get("family") or model_family(judge.get("model", ""))

    fam_a, fam_b = agent_a["family"], agent_b["family"]
    point = {
        "transcript": judgment["transcript"],
        "judge": judge.get("name"),
        "judge_family": judge_family,
        "rounds_scored": n,
        "position_first_share": net_a / n if n else 0.0,
    }

    if fam_a == fam_b:
        return point  # mirror debate: no family contrast

    first_family = min(fam_a, fam_b)
    sign = 1 if fam_a == first_family else -1  # toward-agentA -> toward-first-family
    decision = judgment["decision"]

    point.update(
        pair=sorted([fam_a, fam_b]),
        interest=(1 if judge_family == first_family else -1 if judge_family in (fam_a, fam_b) else 0),
        net_round_shift=sign * net_a / n if n else 0.0,
        resolution_shift=sign * WINNER_SIGN[decision["resolution_winner"]],
        craft_shift=sign * WINNER_SIGN[decision["craft_winner"]],
    )
    return point


# --------------------------------------------------------------------------
# OLS
# --------------------------------------------------------------------------

def ols(xs: list[float], ys: list[float]) -> dict | None:
    """Slope/intercept/r²/se/t for y = a + b·x. None when x has no variance."""
    n = len(xs)
    if n < 2:
        return None
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    sxx = sum((x - x_mean) ** 2 for x in xs)
    if sxx == 0:
        return None
    sxy = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    slope = sxy / sxx
    intercept = y_mean - slope * x_mean

    sse = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, ys))
    sst = sum((y - y_mean) ** 2 for y in ys)
    r_squared = 1.0 - sse / sst if sst else 1.0

    se_slope = t_slope = None
    if n > 2:
        sigma2 = sse / (n - 2)
        se_slope = math.sqrt(sigma2 / sxx)
        t_slope = slope / se_slope if se_slope else None

    return {
        "n": n,
        "slope": slope,
        "intercept": intercept,
        "r_squared": r_squared,
        "se_slope": se_slope,
        "t_slope": t_slope,
    }


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------

SHIFT_METRICS = ("net_round_shift", "resolution_shift", "craft_shift")


def analyze(judgments_dir: str | Path, transcripts_dir: str | Path, today: str | None = None) -> dict:
    judgments = load_judgments(judgments_dir)

    debates: dict[str, tuple[dict, dict]] = {}
    points = []
    for judgment in judgments:
        basename = judgment["transcript"]
        if basename not in debates:
            text = (Path(transcripts_dir) / basename).read_text()
            debates[basename] = parse_transcript_debaters(text)
        agent_a, agent_b = debates[basename]
        points.append(judgment_point(judgment, agent_a, agent_b))

    contrast = [p for p in points if "interest" in p]

    regressions = {
        metric: ols([p["interest"] for p in contrast], [p[metric] for p in contrast])
        for metric in SHIFT_METRICS
    }

    # One row per judge *family* (the panel seats one judge per family, but the
    # model filling a seat can change between runs, so a row may aggregate
    # several judge names — all of them are listed in the label).
    judges: dict[str, dict] = {}
    for p in points:
        j = judges.setdefault(
            p["judge_family"],
            {"family": p["judge_family"], "judge_names": [], "contrast_points": 0, "position_points": 0},
        )
        if p["judge"] not in j["judge_names"]:
            j["judge_names"].append(p["judge"])
        j["position_points"] += 1
        j["_position"] = j.get("_position", 0.0) + p["position_first_share"]
        if "interest" in p:
            j["contrast_points"] += 1
            # Interest is per debate; a family's row may mix interested and
            # neutral points. Keep the non-zero value if the family was ever an
            # interested party, so the viewer flags it as such.
            if p["interest"] != 0 or "interest" not in j:
                j["interest"] = p["interest"]
            for metric in SHIFT_METRICS:
                j[f"_{metric}"] = j.get(f"_{metric}", 0.0) + p[metric]

    for j in judges.values():
        j["judge"] = " / ".join(j["judge_names"])
        j["mean_position_first_share"] = j.pop("_position") / j["position_points"]
        for metric in SHIFT_METRICS:
            total = j.pop(f"_{metric}", None)
            if total is not None:
                j[f"mean_{metric}"] = total / j["contrast_points"]

    return {
        "schema_version": ANALYSIS_SCHEMA_VERSION,
        "generated_at": today or date.today().isoformat(),
        "n_judgments": len(judgments),
        "debates": [
            {"transcript": t, "agentA": a, "agentB": b}
            for t, (a, b) in sorted(debates.items())
        ],
        "points": points,
        "judges": sorted(judges.values(), key=lambda j: j["family"]),
        "regressions": regressions,
    }


def write_analysis(
    judgments_dir: str | Path = "judgments",
    transcripts_dir: str | Path = "transcripts",
    output_path: str | Path = Path("judgments") / "analysis.json",
    today: str | None = None,
) -> Path:
    result = analyze(judgments_dir, transcripts_dir, today=today)
    output_path = Path(output_path)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    return output_path
