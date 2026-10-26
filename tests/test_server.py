from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from scorer.server import create_server

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\xf0\x1f\x00\x05\x00\x01\xff\x89\x99=\x1d\x00\x00\x00\x00IEND"
    b"\xaeB`\x82"
)


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tempdir.name)
        for folder in ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]:
            directory = cls.root / folder
            directory.mkdir()
            (directory / "img1.png").write_bytes(PNG)
            (directory / "img2.png").write_bytes(PNG)

        cls.httpd = create_server("127.0.0.1", 0, cls.root)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)
        cls.tempdir.cleanup()

    def request(self, method: str, path: str, payload: dict | None = None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if data is not None else {},
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            with error:
                return error.code, error.headers, error.read()

    def load(self) -> dict:
        status, _, body = self.request("POST", "/api/load", {"path": str(self.root)})
        self.assertEqual(status, 200, body)
        return json.loads(body)

    def test_environment(self) -> None:
        status, _, body = self.request("GET", "/api/environment")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["service"], "五图鉴")
        self.assertIn("shortcuts", payload)

    def test_load_image_record_and_discard(self) -> None:
        dataset = self.load()
        self.assertEqual(dataset["total"], 2)
        self.assertEqual(len(dataset["groups"]), 2)
        self.assertEqual(len(dataset["folders"]), 5)
        image_url = dataset["groups"][0]["images"][0]["url"]

        status, headers, body = self.request("GET", image_url)
        self.assertEqual(status, 200)
        self.assertEqual(body, PNG)
        self.assertEqual(headers.get_content_type(), "image/png")

        status, _, body = self.request(
            "POST",
            "/api/record",
            {"session_id": dataset["session_id"], "key": "img1", "win": "Alpha", "lose": "Echo"},
        )
        self.assertEqual(status, 200, body)
        scores = json.loads((self.root / "scores.json").read_text(encoding="utf-8"))
        self.assertEqual(scores, {"img1": {"win": "Alpha", "lose": "Echo"}})

        status, _, body = self.request(
            "POST",
            "/api/discard",
            {"session_id": dataset["session_id"], "key": "img1"},
        )
        self.assertEqual(status, 200, body)
        self.assertEqual(json.loads((self.root / "scores.json").read_text(encoding="utf-8")), {})

    def test_rejects_invalid_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            status, _, body = self.request("POST", "/api/load", {"path": temporary})
            self.assertEqual(status, 400)
            self.assertIn("5 个子文件夹", json.loads(body)["error"])

    def test_rejects_same_winner_and_loser(self) -> None:
        dataset = self.load()
        status, _, body = self.request(
            "POST",
            "/api/record",
            {"session_id": dataset["session_id"], "key": "img1", "win": "Alpha", "lose": "Alpha"},
        )
        self.assertEqual(status, 400)
        self.assertIn("不能是同一张", json.loads(body)["error"])

    def test_rejects_unknown_image(self) -> None:
        dataset = self.load()
        url = f"/api/image?session={dataset['session_id']}&folder=0&name=..%2Fsecret.png"
        status, _, _ = self.request("GET", url)
        self.assertEqual(status, 404)

    def test_rejects_unknown_session(self) -> None:
        status, _, body = self.request(
            "POST",
            "/api/record",
            {"session_id": "missing", "key": "img1", "win": "Alpha", "lose": "Echo"},
        )
        self.assertEqual(status, 404)

    def test_browse_lists_directories(self) -> None:
        status, _, body = self.request("GET", f"/api/browse?path={self.root}")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(len(payload["entries"]), 5)
        self.assertEqual(payload["entries"][0]["image_count"], 2)

    def test_static_assets(self) -> None:
        for path, expected in [
            ("/", "text/html"),
            ("/app.js", "text/javascript"),
            ("/styles.css", "text/css"),
            ("/favicon.svg", "image/svg+xml"),
        ]:
            status, headers, body = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(headers.get_content_type().startswith(expected))
            self.assertTrue(body)


if __name__ == "__main__":
    unittest.main()
