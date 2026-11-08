"""Serve the local acceptance fixture with only the approved catalog originals."""

import argparse
import hashlib
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--port", default=4333, type=int)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    registry = json.loads((root / "landing/src/data/catalog-asset-registry.json").read_text())
    images: dict[str, tuple[bytes, str]] = {}
    source_dir = args.source_dir.resolve()
    for asset in registry["assets"]:
        metadata = asset["source"]
        path = (source_dir / metadata["fileName"]).resolve()
        if path.parent != source_dir:
            raise ValueError("Catalog source path escapes its directory")
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != metadata["sha256"]:
            raise ValueError("Catalog original changed")
        images["/qa-catalog/" + metadata["objectPath"]] = (data, metadata["contentType"])

    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_GET(self) -> None:
            route = urlsplit(self.path).path
            if route.startswith("/qa-catalog/"):
                image = images.get(route)
                if not image:
                    self.send_error(404)
                    return
                data, content_type = image
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
                return
            if any(part.startswith(".") or part == "node_modules" for part in Path(route).parts):
                self.send_error(404)
                return
            if "If-Modified-Since" in self.headers:
                del self.headers["If-Modified-Since"]
            super().do_GET()

        def list_directory(self, path: str) -> None:
            self.send_error(404)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(root)))
    print(
        f"Catalog QA: http://127.0.0.1:{args.port}/tests/browser-fixtures/catalog-handoff.html",
        flush=True,
    )
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
