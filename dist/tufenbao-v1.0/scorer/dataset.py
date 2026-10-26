"""Scan and validate the five-folder image dataset."""

from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".avif",
}

DEFAULT_RECORDS_FILENAME = "scores.json"
FOLDER_COUNT = 5


class DatasetError(ValueError):
    """Raised when the selected folder is not a valid scoring dataset."""


class RecordsError(ValueError):
    """Raised when the JSON records file cannot be read or written."""


def natural_sort_key(value: str) -> list[tuple[int, Any]]:
    """Sort names the way humans expect, e.g. image2 before image10."""
    parts = re.split(r"(\d+)", value.casefold())
    return [(0, int(part)) if part.isdigit() else (1, part) for part in parts]


def _image_paths(folder: Path) -> list[Path]:
    try:
        entries = list(folder.iterdir())
    except OSError as exc:
        raise DatasetError(f"无法读取子文件夹「{folder.name}」：{exc.strerror or exc}") from exc

    images = [
        entry
        for entry in entries
        if entry.is_file()
        and not entry.name.startswith(".")
        and entry.suffix.lower() in IMAGE_EXTENSIONS
    ]
    images.sort(key=lambda path: natural_sort_key(path.name))
    return images


@dataclass(frozen=True)
class FolderInfo:
    index: int
    name: str
    path: Path
    image_count: int


@dataclass(frozen=True)
class ImageItem:
    folder_index: int
    folder: str
    filename: str
    path: Path

    @property
    def stem(self) -> str:
        return Path(self.filename).stem


@dataclass(frozen=True)
class Group:
    index: int
    key: str
    images: tuple[ImageItem, ...]
    identical_names: bool

    def to_public(self, session_id: str, image_url_builder) -> dict[str, Any]:
        return {
            "index": self.index,
            "key": self.key,
            "identical_names": self.identical_names,
            "images": [
                {
                    "folder": image.folder,
                    "folder_index": image.folder_index,
                    "filename": image.filename,
                    "url": image_url_builder(session_id, image),
                }
                for image in self.images
            ],
        }


@dataclass(frozen=True)
class Dataset:
    root: Path
    folders: tuple[FolderInfo, ...]
    groups: tuple[Group, ...]
    records_path: Path

    @property
    def total(self) -> int:
        return len(self.groups)


def _build_groups(folder_images: list[tuple[FolderInfo, list[Path]]]) -> tuple[Group, ...]:
    groups: list[Group] = []
    used_keys: set[str] = set()
    count = len(folder_images[0][1])

    for group_index in range(count):
        images: list[ImageItem] = []
        for folder, paths in folder_images:
            path = paths[group_index]
            images.append(
                ImageItem(
                    folder_index=folder.index,
                    folder=folder.name,
                    filename=path.name,
                    path=path,
                )
            )

        stems = [image.stem for image in images]
        identical = len(set(stems)) == 1
        # The shared filename is the natural group key. When filenames differ,
        # use the first folder's image name and disambiguate duplicates below.
        base_key = stems[0].strip() or f"group_{group_index + 1:04d}"
        key = base_key
        suffix = 2
        while key in used_keys:
            key = f"{base_key}__{suffix}"
            suffix += 1
        used_keys.add(key)

        groups.append(
            Group(
                index=group_index,
                key=key,
                images=tuple(images),
                identical_names=identical,
            )
        )

    return tuple(groups)


