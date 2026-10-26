"""Hash a Docker rootfs export without extracting files or executing image code."""
import hashlib
import json
import struct
import sys
import tarfile

MAX_BYTES = 32 * 1024**3
MAX_FILE_BYTES = 1024**3
MAX_ENTRIES = 250_000
MAX_NAMES = 32 * 1024**2
MAX_EXTENSIONS = 16 * 1024**2
MAX_TRAILER = 1024**2


class InvalidImage(ValueError):
    pass


class BoundedReader:
    def __init__(self, source):
        self.source = source
        self.size = 0

    def read(self, count):
        if not isinstance(count, int) or not 0 <= count <= 1024**2:
            raise InvalidImage("Invalid read")
        value = self.source.read(count)
        self.size += len(value)
        if self.size > MAX_BYTES + 256 * 1024**2:
            raise InvalidImage("Archive exceeds bound")
        return value


def path(value):
    if not isinstance(value, str) or len(value.encode("utf-8", "surrogateescape")) > 4096 or "\0" in value or "\\" in value or value.startswith("/"):
        raise InvalidImage("Invalid path")
    while value.startswith("./"):
        value = value[2:]
    if value in ("", "."):
        return ""
    value = value.removesuffix("/")
    if any(part in ("", ".", "..") for part in value.split("/")):
        raise InvalidImage("Invalid path")
    return value


def observe(source):
    reader = BoundedReader(source)
    headers = 0
    extensions = 0
    ended = False

    class Info(tarfile.TarInfo):
        @classmethod
        def fromtarfile(cls, source):
            # CPython's accelerated reader can bypass an overridden frombuf; keep the size check before PAX allocation.
            member = cls.frombuf(source.fileobj.read(512), source.encoding, source.errors)
            member.offset = source.fileobj.tell() - 512
            return member._proc_member(source)

        @classmethod
        def frombuf(cls, value, encoding, errors):
            nonlocal headers, extensions, ended
            headers += 1
            if headers > 2 * MAX_ENTRIES:
                raise InvalidImage("Header bound")
            if len(value) == 512 and not any(value):
                ended = True
            try:
                member = super().frombuf(value, encoding, errors)
            except (tarfile.InvalidHeaderError, tarfile.TruncatedHeaderError) as error:
                raise InvalidImage("Malformed header") from error
            if member.type == tarfile.XGLTYPE:
                raise InvalidImage("Global extension unsupported")
            if member.type in (tarfile.XHDTYPE, tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK):
                extensions += member.size
                if not 0 <= member.size <= 65536 or extensions > MAX_EXTENSIONS:
                    raise InvalidImage("Extension bound")
            return member

    records = {}
    names = 0
    data_bytes = 0
    file_count = 0
    with tarfile.open(fileobj=reader, mode="r|", bufsize=65536, tarinfo=Info) as archive:
        for member in archive:
            name = path(member.name)
            if name in records or len(records) >= MAX_ENTRIES or member.issparse():
                raise InvalidImage("Duplicate or unsupported entry")
            names += len(name.encode("utf-8", "surrogateescape"))
            if names > MAX_NAMES or any(not isinstance(v, int) or v < 0 or v > 0xFFFFFFFF for v in (member.uid, member.gid)) or not 0 <= member.mode <= 0o7777:
                raise InvalidImage("Metadata bound")
            if not isinstance(member.size, int) or member.size < 0 or member.size > MAX_FILE_BYTES:
                raise InvalidImage("File bound")
            if member.isfile():
                kind = "file"
            elif member.isdir():
                kind = "directory"
            elif member.issym():
                kind = "symlink"
            elif member.islnk():
                kind = "hardlink"
            elif member.ischr():
                kind = "char"
            elif member.isblk():
                kind = "block"
            elif member.isfifo():
                kind = "fifo"
            else:
                raise InvalidImage("Unsupported entry")
            if not name and kind != "directory" or kind != "file" and member.size != 0:
                raise InvalidImage("Invalid entry shape")
            link = member.linkname if kind in ("symlink", "hardlink") else ""
            if len(link.encode("utf-8", "surrogateescape")) > 4096 or "\0" in link:
                raise InvalidImage("Invalid link")
            if kind == "hardlink":
                link = path(link)
                if link not in records or records[link][0] != "file":
                    raise InvalidImage("Unbound hard link")
            xattrs = {key: value for key, value in member.pax_headers.items() if key not in (
                "path", "linkpath", "size", "uid", "gid", "uname", "gname", "mtime", "atime", "ctime")}
            if len(xattrs) > 128 or any(key.startswith("GNU.sparse.") for key in xattrs):
                raise InvalidImage("Unsupported extension")
            metadata = {"path": name, "type": kind, "mode": member.mode, "uid": member.uid, "gid": member.gid,
                        "size": member.size, "link": link, "xattrs": xattrs}
            if kind in ("char", "block"):
                if any(not isinstance(v, int) or not 0 <= v <= 0xFFFFFFFF for v in (member.devmajor, member.devminor)):
                    raise InvalidImage("Invalid device")
                metadata.update(major=member.devmajor, minor=member.devminor)
            digest = hashlib.sha256(json.dumps(metadata, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("ascii") + b"\0")
            if kind == "file":
                data_bytes += member.size
                file_count += 1
                if data_bytes > MAX_BYTES:
                    raise InvalidImage("Data bound")
                body = archive.extractfile(member)
                if body is None:
                    raise InvalidImage("Missing file")
                length = 0
                with body:
                    while chunk := body.read(65536):
                        length += len(chunk)
                        digest.update(chunk)
                if length != member.size:
                    raise InvalidImage("Incomplete file")
            records[name] = (kind, digest.digest())
            # Stream mode on Python 3.10 otherwise retains every header and its PAX metadata.
            archive.members.clear()
        if not ended or not records:
            raise InvalidImage("Missing archive terminator or rootfs")
        trailer = 0
        while chunk := archive.fileobj.read(65536):
            trailer += len(chunk)
            if any(chunk) or trailer > MAX_TRAILER:
                raise InvalidImage("Invalid archive trailer")
        if trailer < 512:
            raise InvalidImage("Incomplete archive terminator")
    result = hashlib.sha256(b"ingenium-image-tree-v1\0")
    for name in sorted(records):
        encoded = name.encode("utf-8", "surrogateescape")
        result.update(struct.pack(">I", len(encoded)) + encoded + records[name][1])
    return {"protocol": "ingenium-image-tree-v1", "tree_sha256": result.hexdigest(),
            "entries": len(records), "files": file_count, "data_bytes": data_bytes}


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise InvalidImage("No runtime options permitted")
        if sys.platform == "linux":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024**2, 512 * 1024**2))
            resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
        print(json.dumps(observe(sys.stdin.buffer), sort_keys=True, separators=(",", ":")))
    except Exception:
        print("Image rootfs observation failed; no image was executed or extracted.", file=sys.stderr)
        sys.exit(70)
