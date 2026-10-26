"""A dependency-free local web server for human image judging."""

from __future__ import annotations

import json
import mimetypes
import os
import secrets
import threading
import time
import urllib.parse
from dataclasses import dataclass, field
from email.utils import formatdate
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .dataset import (
    IMAGE_EXTENSIONS,
    Dataset,
    DatasetError,
    RecordsError,
    natural_sort_key,
    read_records,
    remove_record,
    save_record,
    scan_dataset,
)

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PACKAGE_ROOT / "web"
DEMO_ROOT = PACKAGE_ROOT / "demo_data"
SERVICE_NAME = "五图鉴"
MAX_BODY_BYTES = 1_000_000


class ApiError(Exception):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status = int(status)


@dataclass
class Session:
    session_id: str
    dataset: Dataset
    records: dict[str, dict[str, str]]
    created_at: float = field(default_factory=time.time)
    image_lookup: dict[tuple[int, str], Path] = field(default_factory=dict)

    @classmethod
    def create(cls, dataset: Dataset) -> "Session":
        session = cls(
            session_id=secrets.token_urlsafe(12),
            dataset=dataset,
            records=read_records(dataset.records_path),
        )
        for group in dataset.groups:
            for image in group.images:
                session.image_lookup[(image.folder_index, image.filename)] = image.path
        return session

    def public_payload(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "root": str(self.dataset.root),
            "json_path": str(self.dataset.records_path),
            "folders": [
                {"index": folder.index, "name": folder.name, "count": folder.image_count}
                for folder in self.dataset.folders
            ],
            "total": self.dataset.total,
            "groups": [
                group.to_public(self.session_id, self._image_url)
                for group in self.dataset.groups
            ],
            "records": self.records,
        }

    def _image_url(self, session_id: str, image) -> str:
        query = urllib.parse.urlencode(
            {
                "session": session_id,
                "folder": image.folder_index,
                "name": image.filename,
            }
        )
        return f"/api/image?{query}"

    @property
    def ordered_keys(self) -> list[str]:
        return [group.key for group in self.dataset.groups]


