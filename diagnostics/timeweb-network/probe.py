"""Disposable, credential-free network diagnostics. Never starts application workers."""
import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RESULTS: list[dict] = []
DONE = False
ASSET = Path('/tmp/network-probe-large.png')
FIXTURE = bytes(range(256)) * 32768
TARGETS = [
    ('render-health', 'https://dream-wheels-ai-tg.onrender.com/health'),
    ('render-openapi', 'https://dream-wheels-ai-tg.onrender.com/openapi.json'),
    ('control-large', 'https://dreamwheels.pro/assets/two-questions/how-it-looks/zeekr-001-race-ready-v2.png'),
]


def measure(name: str, url: str, attempt: int) -> dict:
    start = time.monotonic()
    result = {'name': name, 'attempt': attempt}
    body = bytearray()
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            result.update(status=response.status, ttfb=round(time.monotonic()-start, 3))
            expected = response.headers.get('Content-Length')
            body = bytearray()
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                body.extend(chunk)
                if len(body) > 12 * 1024 * 1024 or time.monotonic()-start > 60:
                    raise TimeoutError('diagnostic size/time limit')
            result.update(bytes=len(body), expected_bytes=int(expected) if expected else None,
                          complete=expected is None or len(body) == int(expected),
                          sha256=hashlib.sha256(body).hexdigest())
            if name == 'control-large' and result['complete']:
                ASSET.write_bytes(body)
    except Exception as error:
        result.update(error_type=type(error).__name__, complete=False, bytes=len(body))
    result['total'] = round(time.monotonic()-start, 3)
    return result


def run_probes() -> None:
    global DONE
    for name, url in TARGETS:
        for attempt in range(1, 6 if name == 'render-health' else 4):
            result = measure(name, url, attempt)
            RESULTS.append(result)
            print('PROBE_RESULT ' + json.dumps(result), flush=True)
    DONE = True
    print('PROBE_DONE ' + json.dumps({'count': len(RESULTS)}), flush=True)


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        path = self.path.split('?', 1)[0]
        if path == '/healthz':
            body, content_type = b'ok', 'text/plain'
        elif path in ('/', '/results.json'):
            body = json.dumps({'done': DONE, 'results': RESULTS}).encode()
            content_type = 'application/json'
        elif path == '/large.bin':
            body, content_type = FIXTURE, 'application/octet-stream'
        elif path == '/large.png' and ASSET.exists():
            body, content_type = ASSET.read_bytes(), 'image/png'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        pass


if __name__ == '__main__':
    print('LOCAL_FIXTURE ' + json.dumps({'path': '/large.bin', 'bytes': len(FIXTURE), 'sha256': hashlib.sha256(FIXTURE).hexdigest()}), flush=True)
    threading.Thread(target=run_probes, daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
