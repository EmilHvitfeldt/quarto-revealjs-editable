#!/usr/bin/env python3
"""Install the built editor extension into any Quarto presentation project."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil


RUNTIME_FILES = (
    "_extension.yml",
    "_schema.yml",
    "_snippets.json",
    "editable.css",
    "editable.js",
    "editable.lua",
    "quill.css",
    "presentation_edit_server.py",
)


def install(project: Path) -> Path:
    source = Path(__file__).resolve().parent
    destination = project.resolve() / "_extensions" / "emilhvitfeldt" / "editable"
    destination.mkdir(parents=True, exist_ok=True)
    for name in RUNTIME_FILES:
        source_file = source / name
        if not source_file.is_file():
            raise FileNotFoundError(f"Build the extension before installing: {source_file}")
        shutil.copy2(source_file, destination / name)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, help="Directory containing the presentation source")
    args = parser.parse_args()
    print(install(args.project))


if __name__ == "__main__":
    main()
