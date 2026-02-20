#!/usr/bin/env python3
"""Convert a local PPTX file into a base64 binary file for insertSlidesFromBase64."""

from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PPTX_DIR = SCRIPT_DIR / "pptxs"
OUTPUT_DIR = SCRIPT_DIR / "output"


def resolve_input_file(file_name: str) -> Path:
    """Resolve a file from pptxs/ and allow optional .pptx extension in CLI."""
    direct_path = PPTX_DIR / file_name
    if direct_path.exists():
        return direct_path

    if not Path(file_name).suffix:
        with_extension = PPTX_DIR / f"{file_name}.pptx"
        if with_extension.exists():
            return with_extension

    raise FileNotFoundError(
        f'Input file "{file_name}" was not found under "{PPTX_DIR}".'
    )


def convert_to_base64_binary(input_path: Path, output_name: str | None = None) -> Path:
    """Read PPTX bytes and write base64 bytes (no data-url prefix) into output/."""
    raw_bytes = input_path.read_bytes()
    base64_bytes = base64.b64encode(raw_bytes)

    output_file_name = output_name or f"{input_path.stem}.bin"
    output_path = OUTPUT_DIR / output_file_name
    output_path.write_bytes(base64_bytes)
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert a PPTX from utils/pptx2base64/pptxs into a base64 binary file "
            "for PowerPoint insertSlidesFromBase64."
        )
    )
    parser.add_argument(
        "file_name",
        help='PPTX file name inside "pptxs" (for example: "quiz.pptx" or "quiz").',
    )
    parser.add_argument(
        "-o",
        "--output",
        help='Output file name inside "output" (default: "<input>.bin").',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    PPTX_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        input_path = resolve_input_file(args.file_name)
        output_path = convert_to_base64_binary(input_path, args.output)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"ERROR: Could not process files: {exc}", file=sys.stderr)
        return 1

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print("Done. The output file contains raw base64 bytes (no prefix).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