class Application:
    def __init__(self, project_root: Path = PACKAGE_ROOT):
        self.project_root = project_root
        self.sessions: dict[str, Session] = {}
        self.lock = threading.RLock()

    def _get_session(self, session_id: str | None) -> Session:
        if not session_id:
            raise ApiError("会话已失效，请重新选择文件夹。", HTTPStatus.NOT_FOUND)
        with self.lock:
            session = self.sessions.get(session_id)
            if session is None:
                raise ApiError("会话已失效，请重新选择文件夹。", HTTPStatus.NOT_FOUND)
            return session

    def load(self, path: str) -> dict[str, Any]:
        if not isinstance(path, str) or not path.strip():
            raise ApiError("请填写图片根文件夹路径。")
        dataset = scan_dataset(path.strip())
        with self.lock:
            session = Session.create(dataset)
            # Keep memory bounded when a user browses several datasets.
            if len(self.sessions) >= 24:
                oldest = sorted(self.sessions.values(), key=lambda item: item.created_at)[:8]
                for old in oldest:
                    self.sessions.pop(old.session_id, None)
            self.sessions[session.session_id] = session
        return session.public_payload()

    def record(self, payload: dict[str, Any]) -> dict[str, Any]:
        session = self._get_session(payload.get("session_id"))
        key = payload.get("key")
        win = payload.get("win")
        lose = payload.get("lose")
        if not isinstance(key, str) or not isinstance(win, str) or not isinstance(lose, str):
            raise ApiError("记录参数不完整。")
        group = next((item for item in session.dataset.groups if item.key == key), None)
        if group is None:
            raise ApiError("无法识别当前图片组，请刷新页面后重试。")
        folder_names = {folder.name for folder in session.dataset.folders}
        if win not in folder_names or lose not in folder_names:
            raise ApiError("胜者或败者不属于当前数据集。")
        if win == lose:
            raise ApiError("胜者和败者不能是同一张图片。")

        with self.lock:
            try:
                records = save_record(
                    session.dataset.records_path,
                    key,
                    win,
                    lose,
                    session.ordered_keys,
                )
            except (RecordsError, OSError) as exc:
                raise ApiError(f"写入 JSON 失败：{exc}", HTTPStatus.CONFLICT) from exc
            session.records = records
        return {"records": session.records, "saved_at": time.time()}

    def discard(self, payload: dict[str, Any]) -> dict[str, Any]:
        session = self._get_session(payload.get("session_id"))
        key = payload.get("key")
        if not isinstance(key, str) or not key.strip():
            raise ApiError("记录参数不完整。")
        with self.lock:
            try:
                records = remove_record(
                    session.dataset.records_path,
                    key,
                    session.ordered_keys,
                )
            except (RecordsError, OSError) as exc:
                raise ApiError(f"更新 JSON 失败：{exc}", HTTPStatus.CONFLICT) from exc
            session.records = records
        return {"records": session.records, "discarded_at": time.time()}

    def browse(self, raw_path: str | None) -> dict[str, Any]:
        requested = (raw_path or "").strip() or str(Path.home())
        requested = os.path.expandvars(os.path.expanduser(requested))
        path = Path(requested)
        if not path.is_absolute():
            path = (self.project_root / path).resolve()
        try:
            path = path.resolve(strict=True)
        except FileNotFoundError as exc:
            raise ApiError(f"路径不存在：{requested}") from exc
        except OSError as exc:
            raise ApiError(f"无法访问路径：{exc.strerror or exc}") from exc
        if not path.is_dir():
            raise ApiError("该路径不是文件夹。")

        entries: list[dict[str, Any]] = []
        truncated = False
        try:
            children = sorted(
                (entry for entry in path.iterdir() if entry.is_dir() and not entry.name.startswith(".")),
                key=lambda entry: natural_sort_key(entry.name),
            )
        except PermissionError as exc:
            raise ApiError("没有权限读取该文件夹。", HTTPStatus.FORBIDDEN) from exc
        except OSError as exc:
            raise ApiError(f"无法读取该文件夹：{exc.strerror or exc}") from exc

        if len(children) > 600:
            children = children[:600]
            truncated = True

        for child in children:
            image_count = 0
            subdir_count = 0
            try:
                with os.scandir(child) as scanner:
                    for item in scanner:
                        if item.name.startswith("."):
                            continue
                        if item.is_file() and Path(item.name).suffix.lower() in IMAGE_EXTENSIONS:
                            image_count += 1
                        elif item.is_dir():
                            subdir_count += 1
            except OSError:
                pass
            entries.append(
                {
                    "name": child.name,
                    "path": str(child),
                    "image_count": image_count,
                    "subdir_count": subdir_count,
                }
            )

        parent = str(path.parent) if path.parent != path else None
        return {
            "path": str(path),
            "parent": parent,
            "entries": entries,
            "truncated": truncated,
            "shortcuts": self._shortcuts(),
        }

    def _shortcuts(self) -> list[dict[str, str]]:
        shortcuts = [{"name": "主目录", "path": str(Path.home())}]
        if self.project_root.exists():
            shortcuts.append({"name": "项目目录", "path": str(self.project_root)})
        if DEMO_ROOT.exists():
            shortcuts.append({"name": "演示数据", "path": str(DEMO_ROOT)})
        return shortcuts

    def environment(self) -> dict[str, Any]:
        return {
            "service": SERVICE_NAME,
            "project_root": str(self.project_root),
            "home": str(Path.home()),
            "demo_path": str(DEMO_ROOT) if DEMO_ROOT.exists() else None,
            "shortcuts": self._shortcuts(),
        }