def scan_dataset(root: str | Path, records_filename: str = DEFAULT_RECORDS_FILENAME) -> Dataset:
    """Validate *root* and return its five-way comparison groups.

    A valid dataset has exactly five immediate subfolders, each containing the
    same non-zero number of images. Images are paired by their natural sort
    order inside each folder.
    """

    root_path = Path(root).expanduser()
    try:
        root_path = root_path.resolve(strict=True)
    except FileNotFoundError as exc:
        raise DatasetError(f"文件夹不存在：{root_path}") from exc
    except OSError as exc:
        raise DatasetError(f"无法访问文件夹：{exc.strerror or exc}") from exc

    if not root_path.is_dir():
        raise DatasetError("请选择一个文件夹，而不是文件。")

    try:
        subdirs = [
            entry
            for entry in root_path.iterdir()
            if entry.is_dir() and not entry.name.startswith(".")
        ]
    except OSError as exc:
        raise DatasetError(f"无法读取该文件夹：{exc.strerror or exc}") from exc

    subdirs.sort(key=lambda path: natural_sort_key(path.name))
    if len(subdirs) != FOLDER_COUNT:
        names = "、".join(path.name for path in subdirs) or "无"
        raise DatasetError(
            f"根目录下必须有且仅有 {FOLDER_COUNT} 个子文件夹，当前发现 {len(subdirs)} 个：{names}"
        )

    folders: list[FolderInfo] = []
    folder_images: list[tuple[FolderInfo, list[Path]]] = []
    for index, directory in enumerate(subdirs):
        images = _image_paths(directory)
        info = FolderInfo(index=index, name=directory.name, path=directory, image_count=len(images))
        folders.append(info)
        folder_images.append((info, images))

    counts = {folder.name: folder.image_count for folder in folders}
    empty = [name for name, count in counts.items() if count == 0]
    if empty:
        raise DatasetError(f"以下子文件夹中没有可识别的图片：{'、'.join(empty)}")

    distinct_counts = set(counts.values())
    if len(distinct_counts) != 1:
        detail = "、".join(f"{name} {count} 张" for name, count in counts.items())
        raise DatasetError(f"5 个子文件夹中的图片数量必须相同，当前为：{detail}")

    groups = _build_groups(folder_images)
    records_path = root_path / records_filename
    return Dataset(root=root_path, folders=tuple(folders), groups=groups, records_path=records_path)


def _validate_records(data: Any) -> dict[str, dict[str, str]]:
    if not isinstance(data, dict):
        raise RecordsError("评分文件格式错误：最外层必须是 JSON 对象。")

    clean: dict[str, dict[str, str]] = {}
    for key, value in data.items():
        if not isinstance(key, str) or not key.strip():
            raise RecordsError("评分文件格式错误：图片名称不能为空。")
        if not isinstance(value, dict):
            raise RecordsError(f"评分文件格式错误：「{key}」的值必须是对象。")
        win = value.get("win")
        lose = value.get("lose")
        if not isinstance(win, str) or not isinstance(lose, str):
            raise RecordsError(f"评分文件格式错误：「{key}」必须同时包含 win 和 lose 字符串。")
        clean[key] = {"win": win, "lose": lose}
    return clean


def read_records(path: str | Path) -> dict[str, dict[str, str]]:
    records_path = Path(path)
    if not records_path.exists():
        return {}
    try:
        with records_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        raise RecordsError(
            f"评分文件 {records_path.name} 不是合法 JSON（第 {exc.lineno} 行）：{exc.msg}"
        ) from exc
    except OSError as exc:
        raise RecordsError(f"无法读取评分文件：{exc.strerror or exc}") from exc
    return _validate_records(data)


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
        try:
            dir_fd = os.open(path.parent, os.O_RDONLY)
        except OSError:
            dir_fd = None
        if dir_fd is not None:
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


def order_records(
    records: dict[str, dict[str, str]], preferred_keys: Iterable[str]
) -> dict[str, dict[str, str]]:
    """Return records in dataset order, followed by any extra existing keys."""
    ordered: dict[str, dict[str, str]] = {}
    for key in preferred_keys:
        if key in records and key not in ordered:
            ordered[key] = records[key]
    for key in sorted(records, key=natural_sort_key):
        if key not in ordered:
            ordered[key] = records[key]
    return ordered


def save_record(
    path: str | Path,
    key: str,
    win: str,
    lose: str,
    ordered_keys: Iterable[str] = (),
) -> dict[str, dict[str, str]]:
    """Add or replace one record and persist the file atomically."""
    key = key.strip()
    win = win.strip()
    lose = lose.strip()
    if not key:
        raise RecordsError("记录名不能为空。")
    if len(key) > 240:
        raise RecordsError("记录名过长（最多 240 个字符）。")
    if not win or not lose:
        raise RecordsError("胜者和败者都不能为空。")
    if win == lose:
        raise RecordsError("胜者和败者不能是同一张图片。")

    records = read_records(path)
    records[key] = {"win": win, "lose": lose}
    records = order_records(records, ordered_keys)
    _atomic_write_json(Path(path), records)
    return records


def remove_record(
    path: str | Path, key: str, ordered_keys: Iterable[str] = ()
) -> dict[str, dict[str, str]]:
    """Delete a record, if present, and persist the file atomically."""
    key = key.strip()
    if not key:
        raise RecordsError("记录名不能为空。")
    records = read_records(path)
    if key in records:
        del records[key]
        records = order_records(records, ordered_keys)
        _atomic_write_json(Path(path), records)
    return records
