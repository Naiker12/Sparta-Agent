from __future__ import annotations

from utils import release_notes


def test_release_notes_are_fetched_from_sparta_agent() -> None:
    assert release_notes.RELEASES_API_URL.startswith(
        "https://api.github.com/repos/Naiker12/Sparta-Agent/"
    )


def test_popup_uses_notes_for_the_offered_version(monkeypatch) -> None:
    release_notes.reset_release_notes_cache()
    monkeypatch.setattr(
        release_notes,
        "get_latest_release",
        lambda refresh = False: release_notes.ReleaseSource(
            release = release_notes.Release(
                tag = "v0.5.1",
                name = "Sparta Agent 0.5.1",
                body = "## Correcciones\n\n- Notas correctas.",
                html_url = "https://github.com/Naiker12/Sparta-Agent/releases/tag/v0.5.1",
                published_at = "2026-10-21T00:00:00Z",
            ),
            source = "github",
        ),
    )

    notes = release_notes.get_release_notes("0.5.1")

    assert notes["matched"] is True
    assert notes["tag"] == "v0.5.1"
    assert notes["markdown"] == "## Correcciones\n\n- Notas correctas."


def test_popup_does_not_substitute_another_version(monkeypatch) -> None:
    release_notes.reset_release_notes_cache()
    monkeypatch.setattr(
        release_notes,
        "get_latest_release",
        lambda refresh = False: release_notes.ReleaseSource(
            release = release_notes.Release(
                tag = "v9.9.9",
                name = "Other release",
                body = "- Unrelated notes.",
                html_url = "https://github.com/Naiker12/Sparta-Agent/releases/tag/v9.9.9",
                published_at = "2026-10-21T00:00:00Z",
            ),
            source = "github",
        ),
    )

    notes = release_notes.get_release_notes("0.5.1")

    assert notes["matched"] is False
    assert notes["markdown"] is None
    assert notes["tag"] is None
