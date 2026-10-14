from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import http.client
import importlib.util
import json
from pathlib import Path
import sys
import threading
from types import SimpleNamespace

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "presentation_edit_server.py"
SPEC = importlib.util.spec_from_file_location("presentation_edit_server", SCRIPT)
assert SPEC and SPEC.loader
editor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = editor
SPEC.loader.exec_module(editor)


@pytest.fixture
def deck(tmp_path: Path) -> Path:
    (tmp_path / "assets").mkdir()
    (tmp_path / "presentation.qmd").write_text(
        '---\ntitle: Test\n---\n\n## Main\n\n{{< include assets/slides.qmd >}}\n\n## End\n', encoding="utf-8"
    )
    (tmp_path / "assets/slides.qmd").write_text('## Included\n\n<img src="photo.png" style="left:10px">\n', encoding="utf-8")
    (tmp_path / "presentation.html").write_text("<html><head></head><body>Deck</body></html>", encoding="utf-8")
    return tmp_path


def test_edit_root_and_include_preserves_directives_and_backups(deck: Path) -> None:
    store = editor.SourceStore(deck)
    initial = store.bundle
    assert initial.content.startswith("---\n")
    assert initial.decode(initial.content) == dict(initial.files)
    content = initial.content.replace("## Main", "## Main edited").replace("left:10px", "left:42px")
    result, changed = store.save(initial.revision, content)
    assert set(changed) == {"presentation.qmd", "assets/slides.qmd"}
    assert result.revision != initial.revision
    assert "{{< include assets/slides.qmd >}}" in (deck / "presentation.qmd").read_text()
    assert "presentation-editor:" not in (deck / "presentation.qmd").read_text()
    assert "left:42px" in (deck / "assets/slides.qmd").read_text()
    backup = next((deck / ".presentation-editor-backups").iterdir())
    assert (backup / "presentation.qmd").read_text() == dict(initial.files)["presentation.qmd"]
    assert (backup / "assets/slides.qmd").read_text() == dict(initial.files)["assets/slides.qmd"]


def test_nested_and_no_trailing_newline_include_roundtrip(deck: Path) -> None:
    (deck / "assets/slides.qmd").write_text('## Included\n{{< include leaf.qmd >}}\n', encoding="utf-8")
    (deck / "assets/leaf.qmd").write_text("## Leaf", encoding="utf-8")
    bundle = editor.SourceBundle.load(deck)
    assert bundle.decode(bundle.content) == dict(bundle.files)
    edited = bundle.decode(bundle.content.replace("## Leaf", "## Moved leaf"))
    assert edited["assets/leaf.qmd"] == "## Moved leaf"
    assert edited["assets/slides.qmd"] == dict(bundle.files)["assets/slides.qmd"]


def test_cumulative_browser_saves_keep_boundaries_stable_after_line_insertions(deck: Path) -> None:
    (deck / "assets/slides.qmd").write_text("## Included", encoding="utf-8")
    store = editor.SourceStore(deck)
    initial = store.bundle
    first_content = initial.content.replace("## Main", "## New slide\n\n## Main").replace("## Included", "## Included\n")
    first, _ = store.save(initial.revision, first_content)
    assert first.markers == initial.markers
    # The extension serializes from its initial expanded source, with cumulative
    # edits, while using the newly returned revision for optimistic concurrency.
    second_content = first_content.replace("## Included", "## Included edited")
    second, _ = store.save(first.revision, second_content)
    assert second.markers == initial.markers
    assert (deck / "assets/slides.qmd").read_text() == "## Included edited\n"
    assert (deck / "presentation.qmd").read_text().count("## New slide") == 1


def test_repeated_nested_includes_have_unique_stable_markers(deck: Path) -> None:
    (deck / "presentation.qmd").write_text("{{< include assets/slides.qmd >}}\n{{< include assets/slides.qmd >}}\n", encoding="utf-8")
    (deck / "assets/slides.qmd").write_text("{{< include leaf.qmd >}}\n", encoding="utf-8")
    (deck / "assets/leaf.qmd").write_text("## Leaf\n", encoding="utf-8")
    bundle = editor.SourceBundle.load(deck)
    assert len(set(bundle.markers)) == len(bundle.markers)
    assert bundle.decode(bundle.content) == dict(bundle.files)


def test_stale_and_concurrent_saves_cannot_overwrite(deck: Path) -> None:
    store = editor.SourceStore(deck)
    first = store.bundle

    def save(label: str) -> int:
        try:
            store.save(first.revision, first.content.replace("## Main", label))
            return 200
        except editor.EditError as failure:
            return failure.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(save, ("## One", "## Two"))) == [200, 409]
    saved = (deck / "presentation.qmd").read_text()
    assert ("## One" in saved) != ("## Two" in saved)
    current = store.bundle
    (deck / "assets/slides.qmd").write_text("## External edit\n", encoding="utf-8")
    with pytest.raises(editor.EditError, match="Source changed") as failure:
        store.save(current.revision, current.content)
    assert failure.value.status == 409
    assert (deck / "assets/slides.qmd").read_text() == "## External edit\n"