class ImageScoringHandler(BaseHTTPRequestHandler):
    server_version = "ImageScoring/1.0"
    protocol_version = "HTTP/1.1"
    app: Application

    # ---------- low level helpers ----------

    def log_message(self, fmt: str, *args: Any) -> None:
        if args and str(args[0]).startswith(("GET /api", "POST /api")):
            return
        super().log_message(fmt, *args)

    def _send_bytes(
        self,
        status: int,
        body: bytes,
        content_type: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _json(self, payload: Any, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, body, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def _error(self, message: str, status: int = HTTPStatus.BAD_REQUEST) -> None:
        self._json({"error": message}, status)

    def _read_json(self) -> dict[str, Any]:
        content_type = self.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            raise ApiError("请求必须使用 application/json。", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ApiError("请求长度无效。") from exc
        if length <= 0:
            raise ApiError("请求内容为空。")
        if length > MAX_BODY_BYTES:
            raise ApiError("请求内容过大。", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError("请求 JSON 无法解析。") from exc
        if not isinstance(payload, dict):
            raise ApiError("请求 JSON 必须是对象。")
        return payload

    # ---------- routing ----------

    def do_GET(self) -> None:  # noqa: N802
        try:
            parsed = urllib.parse.urlsplit(self.path)
            route = parsed.path
            query = urllib.parse.parse_qs(parsed.query)
            if route == "/api/environment":
                self._json(self.app.environment())
                return
            if route == "/api/browse":
                self._json(self.app.browse(query.get("path", [None])[0]))
                return
            if route == "/api/image":
                self._serve_image(query)
                return
            if route in {"/", "/index.html"}:
                self._serve_static("index.html")
                return
            if route in {"/app.js", "/styles.css", "/favicon.svg"}:
                self._serve_static(route.lstrip("/"))
                return
            if route == "/api/health":
                self._json({"status": "ok"})
                return
            self._error("页面不存在。", HTTPStatus.NOT_FOUND)
        except ApiError as exc:
            self._error(exc.message, exc.status)
        except Exception as exc:  # pragma: no cover - defensive boundary
            self.log_error("Unhandled GET error: %r", exc)
            self._error("服务器内部错误。", HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:  # noqa: N802
        try:
            route = urllib.parse.urlsplit(self.path).path
            payload = self._read_json()
            if route == "/api/load":
                self._json(self.app.load(payload.get("path", "")))
                return
            if route == "/api/record":
                self._json(self.app.record(payload))
                return
            if route == "/api/discard":
                self._json(self.app.discard(payload))
                return
            self._error("接口不存在。", HTTPStatus.NOT_FOUND)
        except ApiError as exc:
            self._error(exc.message, exc.status)
        except DatasetError as exc:
            self._error(str(exc), HTTPStatus.BAD_REQUEST)
        except RecordsError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)
        except Exception as exc:  # pragma: no cover - defensive boundary
            self.log_error("Unhandled POST error: %r", exc)
            self._error("服务器内部错误。", HTTPStatus.INTERNAL_SERVER_ERROR)

    # ---------- responses ----------

    def _serve_static(self, name: str) -> None:
        allowed = {"index.html", "app.js", "styles.css", "favicon.svg"}
        if name not in allowed:
            self._error("文件不存在。", HTTPStatus.NOT_FOUND)
            return
        path = WEB_ROOT / name
        try:
            body = path.read_bytes()
        except OSError:
            self._error("静态文件缺失，请重新安装。", HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
        }.get(path.suffix, "application/octet-stream")
        self._send_bytes(
            HTTPStatus.OK,
            body,
            content_type,
            {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Content-Security-Policy": (
                    "default-src 'self'; img-src 'self' data: blob:; "
                    "style-src 'self' 'unsafe-inline'; script-src 'self'; "
                    "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
                ),
            },
        )

    def _serve_image(self, query: dict[str, list[str]]) -> None:
        session_id = query.get("session", [""])[0]
        try:
            folder_index = int(query.get("folder", ["-1"])[0])
        except ValueError as exc:
            raise ApiError("图片参数无效。", HTTPStatus.BAD_REQUEST) from exc
        filename = query.get("name", [""])[0]
        session = self.app._get_session(session_id)
        path = session.image_lookup.get((folder_index, filename))
        if path is None:
            raise ApiError("图片不存在或不属于当前数据集。", HTTPStatus.NOT_FOUND)
        try:
            stat = path.stat()
            handle = path.open("rb")
        except OSError as exc:
            raise ApiError(f"无法读取图片：{exc.strerror or exc}", HTTPStatus.NOT_FOUND) from exc

        with handle:
            etag = f'"{int(stat.st_mtime)}-{stat.st_size}"'
            if self.headers.get("If-None-Match") == etag:
                self.send_response(HTTPStatus.NOT_MODIFIED)
                self.send_header("ETag", etag)
                self.end_headers()
                return
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(stat.st_size))
            self.send_header("Cache-Control", "private, max-age=3600")
            self.send_header("ETag", etag)
            self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if self.command == "HEAD":
                return
            try:
                while chunk := handle.read(256 * 1024):
                    self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()


class ScoringHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, app: Application):
        self.app = app
        super().__init__(server_address, self._make_handler())

    def _make_handler(self):
        application = self.app

        class BoundHandler(ImageScoringHandler):
            app = application

        return BoundHandler


def create_server(host: str = "127.0.0.1", port: int = 8765, project_root: Path = PACKAGE_ROOT):
    app = Application(project_root=project_root)
    return ScoringHTTPServer((host, port), app)
