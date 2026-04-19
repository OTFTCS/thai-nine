"""Generate a Manim scene file for a course lesson via Claude CLI.

Takes TimedSlide[] JSON and produces a complete Python scene file
that renders the lesson overlay.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

from .models import TimedSlide

_HERE = Path(__file__).resolve().parent
_COURSE_DIR = _HERE.parent.parent       # course/
_PROMPT_PATH = _COURSE_DIR / "prompts" / "agent-prompts" / "manim-lesson-generation.prompt.md"

MAX_RETRIES = 3


def generate_scene(
    timed_slides_json: str,
    output_path: Path,
    *,
    scene_file: Path | None = None,
) -> Path:
    """Generate a Manim scene file.

    If scene_file is provided, copies it instead of generating.
    Otherwise, calls Claude CLI with the generation prompt.

    Returns path to the scene file.
    """
    if scene_file:
        print(f"  Using existing scene: {scene_file}")
        if scene_file.resolve() != output_path.resolve():
            shutil.copy2(scene_file, output_path)
        return output_path

    print("  Generating Manim scene via Claude CLI...")

    if not shutil.which("claude"):
        raise RuntimeError(
            "claude CLI not found in PATH. Install Claude Code or use --scene-file."
        )

    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = (
        f"{system_prompt}\n\n"
        f"## TimedSlides\n\n"
        f"```json\n{timed_slides_json}\n```\n\n"
        f"Generate the complete Manim scene file now. Output only the Python code."
    )

    last_error: str | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        print(f"  Attempt {attempt}/{MAX_RETRIES}")

        if last_error:
            user_prompt += (
                f"\n\nThe previous attempt had this error:\n{last_error}\n"
                f"Fix it and output the corrected Python file."
            )

        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "-p", user_prompt, "--output-format", "text"],
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
        )

        if result.returncode != 0:
            last_error = result.stderr[:500]
            print(f"  ⚠ Claude CLI failed: {last_error}")
            continue

        code = _extract_python(result.stdout)
        if not code.strip():
            last_error = "Claude returned empty output"
            print(f"  ⚠ {last_error}")
            continue

        output_path.write_text(code, encoding="utf-8")

        error = _validate_scene(output_path)
        if error:
            last_error = error
            print(f"  ⚠ Validation failed: {error}")
            continue

        print(f"  Scene written to {output_path}")
        return output_path

    raise RuntimeError(f"Failed to generate valid scene after {MAX_RETRIES} attempts")


def _extract_python(text: str) -> str:
    """Extract Python code from Claude's response."""
    text = text.strip()

    m = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    m = re.search(r"```\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    return text


def _validate_scene(scene_path: Path) -> str | None:
    """Validate scene file syntax and structure. Returns error or None."""
    code = scene_path.read_text(encoding="utf-8")

    try:
        compile(code, str(scene_path), "exec")
    except SyntaxError as e:
        return f"SyntaxError: {e}"

    if "LessonOverlay" not in code:
        return "Missing required class 'LessonOverlay'"

    if "LessonScene" not in code:
        return "Missing required base class 'LessonScene'"

    if "def construct" not in code:
        return "Missing 'construct' method"

    return None
