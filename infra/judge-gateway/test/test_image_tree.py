import importlib.util
import io
from pathlib import Path
import subprocess
import sys
import tarfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "image-tree.py"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("image_tree", SCRIPT)
image_tree = importlib.util.module_from_spec(spec)
spec.loader.exec_module(image_tree)


def archive(entries, **options):
    value = io.BytesIO()
    with tarfile.open(fileobj=value, mode="w", **options) as output:
        for name, data, fields in entries:
            info = tarfile.TarInfo(name)
            info.mode = 0o644
            info.size = len(data)
            for key, field in fields.items():
                setattr(info, key, field)
            output.addfile(info, io.BytesIO(data))
    return value.getvalue()


class ImageTreeTests(unittest.TestCase):
    def observe(self, entries, **options):
        return image_tree.observe(io.BytesIO(archive(entries, **options)))

    def test_stable_across_order_timestamps_and_header_formats(self):
        entries = [("./b", b"\0\xff\n", {}), ("a", b"first", {})]
        first = self.observe(entries)
        changed = [(name, data, {"mtime": 123456}) for name, data, _ in reversed(entries)]
        self.assertEqual(first, self.observe(changed, format=tarfile.USTAR_FORMAT))
        self.assertEqual(first["entries"], 2)
        self.assertEqual(first["data_bytes"], 8)

    def test_content_identity_modes_and_ownership_are_bound(self):
        original = self.observe([("file", b"exact", {})])
        for name, data, fields in [("other", b"exact", {}), ("file", b"changed", {}),
                                   ("file", b"exact", {"mode": 0o755}), ("file", b"exact", {"uid": 10}), ("file", b"exact", {"gid": 10})]:
            self.assertNotEqual(original["tree_sha256"], self.observe([(name, data, fields)])["tree_sha256"])

    def test_links_and_devices_are_hashed_without_following_or_opening_them(self):
        entries = [("file", b"exact", {}), ("hard", b"", {"type": tarfile.LNKTYPE, "linkname": "file"}),
                   ("sym", b"", {"type": tarfile.SYMTYPE, "linkname": "/outside/never-opened"}),
                   ("null", b"", {"type": tarfile.CHRTYPE, "devmajor": 1, "devminor": 3})]
        self.assertEqual(self.observe(entries)["files"], 1)
        for link in ("missing", "../file", "/file"):
            with self.assertRaises(image_tree.InvalidImage):
                self.observe([("hard", b"", {"type": tarfile.LNKTYPE, "linkname": link})])

    def test_root_directory_and_normalized_duplicate_refusal(self):
        self.assertEqual(self.observe([("./", b"", {"type": tarfile.DIRTYPE})])["entries"], 1)
        for name in ("file", "./file"):
            with self.assertRaises(image_tree.InvalidImage):
                self.observe([("file", b"x", {}), (name, b"y", {})])

    def test_paths_cannot_escape_or_smuggle_an_alternate_platform_separator(self):
        for name in ("../file", "/absolute", "a/../file", "a//file", "a\\file"):
            with self.assertRaises(image_tree.InvalidImage):
                self.observe([(name, b"x", {})])

    def test_extended_attributes_are_bound_but_pax_timestamps_are_not(self):
        base = self.observe([("file", b"x", {})])
        timestamp = self.observe([("file", b"x", {"pax_headers": {"mtime": "1.123", "atime": "5"}})])
        self.assertEqual(base, timestamp)
        for value in ("one", "two"):
            result = self.observe([("file", b"x", {"pax_headers": {"SCHILY.xattr.user.fixture": value}})])
            self.assertNotEqual(result["tree_sha256"], base["tree_sha256"])

    def test_metadata_and_file_bounds_are_enforced_before_materialization(self):
        entries = [("file", b"abc", {})]
        for name, limit in (("MAX_ENTRIES", 0), ("MAX_FILE_BYTES", 1), ("MAX_NAMES", 1), ("MAX_BYTES", 1)):
            with patch.object(image_tree, name, limit), self.assertRaises(image_tree.InvalidImage):
                self.observe(entries)
        info = tarfile.TarInfo("extension")
        info.type = tarfile.XHDTYPE
        info.size = 65537
        with self.assertRaises(image_tree.InvalidImage):
            image_tree.observe(io.BytesIO(info.tobuf(format=tarfile.USTAR_FORMAT)))

    def test_truncated_bad_checksum_and_trailing_data_cannot_certify_an_image(self):
        valid = archive([("file", b"exact", {})])
        for raw in (b"", valid[:514], valid[:1024], bytes([valid[0] ^ 1]) + valid[1:], valid + b"not-an-image"):
            with self.assertRaises((image_tree.InvalidImage, tarfile.ReadError)):
                image_tree.observe(io.BytesIO(raw))

    def test_cli_is_bounded_json_or_a_private_failure_without_paths(self):
        result = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=archive([("file", b"exact", {})]), capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        self.assertLess(len(result.stdout), 512)
        self.assertEqual(result.stderr, b"")
        invalid = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=b"private/untrusted/path", capture_output=True, timeout=10)
        self.assertEqual(invalid.returncode, 70)
        self.assertEqual(invalid.stdout, b"")
        self.assertNotIn(b"private/untrusted/path", invalid.stderr)


if __name__ == "__main__":
    unittest.main()
