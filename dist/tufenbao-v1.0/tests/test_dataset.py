from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scorer.dataset import (
    DatasetError,
    RecordsError,
    read_records,
    remove_record,
    save_record,
    scan_dataset,
)

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\xf0\x1f\x00\x05\x00\x01\xff\x89\x99=\x1d\x00\x00\x00\x00IEND"
    b"\xaeB`\x82"
)


class DatasetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def make_images(
        self,
        folders: list[str] | None = None,
        names: list[str] | None = None,
        counts: dict[str, int] | None = None,
    ) -> Path:
        folders = folders or ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]
        names = names or ["img2.png", "img10.png"]
        for folder in folders:
            directory = self.root / folder
            directory.mkdir()
            count = counts.get(folder, len(names)) if counts else len(names)
            for name in names[:count]:
                (directory / name).write_bytes(PNG)
        return self.root

    def test_scans_five_folders_and_natural_sort(self) -> None:
        self.make_images(names=["img10.png", "img2.png", "img1.png"])
        dataset = scan_dataset(self.root)
        self.assertEqual(dataset.total, 3)
        self.assertEqual([folder.name for folder in dataset.folders], ["Alpha", "Bravo", "Charlie", "Delta", "Echo"])
        self.assertEqual([image.filename for image in dataset.groups[0].images], ["img1.png"] * 5)
        self.assertEqual([image.filename for image in dataset.groups[1].images], ["img2.png"] * 5)
        self.assertEqual([image.filename for image in dataset.groups[2].images], ["img10.png"] * 5)
        self.assertTrue(dataset.groups[0].identical_names)
        self.assertEqual(dataset.groups[0].key, "img1")
        self.assertEqual(dataset.records_path, self.root / "scores.json")

    def test_requires_exactly_five_subfolders(self) -> None:
        self.make_images(folders=["Alpha", "Bravo", "Charlie", "Delta"])
        with self.assertRaisesRegex(DatasetError, "5 个子文件夹"):
            scan_dataset(self.root)

    def test_requires_equal_image_counts(self) -> None:
        self.make_images(counts={"Alpha": 1})
        with self.assertRaisesRegex(DatasetError, "数量必须相同"):
            scan_dataset(self.root)

    def test_rejects_empty_folder_and_ignores_non_images(self) -> None:
        self.make_images(counts={"Alpha": 0})
        with self.assertRaisesRegex(DatasetError, "没有可识别的图片"):
            scan_dataset(self.root)

        (self.root / "Alpha" / "notes.txt").write_text("ignore me")
        with self.assertRaises(DatasetError):
            scan_dataset(self.root)

    def test_hidden_directories_are_ignored(self) -> None:
        self.make_images()
        (self.root / ".cache").mkdir()
        self.assertEqual(scan_dataset(self.root).total, 2)

    def test_different_names_use_first_folder_and_disambiguate(self) -> None:
        for index, folder in enumerate(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]):
            directory = self.root / folder
            directory.mkdir()
            (directory / f"alpha-{index}.png").write_bytes(PNG)
            (directory / "shared.png").write_bytes(PNG)
        dataset = scan_dataset(self.root)
        self.assertFalse(dataset.groups[0].identical_names)
        self.assertEqual(dataset.groups[0].key, "alpha-0")
        self.assertTrue(dataset.groups[1].identical_names)
        self.assertEqual(dataset.groups[1].key, "shared")

    def test_duplicate_keys_get_suffix(self) -> None:
        for folder in ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]:
            directory = self.root / folder
            directory.mkdir()
            (directory / "twin.png").write_bytes(PNG)
            (directory / "twin.jpg").write_bytes(PNG)
        dataset = scan_dataset(self.root)
        self.assertEqual([group.key for group in dataset.groups], ["twin", "twin__2"])

    def test_records_round_trip_and_remove(self) -> None:
        path = self.root / "scores.json"
        save_record(path, "img1", "Alpha", "Echo", ["img1", "img2"])
        save_record(path, "img2", "Bravo", "Delta", ["img1", "img2"])
        self.assertEqual(
            json.loads(path.read_text(encoding="utf-8")),
            {
                "img1": {"win": "Alpha", "lose": "Echo"},
                "img2": {"win": "Bravo", "lose": "Delta"},
            },
        )
        self.assertEqual(read_records(path)["img2"]["win"], "Bravo")
        remove_record(path, "img1", ["img1", "img2"])
        self.assertEqual(list(read_records(path)), ["img2"])
        self.assertFalse(any(self.root.glob(".scores.json.*.tmp")))

    def test_record_validation(self) -> None:
        path = self.root / "scores.json"
        with self.assertRaises(RecordsError):
            save_record(path, "img1", "Alpha", "Alpha")
        with self.assertRaises(RecordsError):
            save_record(path, "", "Alpha", "Bravo")
        path.write_text('{"img1": {"win": "Alpha"}}', encoding="utf-8")
        with self.assertRaisesRegex(RecordsError, "win 和 lose"):
            read_records(path)

    def test_malformed_json_has_clear_error(self) -> None:
        path = self.root / "scores.json"
        path.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(RecordsError, "不是合法 JSON"):
            read_records(path)


if __name__ == "__main__":
    unittest.main()
