"""Local API double for production viewer QA. No DB, Storage, queue or credentials."""

import json
from datetime import UTC, datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/jobs/") and path.endswith("/signed-url"):
            parts = path.split("/")
            kind = parts[-2]
            if self.headers.get("Authorization") != "Bearer fixture-only" or kind not in (
                "car_display",
                "car_original",
            ):
                self.send_error(404)
                return
            body = json.dumps(
                {
                    "kind": kind,
                    "url": f"https://storage-fixture.invalid/storage/v1/object/sign/raw/{kind}?token=fixture-{uuid4().hex}",
                    "expires_at": (datetime.now(UTC) + timedelta(seconds=600)).isoformat(),
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8775), Handler).serve_forever()
