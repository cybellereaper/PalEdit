from pathlib import Path

import pytest


@pytest.fixture
def docs_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "docs"


def test_static_site_files_exist(docs_dir: Path):
    for name in ("index.html", "style.css", "app.js"):
        path = docs_dir / name
        assert path.exists(), f"Missing docs/{name}"


def test_index_is_pages_only(docs_dir: Path):
    content = (docs_dir / "index.html").read_text(encoding="utf-8")
    assert "GitHub Pages" in content
    assert "static" in content.lower()
    assert "SaveConverter" in content
    assert "JSON editor" in content


def test_app_js_has_editor_helpers(docs_dir: Path):
    script = (docs_dir / "app.js").read_text(encoding="utf-8")
    for keyword in ("lintJSON", "wireDropzone", "localStorage", "FALLBACK_FILENAME"):
        assert keyword in script


def test_styles_include_line_numbers(docs_dir: Path):
    style = (docs_dir / "style.css").read_text(encoding="utf-8")
    assert "#line-numbers" in style
    assert "editor-shell" in style
