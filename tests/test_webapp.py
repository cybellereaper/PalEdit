import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from palworld_pal_edit.webapp.server import create_app  # noqa: E402
from palworld_pal_edit.webapp.store import FileSessionStore  # noqa: E402


def _client(tmp_path: Path) -> TestClient:
    store = FileSessionStore(tmp_path / "sessions")
    app = create_app(store=store)
    return TestClient(app)


def test_index_renders(tmp_path):
    client = _client(tmp_path)
    response = client.get("/")
    assert response.status_code == 200
    assert "Edit Palworld saves" in response.text


def test_upload_and_edit_flow(tmp_path):
    client = _client(tmp_path)
    payload = {"hello": "world"}

    upload = client.post(
        "/upload",
        files={"file": ("sample.json", json.dumps(payload), "application/json")},
        follow_redirects=False,
    )
    assert upload.status_code == 303
    location = upload.headers["location"]
    session_id = Path(location).name

    edit_page = client.get(location)
    assert edit_page.status_code == 200
    assert "sample.json" in edit_page.text

    updated = {"hello": "paledit"}
    save_response = client.post(
        f"/edit/{session_id}",
        data={"json_body": json.dumps(updated)},
        follow_redirects=False,
    )
    assert save_response.status_code == 303

    download = client.get(f"/download/{session_id}?format=json")
    assert download.status_code == 200
    assert json.loads(download.content.decode()) == updated


def test_invalid_json_returns_error(tmp_path):
    client = _client(tmp_path)
    upload = client.post(
        "/upload",
        files={"file": ("broken.json", "{oops", "application/json")},
        follow_redirects=False,
    )
    assert upload.status_code == 400