@pytest.mark.parametrize("change", ["missing", "duplicate", "order", "inline", "new_include"])
def test_bad_boundaries_and_ownership_rejected_without_writes(deck: Path, change: str) -> None:
    store = editor.SourceStore(deck)
    bundle = store.bundle
    begin, end = bundle.markers
    content = {
        "missing": bundle.content.replace(begin, ""),
        "duplicate": bundle.content + begin,
        "order": bundle.content.replace(begin, "TEMP").replace(end, begin).replace("TEMP", end),
        "inline": bundle.content.replace(begin, "prose " + begin),
        "new_include": bundle.content + "\n{{< include extra.qmd >}}\n",
    }[change]
    with pytest.raises(editor.EditError):
        store.save(bundle.revision, content)
    assert editor.SourceBundle.load(deck).revision == bundle.revision
    assert not (deck / ".presentation-editor-backups").exists()


@pytest.mark.parametrize("include", ["../outside.qmd", "/tmp/outside.qmd", "assets/link.qmd"])
def test_source_outside_and_symlinks_rejected(deck: Path, include: str) -> None:
    outside = deck.parent / "outside.qmd"
    outside.write_text("## Outside\n", encoding="utf-8")
    (deck / "assets/link.qmd").symlink_to(outside)
    (deck / "presentation.qmd").write_text("{{< include " + include + " >}}\n", encoding="utf-8")
    with pytest.raises(editor.EditError):
        editor.SourceBundle.load(deck)
    assert outside.read_text() == "## Outside\n"


def test_partial_write_failure_rolls_back_originals(deck: Path, monkeypatch) -> None:
    store = editor.SourceStore(deck)
    bundle = store.bundle
    real_replace = editor.os.replace
    count = 0

    def fail_second(source, destination):
        nonlocal count
        count += 1
        if count == 2:
            raise OSError("disk write failed")
        real_replace(source, destination)

    monkeypatch.setattr(editor.os, "replace", fail_second)
    with pytest.raises(OSError, match="disk write failed"):
        store.save(bundle.revision, bundle.content.replace("## Main", "## Main changed").replace("left:10px", "left:99px"))
    assert editor.SourceBundle.load(deck).revision == bundle.revision


@pytest.fixture
def running_server(deck: Path, monkeypatch):
    calls = []

    def render(argv, **kwargs):
        calls.append((argv, kwargs))
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(editor.subprocess, "run", render)
    server = editor.PresentationEditServer(("127.0.0.1", 0), deck, "test-quarto", startup_render=False)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, calls
    server.shutdown()
    server.server_close()
    thread.join(timeout=3)


def request(server, method: str, path: str, body=None, headers=None):
    connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
    if body is not None and not isinstance(body, bytes):
        body = json.dumps(body).encode("utf-8")
    connection.request(method, path, body, headers or {})
    response = connection.getresponse()
    content = response.read()
    connection.close()
    if response.getheader("Content-Type", "").startswith("application/json"):
        content = json.loads(content)
    return response.status, content


def test_http_save_render_revision_pin_and_no_arbitrary_paths(running_server, deck: Path) -> None:
    server, calls = running_server
    status, initial = request(server, "GET", "/__presentation_editor/state")
    assert status == 200 and initial["root_source"] == (deck / "presentation.qmd").read_text()
    server.renderer.wait_idle(3)
    headers = {"Content-Type": "application/json", "X-Presentation-Editor-Token": initial["token"]}
    status, result = request(server, "POST", "/__presentation_editor/save", {"revision": initial["revision"], "content": initial["content"].replace("left:10px", "left:19px")}, headers)
    assert status == 200 and result["saved_files"] == ["assets/slides.qmd"]
    server.renderer.wait_idle(3)
    status, rendered = request(server, "GET", "/__presentation_editor/status")
    assert status == 200 and rendered["rendered_revision"] == result["revision"] and rendered["error"] is None
    assert calls[-1][0] == ["test-quarto", "render", "presentation.qmd", "--to", "revealjs"]
    assert calls[-1][1]["cwd"] == deck
    status, html = request(server, "GET", "/presentation.html")
    assert status == 200 and b"window._presentation_rendered_revision=" in html and result["revision"].encode() in html
    assert request(server, "GET", "/../outside.qmd")[0] == 403
    assert request(server, "GET", "/.presentation-editor-backups/")[0] == 403
    status, _ = request(server, "POST", "/__presentation_editor/save", {"revision": result["revision"], "content": initial["content"], "path": "outside.qmd"}, headers)
    assert status == 400


