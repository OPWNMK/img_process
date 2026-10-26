#!/usr/bin/env python3
"""Launch 图分宝, a local human-in-the-loop image comparison tool."""

from __future__ import annotations

import argparse
import errno
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from scorer.server import PACKAGE_ROOT, create_server


def _port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((host, port))
        except OSError as exc:
            if exc.errno in {errno.EADDRINUSE, errno.EACCES}:
                return False
            raise
    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="图片筛选工具。",
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="监听地址（默认 127.0.0.1）"
    )
    parser.add_argument("--port", default=8765, type=int, help="监听端口（默认 8765）")
    parser.add_argument(
        "--no-browser", action="store_true", help="启动后不自动打开浏览器"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not _port_available(args.host, args.port):
        print(
            f"端口 {args.port} 已被占用，请换一个端口，例如：python3 app.py --port 8766",
            file=sys.stderr,
        )
        return 2

    try:
        httpd = create_server(args.host, args.port, PACKAGE_ROOT)
    except OSError as exc:
        print(f"无法启动服务：{exc}", file=sys.stderr)
        return 2

    display_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
    url = f"http://{display_host}:{httpd.server_port}/"

    print()
    print("  人工图片评分")
    print(f" 打开浏览器访问：{url}")
    print(f" 评分文件将写入所选根目录下的 scores.json")
    print("  按 Ctrl+C 退出")
    print()

    if not args.no_browser:

        def open_browser() -> None:
            try:
                webbrowser.open(url)
            except Exception:
                pass

        threading.Timer(0.45, open_browser).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已退出，评分文件已实时保存。")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
