"""
Web application entrypoint for PalEdit.

`create_app` builds a FastAPI instance configured with templates and a
session-backed JSON editor for Palworld save files.
"""

from palworld_pal_edit.webapp.server import create_app, app

__all__ = ["create_app", "app"]