def test_server_saves_unrelated_project_with_custom_source_and_output(tmp_path: Path, monkeypatch) -> None:
    project = tmp_path / "other-project"
    project.mkdir()
    (project / "talk.qmd").write_text("## First\n\n## Second\n", encoding="utf-8")
    (project / "talk.html").write_text("<html><head></head><body>Other deck</body></html>", encoding="utf-8")
    calls = []

    def render(argv, **kwargs):
        calls.append((argv, kwargs))
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(editor.subprocess, "run", render)
    server = editor.PresentationEditServer(
        ("127.0.0.1", 0), project, "test-quarto", startup_render=False,
        source="talk.qmd", output="talk.html",
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, initial = request(server, "GET", "/__presentation_editor/state")
        assert status == 200
        assert initial["root_source"] == "## First\n\n## Second\n"
        headers = {"Content-Type": "application/json", "X-Presentation-Editor-Token": initial["token"]}
        status, result = request(server, "POST", "/__presentation_editor/save", {
            "revision": initial["revision"],
            "content": initial["content"].replace("## Second", "## Edited"),
        }, headers)
        assert status == 200 and result["saved_files"] == ["talk.qmd"]
        server.renderer.wait_idle(3)
        assert (project / "talk.qmd").read_text() == "## First\n\n## Edited\n"
        assert calls[-1][0] == ["test-quarto", "render", "talk.qmd", "--to", "revealjs"]
        status, html = request(server, "GET", "/talk.html")
        assert status == 200 and b"Other deck" in html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


@pytest.mark.parametrize("path", ["/", "/presentation.html?edit=1"])
def test_http_allows_following_cross_site_link_to_deck(running_server, path: str) -> None:
    server, _ = running_server
    headers = {"Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document"}
    status, html = request(server, "GET", path, headers=headers)
    assert status == 200 and b"<body>Deck</body>" in html
    assert b"window._presentation_rendered_revision=" in html


@pytest.mark.parametrize("path,mode,destination", [
    ("/presentation.html", "cors", "empty"),
    ("/presentation.html", "no-cors", "empty"),
    ("/presentation.html", "navigate", "iframe"),
    ("/__presentation_editor/state", "navigate", "document"),
    ("/__presentation_editor/status", "navigate", "document"),
    ("/presentation.qmd", "navigate", "document"),
])
def test_http_navigation_exception_does_not_allow_cross_site_editor_access(running_server, path: str, mode: str, destination: str) -> None:
    server, _ = running_server
    headers = {"Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": mode, "Sec-Fetch-Dest": destination}
    assert request(server, "GET", path, headers=headers)[0] == 403


@pytest.mark.parametrize("header,value", [("Host", "malicious.example"), ("Origin", "https://malicious.example")])
def test_http_deck_navigation_still_rejects_untrusted_host_or_origin(running_server, header: str, value: str) -> None:
    server, _ = running_server
    headers = {"Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", header: value}
    assert request(server, "GET", "/presentation.html", headers=headers)[0] == 403


@pytest.mark.parametrize("change", ["token", "origin", "host", "fetch_site", "schema", "json", "large"])
def test_http_rejects_untrusted_or_malformed_saves(running_server, change: str) -> None:
    server, _ = running_server
    _, state = request(server, "GET", "/__presentation_editor/state")
    body = {"revision": state["revision"], "content": state["content"]}
    headers = {"Content-Type": "application/json", "X-Presentation-Editor-Token": state["token"]}
    expected = 403
    if change == "token":
        headers["X-Presentation-Editor-Token"] = "wrong"
    elif change == "origin":
        headers["Origin"] = "https://malicious.example"
    elif change == "host":
        headers["Host"] = f"malicious.example:{server.server_address[1]}"
    elif change == "fetch_site":
        headers["Sec-Fetch-Site"] = "cross-site"
    elif change == "schema":
        body["content"] = 3
        expected = 400
    elif change == "json":
        body = b"invalid JSON"
        expected = 400
    elif change == "large":
        headers["Content-Length"] = str(editor.MAX_BODY_BYTES + 1)
        body = b""
        expected = 413
    assert request(server, "POST", "/__presentation_editor/save", body, headers)[0] == expected
    assert server.store.refresh().revision == state["revision"]


def test_render_failure_is_reported_without_claiming_current_html(deck: Path, monkeypatch) -> None:
    monkeypatch.setattr(editor.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="", stderr="render failed"))
    server = editor.PresentationEditServer(("127.0.0.1", 0), deck, startup_render=True)
    try:
        server.renderer.wait_idle(3)
        status = server.renderer.status()
        assert status["error"] == "render failed"
        assert status["rendered_revision"] is None
        assert not status["busy"]
    finally:
        server.server_close()


def test_render_and_save_do_not_read_partially_updated_sources(deck: Path, monkeypatch) -> None:
    started = threading.Event()
    release = threading.Event()

    def render(*args, **kwargs):
        started.set()
        assert release.wait(3)
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(editor.subprocess, "run", render)
    store = editor.SourceStore(deck)
    worker = editor.RenderWorker(store, "test-quarto", timeout=3)
    original = store.bundle
    try:
        worker.request()
        assert started.wait(3)
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(store.save, original.revision, original.content.replace("left:10px", "left:85px"))
            assert not future.done()
            assert worker.status()["busy"]
            release.set()
            saved, _ = future.result(timeout=3)
        assert saved.revision != original.revision
        assert worker.status()["rendered_revision"] == original.revision
    finally:
        release.set()
        worker.close()
