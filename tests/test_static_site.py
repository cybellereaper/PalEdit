from pathlib import Path

import pytest


@pytest.fixture
def docs_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "docs"


def test_static_site_files_exist(docs_dir: Path):
    for name in ("index.html", "style.css", "app.js"):
        path = docs_dir / name
        assert path.exists(), f"Missing docs/{name}"


def test_index_mentions_github_pages(docs_dir: Path):
    content = (docs_dir / "index.html").read_text(encoding="utf-8")
    assert "GitHub Pages" in content
    assert "Pyodide" in content
    assert "Palworld save JSON" in content


def test_app_js_has_validation(docs_dir: Path):
    script = (docs_dir / "app.js").read_text(encoding="utf-8")
    assert "prettyPrintJSON" in script
    assert "downloadBtn" in script
    assert "palworld-save-tools" in script
    assert "_sav_bytes_to_json_text" in script
