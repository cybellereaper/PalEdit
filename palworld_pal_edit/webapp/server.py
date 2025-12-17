from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from palworld_pal_edit.SaveConverter import (
    json_text_to_sav_bytes,
    sav_bytes_to_json_text,
)
from palworld_pal_edit.webapp.store import FileSessionStore, SessionData


def create_app(store: Optional[FileSessionStore] = None) -> FastAPI:
    base_dir = Path(__file__).resolve().parent
    session_store = store or FileSessionStore(base_dir / "sessions")

    app = FastAPI(title="PalEdit Web")
    app.state.store = session_store

    templates = Jinja2Templates(directory=str(base_dir / "templates"))
    static_dir = base_dir / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request):
        return templates.TemplateResponse(
            request,
            "index.html",
            {},
        )

    @app.post("/upload")
    async def upload(request: Request, file: UploadFile = File(...)):
        content = await file.read()
        session_id = uuid.uuid4().hex
        suffix = Path(file.filename or "").suffix.lower()

        if suffix == ".sav":
            try:
                json_text = sav_bytes_to_json_text(content)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Failed to read save: {exc}")
            source_format = "sav"
        elif suffix == ".json":
            try:
                loaded = json.loads(content.decode("utf-8"))
                json_text = json.dumps(loaded, indent=2, ensure_ascii=False)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Invalid JSON upload: {exc}")
            source_format = "json"
        else:
            raise HTTPException(status_code=400, detail="Only .sav or .json files are supported")

        session = SessionData(
            session_id=session_id,
            json_text=json_text,
            source_format=source_format,
            filename=file.filename or f"session-{session_id}.json",
        )
        app.state.store.write(session)

        return RedirectResponse(
            url=f"/edit/{session_id}", status_code=303
        )

    @app.get("/edit/{session_id}", response_class=HTMLResponse)
    def edit(request: Request, session_id: str):
        session = app.state.store.read(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        line_count = len(session.json_text.splitlines())
        return templates.TemplateResponse(
            request,
            "edit.html",
            {
                "session": session,
                "line_numbers": [f"{i:3d}" for i in range(1, line_count + 1)],
                "line_count": line_count,
            },
        )

    @app.post("/edit/{session_id}")
    async def save(session_id: str, json_body: str = Form(...)):
        try:
            parsed = json.loads(json_body)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"JSON validation failed: {exc}")
        normalized = json.dumps(parsed, indent=2, ensure_ascii=False)
        try:
            session = app.state.store.update_json(session_id, normalized)
        except KeyError:
            raise HTTPException(status_code=404, detail="Session not found")
        return RedirectResponse(
            url=f"/edit/{session.session_id}?saved=1", status_code=303
        )

    @app.get("/download/{session_id}")
    def download(session_id: str, format: str = "json"):
        session = app.state.store.read(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if format == "json":
            content = session.json_text.encode("utf-8")
            filename = Path(session.filename).with_suffix(".json").name
            media_type = "application/json"
        elif format == "sav":
            try:
                content = json_text_to_sav_bytes(session.json_text)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Could not export save: {exc}")
            filename = Path(session.filename).with_suffix(".sav").name
            media_type = "application/octet-stream"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format requested")

        return StreamingResponse(
            iter([content]),
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return app


app = create_app()
