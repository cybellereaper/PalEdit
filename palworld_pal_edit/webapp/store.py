from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional


@dataclass
class SessionData:
    """In-memory representation of a stored editing session."""

    session_id: str
    json_text: str
    source_format: str
    filename: str


class FileSessionStore:
    """
    A very small file-backed session store for uploaded save data.

    Sessions are written as JSON files to keep storage simple and avoid any
    custom serialization. The class is threadsafe so the FastAPI app can
    safely reuse an instance.
    """

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self._lock = threading.Lock()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, session_id: str) -> Path:
        return self.base_dir / f"{session_id}.json"

    def write(self, session: SessionData) -> None:
        with self._lock:
            with self._path_for(session.session_id).open("w", encoding="utf-8") as f:
                json.dump(session.__dict__, f, ensure_ascii=False, indent=2)

    def read(self, session_id: str) -> Optional[SessionData]:
        path = self._path_for(session_id)
        if not path.exists():
            return None
        with self._lock:
            with path.open("r", encoding="utf-8") as f:
                payload: Dict[str, str] = json.load(f)
        return SessionData(**payload)

    def update_json(self, session_id: str, json_text: str) -> SessionData:
        session = self.read(session_id)
        if not session:
            raise KeyError(f"Session '{session_id}' not found")
        session.json_text = json_text
        self.write(session)
        return session
