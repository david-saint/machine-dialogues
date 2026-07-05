import pytest


@pytest.fixture(autouse=True)
def _redirect_transcripts_dir(monkeypatch, tmp_path):
    """Keep test runs from writing mock transcripts into the real transcripts/
    directory (which the viewer publishes)."""
    monkeypatch.setattr("research_harness.transcript.TRANSCRIPTS_DIR", tmp_path)
