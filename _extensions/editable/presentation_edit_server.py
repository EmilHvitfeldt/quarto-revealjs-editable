#!/usr/bin/env python3
"""Serve a Quarto deck and persist Reveal editable changes to its source files.

The browser receives expanded source, with immutable comments delimiting included
files. It sends the complete edited source and the revision it loaded; this server
restores include directives and writes only the original, known QMD files.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import subprocess
import tempfile
import threading
import time
from urllib.parse import unquote, urlsplit


MAX_BODY_BYTES = 16 * 1024 * 1024
INCLUDE = re.compile(r"^[ \t]*\{\{<[ \t]+include[ \t]+(.+?)[ \t]+>\}\}[ \t]*(?:\r?\n)?$")
MARKER = re.compile(r"<!-- presentation-editor:(?:begin|end):[0-9a-f]{24} -->")


class EditError(ValueError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = status


def confined_file(directory: Path, relative: str) -> Path:
    """Reject symlinked source ownership and paths outside the presentation."""
    item = Path(relative)
    if item.is_absolute() or ".." in item.parts:
        raise EditError("Source paths must stay within the presentation directory.")
    candidate = directory / item
    cursor = directory
    for part in item.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise EditError("Symlinks are not supported for editable source files.")
    if not candidate.resolve().is_relative_to(directory):
        raise EditError("Source path escapes the presentation directory.")
    if candidate.suffix.lower() != ".qmd" or not candidate.is_file():
        raise EditError("Editable source must be an existing QMD file.")
    return candidate


@dataclass(frozen=True)
class IncludedSource:
    relative: str
    directive: str
    begin: str
    end: str
    children: tuple[IncludedSource, ...]


@dataclass(frozen=True)
class SourceBundle:
    directory: Path
    root: str
    files: tuple[tuple[str, str], ...]
    children: tuple[IncludedSource, ...]
    content: str
    revision: str
    markers: tuple[str, ...]

    @classmethod
    def load(cls, directory: Path, root: str = "presentation.qmd") -> SourceBundle:
        directory = directory.resolve()
        files: dict[str, str] = {}
        markers: list[str] = []

        def expand(relative: str, chain: tuple[str, ...], identities: tuple[str, ...]) -> tuple[str, tuple[IncludedSource, ...]]:
            if relative in chain:
                raise EditError("Recursive QMD includes cannot be edited.")
            path = confined_file(directory, relative)
            source = path.read_bytes().decode("utf-8")
            if "<!-- presentation-editor:" in source:
                raise EditError("Source contains reserved editor boundary comments.")
            previous = files.setdefault(relative, source)
            if previous != source:
                raise EditError("Source changed while loading; retry.", HTTPStatus.CONFLICT)
            chunks: list[str] = []
            children: list[IncludedSource] = []
            include_ordinal = 0
            for line in source.splitlines(keepends=True):
                match = INCLUDE.fullmatch(line)
                if not match:
                    chunks.append(line)
                    continue
                try:
                    arguments = shlex.split(match.group(1))
                except ValueError as error:
                    raise EditError("Malformed QMD include directive.") from error
                if len(arguments) != 1:
                    raise EditError("Editable includes must specify one QMD path.")
                child_relative = str(Path(relative).parent / arguments[0])
                confined_file(directory, child_relative)
                identity = hashlib.sha256(("/".join(identities + (relative,)) + f":{include_ordinal}:{child_relative}").encode()).hexdigest()[:24]
                include_ordinal += 1
                begin = f"<!-- presentation-editor:begin:{identity} -->"
                end = f"<!-- presentation-editor:end:{identity} -->"
                markers.append(begin)
                expanded, grandchildren = expand(child_relative, chain + (relative,), identities + (identity,))
                markers.append(end)
                children.append(IncludedSource(child_relative, line, begin, end, grandchildren))
                # Always use one framing newline, even when the original file
                # already ends in a newline. Its meaning stays stable across
                # cumulative browser saves that add/remove a file's final newline.
                chunks.append(begin + "\n" + expanded + "\n" + end + ("\n" if line.endswith("\n") else ""))
            return "".join(chunks), tuple(children)

        content, children = expand(root, (), ())
        snapshot = tuple(sorted(files.items()))
        digest = hashlib.sha256()
        for name, source in snapshot:
            for value in (name, source):
                encoded = value.encode("utf-8")
                digest.update(len(encoded).to_bytes(8, "big"))
                digest.update(encoded)
        return cls(directory, root, snapshot, children, content, digest.hexdigest(), tuple(markers))

    def decode(self, content: str) -> dict[str, str]:
        found = tuple(match.group() for match in MARKER.finditer(content))
        if found != self.markers or content.count("<!-- presentation-editor:") != len(self.markers):
            raise EditError("Included-file boundaries were removed, added, or reordered; reload before editing.")
        originals = dict(self.files)
        outputs: dict[str, str] = {}

        def restore(text: str, children: tuple[IncludedSource, ...]) -> str:
            parts: list[str] = []
            offset = 0
            for child in children:
                begin = text.find(child.begin, offset)
                end = text.find(child.end, begin + len(child.begin))
                # Boundaries must remain standalone comments, not be embedded in prose/code.
                if begin < 0 or end < 0 or (begin and text[begin - 1] != "\n") or (end and text[end - 1] != "\n"):
                    raise EditError("Included-file boundaries must remain on their own lines.")
                inner_start = begin + len(child.begin)
                if text[inner_start:inner_start + 1] != "\n":
                    raise EditError("Malformed included-file boundary.")
                after = end + len(child.end)
                if after < len(text) and text[after] != "\n":
                    raise EditError("Malformed included-file boundary.")
                inner = text[inner_start + 1:end]
                if not inner.endswith("\n"):
                    raise EditError("Malformed included-file trailing boundary.")
                inner = inner[:-1]
                output = restore(inner, child.children)
                if child.relative in outputs and outputs[child.relative] != output:
                    raise EditError("Repeated includes have inconsistent edits.")
                outputs[child.relative] = output
                parts.extend((text[offset:begin], child.directive))
                offset = after + (1 if text[after:after + 1] == "\n" else 0)
            parts.append(text[offset:])
            return "".join(parts)

        outputs[self.root] = restore(content, self.children)
        if set(outputs) != set(originals):
            raise EditError("Edited source ownership does not match the original files.")
        # Include edits would alter ownership after saving. Require the same include
        # directives; ordinary text and positioned HTML remain freely editable.
        for name, source in outputs.items():
            old_includes = tuple(line for line in originals[name].splitlines(keepends=True) if INCLUDE.fullmatch(line))
            new_includes = tuple(line for line in source.splitlines(keepends=True) if INCLUDE.fullmatch(line))
            if old_includes != new_includes:
                raise EditError("Include directives cannot be changed through the slide editor.")
        return outputs


class SourceStore:
    def __init__(self, directory: Path, source: str = "presentation.qmd"):
        self.directory = directory.resolve()
        confined_file(self.directory, source)
        self.source = source
        self.lock = threading.RLock()
        self.bundle = SourceBundle.load(self.directory, self.source)

    def refresh(self) -> SourceBundle:
        with self.lock:
            self.bundle = SourceBundle.load(self.directory, self.source)
            return self.bundle

    def save(self, revision: str, content: str) -> tuple[SourceBundle, list[str]]:
        with self.lock:
            current = self.refresh()
            if revision != current.revision:
                raise EditError("Source changed since this browser loaded it. Reload before saving.", HTTPStatus.CONFLICT)
            outputs = current.decode(content)
            changed = [name for name, original in current.files if outputs[name] != original]
            if not changed:
                return current, []
            backup_root = self.directory / ".presentation-editor-backups"
            if backup_root.is_symlink():
                raise EditError("Editor backup directory must not be a symlink.")
            backup_dir = backup_root / (time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + "-" + secrets.token_hex(6))
            temporary: dict[str, Path] = {}
            originals = dict(current.files)
            replaced: list[str] = []
            try:
                for name in changed:
                    path = confined_file(self.directory, name)
                    backup = backup_dir / name
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    backup.write_bytes(originals[name].encode("utf-8"))
                    handle, tmp = tempfile.mkstemp(prefix=".presentation-edit-", dir=path.parent)
                    temporary[name] = Path(tmp)
                    with os.fdopen(handle, "wb") as stream:
                        stream.write(outputs[name].encode("utf-8"))
                        stream.flush()
                        os.fsync(stream.fileno())
                    shutil.copymode(path, tmp)
                if SourceBundle.load(self.directory, self.source).revision != current.revision:
                    raise EditError("Source changed during save; retry after reloading.", HTTPStatus.CONFLICT)
                for name in changed:
                    path = confined_file(self.directory, name)
                    os.replace(temporary[name], path)
                    replaced.append(name)
                self.bundle = SourceBundle.load(self.directory, self.source)
            except Exception:
                # Backups are complete before the first replacement. Roll back a
                # partially applied multi-file save using atomic replacements.
                for name in reversed(replaced):
                    path = confined_file(self.directory, name)
                    handle, tmp = tempfile.mkstemp(prefix=".presentation-rollback-", dir=path.parent)
                    with os.fdopen(handle, "wb") as stream:
                        stream.write(originals[name].encode("utf-8"))
                    shutil.copymode(path, tmp)
                    os.replace(tmp, path)
                raise
            finally:
                for path in temporary.values():
                    path.unlink(missing_ok=True)
            return self.bundle, changed


class RenderWorker:
    def __init__(self, store: SourceStore, quarto: str, timeout: float = 180):
        self.store = store
        self.quarto = quarto
        self.timeout = timeout
        self.condition = threading.Condition()
        self.pending = False
        self.stopping = False
        self.state: dict[str, object] = {"busy": False, "queued": False, "rendered_revision": None, "error": None}
        self.thread = threading.Thread(target=self._run, name="presentation-render", daemon=True)
        self.thread.start()

    def request(self) -> None:
        with self.condition:
            self.pending = True
            self.state["queued"] = True
            self.condition.notify_all()

    def status(self) -> dict[str, object]:
        with self.condition:
            return dict(self.state)

    def wait_idle(self, timeout: float) -> None:
        with self.condition:
            self.condition.wait_for(lambda: not self.pending and not self.state["busy"], timeout)

    def close(self) -> None:
        with self.condition:
            self.stopping = True
            self.condition.notify_all()
        self.thread.join(timeout=self.timeout + 5)

    def _run(self) -> None:
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.pending or self.stopping)
                if self.stopping:
                    return
                self.pending = False
                self.state.update(busy=True, queued=False, error=None)
            revision = None
            error = None
            try:
                # Quarto must read a consistent set of source files. Source saves
                # and renders therefore share a lock; HTTP status stays responsive.
                with self.store.lock:
                    revision = self.store.refresh().revision
                    process = subprocess.run([self.quarto, "render", self.store.source, "--to", "revealjs"], cwd=self.store.directory, capture_output=True, text=True, timeout=self.timeout, check=False)
                    if process.returncode:
                        error = (process.stderr or process.stdout or f"Quarto exited {process.returncode}")[-4000:]
                    elif self.store.refresh().revision != revision:
                        error = "Source changed externally during rendering; a new render was queued."
                        self.request()
            except (OSError, subprocess.SubprocessError, ValueError) as failure:
                error = str(failure)
            with self.condition:
                self.state.update(busy=False, error=error)
                if error is None:
                    self.state["rendered_revision"] = revision
                self.condition.notify_all()


class PresentationEditServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], directory: Path, quarto: str = "quarto", startup_render: bool = True, render_timeout: float = 180, source: str = "presentation.qmd", output: str | None = None):
        self.store = SourceStore(directory, source)
        self.output = output or str(Path(source).with_suffix(".html"))
        output_path = Path(self.output)
        if output_path.is_absolute() or ".." in output_path.parts or output_path.suffix.lower() != ".html":
            raise EditError("Rendered output must be an HTML path within the presentation directory.")
        cursor = self.store.directory
        for part in output_path.parts:
            cursor = cursor / part
            if cursor.is_symlink():
                raise EditError("Rendered output cannot pass through a symlink.")
        if not cursor.resolve().is_relative_to(self.store.directory):
            raise EditError("Rendered output escapes the presentation directory.")
        self.output_route = "/" + output_path.as_posix()
        self.token = secrets.token_urlsafe(32)
        self.renderer = RenderWorker(self.store, quarto, render_timeout)
        super().__init__(address, PresentationHandler)
        port = self.server_address[1]
        self.allowed_hosts = {f"localhost:{port}", f"127.0.0.1:{port}", f"[::1]:{port}"}
        if address[0] not in {"0.0.0.0", "::"}:
            self.allowed_hosts.add(f"{address[0]}:{port}")
        if startup_render:
            self.renderer.request()

    def server_close(self) -> None:
        super().server_close()
        self.renderer.close()


class PresentationHandler(SimpleHTTPRequestHandler):
    server: PresentationEditServer

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(args[2].store.directory), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _same_origin(self, require_token: bool = False) -> None:
        host = self.headers.get("Host", "")
        if host not in self.server.allowed_hosts:
            raise EditError("Unrecognized presentation host.", HTTPStatus.FORBIDDEN)
        origin = self.headers.get("Origin")
        if origin is not None and origin != f"http://{host}":
            raise EditError("Cross-origin presentation edits are not allowed.", HTTPStatus.FORBIDDEN)
        # Following a link from another site is a normal document navigation,
        # not a cross-site editor request. Keep this exception confined to the
        # public deck; it must never expose editor state or authorize a save.
        deck_navigation = (
            self.command == "GET"
            and urlsplit(self.path).path in {"/", self.server.output_route}
            and self.headers.get("Sec-Fetch-Mode") == "navigate"
            and self.headers.get("Sec-Fetch-Dest") == "document"
        )
        if self.headers.get("Sec-Fetch-Site") == "cross-site" and not deck_navigation:
            raise EditError("Cross-site presentation access is not allowed.", HTTPStatus.FORBIDDEN)
        if require_token and not secrets.compare_digest(self.headers.get("X-Presentation-Editor-Token", ""), self.server.token):
            raise EditError("Missing or invalid presentation editor token.", HTTPStatus.FORBIDDEN)

    def _json(self, status: int, data: dict[str, object]) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _static_path(self) -> Path:
        decoded = unquote(urlsplit(self.path).path)
        relative = Path(decoded.lstrip("/"))
        if ".." in relative.parts or relative.parts[:1] == (".presentation-editor-backups",):
            raise EditError("Path is not available.", HTTPStatus.FORBIDDEN)
        path = self.server.store.directory / relative
        if not path.resolve().is_relative_to(self.server.store.directory):
            raise EditError("Path is not available.", HTTPStatus.FORBIDDEN)
        if path.resolve().relative_to(self.server.store.directory).parts[:1] == (".presentation-editor-backups",):
            raise EditError("Path is not available.", HTTPStatus.FORBIDDEN)
        return path

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def do_GET(self) -> None:
        try:
            self._same_origin()
            route = urlsplit(self.path).path
            if route == "/__presentation_editor/state":
                bundle = self.server.store.refresh()
                render = self.server.renderer.status()
                if render["rendered_revision"] != bundle.revision and not render["busy"] and not render["queued"]:
                    self.server.renderer.request()
                self._json(HTTPStatus.OK, {"revision": bundle.revision, "content": bundle.content, "root_source": dict(bundle.files)[bundle.root], "token": self.server.token, "render": self.server.renderer.status()})
            elif route == "/__presentation_editor/status":
                self._json(HTTPStatus.OK, self.server.renderer.status())
            else:
                self._static_path()
                if route in {"/", self.server.output_route}:
                    self.server.renderer.wait_idle(30)
                    with self.server.store.lock:
                        payload = (self.server.store.directory / self.server.output).read_bytes()
                        revision = self.server.renderer.status()["rendered_revision"]
                    pin = ("<script>window._presentation_rendered_revision=" + json.dumps(revision) + ";</script>").encode("utf-8")
                    payload = payload.replace(b"<head>", b"<head>" + pin, 1)
                    self.send_response(HTTPStatus.OK)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                super().do_GET()
        except EditError as failure:
            self._json(failure.status, {"error": str(failure)})
        except (OSError, UnicodeError) as failure:
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(failure)})

    def do_HEAD(self) -> None:
        try:
            self._same_origin()
            self._static_path()
            super().do_HEAD()
        except EditError as failure:
            self.send_error(failure.status, str(failure))

    def do_POST(self) -> None:
        try:
            self._same_origin(require_token=True)
            if urlsplit(self.path).path != "/__presentation_editor/save":
                raise EditError("Unknown editor endpoint.", HTTPStatus.NOT_FOUND)
            if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
                raise EditError("Editor saves require application/json.", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            if self.headers.get("Transfer-Encoding"):
                raise EditError("Chunked request bodies are not supported.")
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError as failure:
                raise EditError("A valid Content-Length is required.", HTTPStatus.LENGTH_REQUIRED) from failure
            if length < 0 or length > MAX_BODY_BYTES:
                raise EditError("Editor save is too large.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            self.connection.settimeout(10)
            body = self.rfile.read(length)
            if len(body) != length:
                raise EditError("Incomplete editor save body.")
            try:
                data = json.loads(body)
            except (ValueError, UnicodeError) as failure:
                raise EditError("Invalid JSON save body.") from failure
            if not isinstance(data, dict) or set(data) != {"revision", "content"} or not all(isinstance(data[key], str) for key in data):
                raise EditError("Save body must contain only string revision and content fields.")
            bundle, changed = self.server.store.save(data["revision"], data["content"])
            if changed:
                self.server.renderer.request()
            self._json(HTTPStatus.OK, {"revision": bundle.revision, "saved_files": changed, "render": self.server.renderer.status()})
        except EditError as failure:
            self._json(failure.status, {"error": str(failure)})
        except (OSError, UnicodeError, TimeoutError) as failure:
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(failure)})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=Path.cwd())
    parser.add_argument("--source", default="presentation.qmd", help="QMD source relative to the presentation directory")
    parser.add_argument("--output", default=None, help="Rendered HTML relative to the presentation directory")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8769)
    parser.add_argument("--quarto", default="quarto")
    args = parser.parse_args()
    with PresentationEditServer((args.host, args.port), args.directory, args.quarto, source=args.source, output=args.output) as server:
        print(f"Presentation editor: http://{args.host}:{server.server_address[1]}{server.output_route}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
