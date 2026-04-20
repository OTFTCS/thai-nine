"""Generate a Manim scene file for a YouTube episode via Claude CLI.

Takes overlays JSON and produces a complete Python scene file
that renders the episode text overlay.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_YT_DIR = _HERE.parent.parent  # youtube/
_PROMPT_PATH = _YT_DIR / "prompts" / "manim-yt-generation.prompt.md"

MAX_RETRIES = 3


def _preprocess_overlays(overlays_json: str, script_path: Path | None = None) -> str:
    """Pre-process overlays for Manim scene generation.

    Computes manimDuration, handles concurrent overlays, groups
    vocab cards with examples, and enriches with translit/English.
    """
    overlays = json.loads(overlays_json)

    # Load script for enrichment (translit/english lookup)
    script_lines: dict[str, dict] = {}
    vocab_lookup: dict[str, dict] = {}
    if script_path and script_path.exists():
        script = json.loads(script_path.read_text(encoding="utf-8"))
        for block in script.get("blocks", []):
            for line in block.get("lines", []):
                script_lines[line["id"]] = line
        for v in script.get("vocab", []):
            vocab_lookup[v["thai"]] = v

    # --- Pass 1: Compute manimDuration ---
    for i, ov in enumerate(overlays):
        block_id = ov["blockId"]
        start = ov["displayStart"]
        end = ov["displayEnd"]

        next_start = None
        for j in range(i + 1, len(overlays)):
            if overlays[j]["blockId"] == block_id:
                ns = overlays[j]["displayStart"]
                if ns > start + 0.01:
                    next_start = ns
                    break

        if next_start is not None:
            ov["manimDuration"] = round(next_start - start, 2)
        else:
            ov["manimDuration"] = round(end - start, 2)

    # --- Pass 2: Enrich with translit/english from script ---
    for ov in overlays:
        line_data = script_lines.get(ov["lineId"], {})
        if "translit" in line_data and "translit" not in ov:
            ov["translit"] = line_data["translit"]
        if "english" in line_data and "english" not in ov:
            ov["english"] = line_data["english"]
        # Also try vocab lookup by Thai text
        if ov.get("mode") == "vocab-card" and ov.get("lang") == "th":
            v = vocab_lookup.get(ov["text"])
            if v:
                ov.setdefault("translit", v.get("translit", ""))
                ov.setdefault("english", v.get("english", ""))

    # --- Pass 3: Handle concurrent overlays + grouping ---
    _handle_concurrent(overlays)
    _group_vocab_cards(overlays)
    _group_drill_prompts(overlays)
    _group_hook_pairs(overlays)

    # Remove skipped overlays' detail but keep them as markers
    return json.dumps(overlays, ensure_ascii=False, indent=2)


def _handle_concurrent(overlays: list[dict]) -> None:
    """Handle overlays sharing the same displayStart within a block."""
    i = 0
    while i < len(overlays):
        ov = overlays[i]
        if ov.get("skipInScene"):
            i += 1
            continue

        # Find concurrent overlays (same block, same displayStart)
        concurrent = [ov]
        for j in range(i + 1, len(overlays)):
            oj = overlays[j]
            if oj["blockId"] != ov["blockId"]:
                break
            if abs(oj["displayStart"] - ov["displayStart"]) < 0.01:
                concurrent.append(oj)
            else:
                break

        if len(concurrent) <= 1:
            i += 1
            continue

        mode = ov["mode"]

        # 3a: Explain mode — skip Thai if it's a substring of English
        if mode == "explain":
            en_ovs = [c for c in concurrent if c.get("lang") == "en"]
            th_ovs = [c for c in concurrent if c.get("lang") == "th"]
            for th in th_ovs:
                for en in en_ovs:
                    if th["text"] in en["text"]:
                        th["skipInScene"] = True
                        break

        # 3b: Shadowing — split duration evenly
        elif mode == "shadowing":
            total_dur = concurrent[0]["manimDuration"]
            per_item = round(total_dur / len(concurrent), 2)
            for c in concurrent:
                c["manimDuration"] = per_item

        i += len(concurrent)


def _group_vocab_cards(overlays: list[dict]) -> None:
    """Group vocab-card overlays: primary word + example sentence."""
    for i, ov in enumerate(overlays):
        if ov.get("skipInScene") or ov.get("mode") != "vocab-card":
            continue
        if ov.get("fadeIn", False):
            continue  # This is an example, not a primary

        # Look ahead for the next overlay in this block
        for j in range(i + 1, len(overlays)):
            oj = overlays[j]
            if oj["blockId"] != ov["blockId"]:
                break
            if oj.get("skipInScene"):
                continue

            if oj.get("fadeIn", False) and oj.get("mode") == "vocab-card":
                # This is the example sentence for the current primary
                ov["exampleText"] = oj["text"]
                ov["exampleDelay"] = round(
                    oj["displayStart"] - ov["displayStart"], 2
                )
                oj["skipInScene"] = True

                # Extend primary's manimDuration to next fadeIn=false
                next_primary_start = None
                for k in range(j + 1, len(overlays)):
                    ok = overlays[k]
                    if ok["blockId"] != ov["blockId"]:
                        break
                    if not ok.get("fadeIn", False) and not ok.get("skipInScene"):
                        next_primary_start = ok["displayStart"]
                        break
                if next_primary_start is not None:
                    ov["manimDuration"] = round(
                        next_primary_start - ov["displayStart"], 2
                    )
                else:
                    # Last group in block — use displayEnd
                    ov["manimDuration"] = round(
                        ov["displayEnd"] - ov["displayStart"], 2
                    )
                break
            elif not oj.get("fadeIn", False):
                # Next is another primary — current has no example
                break


def _group_drill_prompts(overlays: list[dict]) -> None:
    """Merge drill-prompt question + 'Try saying it now...' into one."""
    for i, ov in enumerate(overlays):
        if ov.get("skipInScene") or ov.get("mode") != "drill-prompt":
            continue

        # Look for "Try saying it now..." in the same block
        for j in range(i + 1, len(overlays)):
            oj = overlays[j]
            if oj["blockId"] != ov["blockId"]:
                break
            if oj.get("mode") == "drill-prompt" and "try" in oj["text"].lower():
                ov["tryDelay"] = round(
                    oj["displayStart"] - ov["displayStart"], 2
                )
                # Extend duration to cover both
                ov["manimDuration"] = round(
                    oj["displayEnd"] - ov["displayStart"], 2
                )
                oj["skipInScene"] = True
                break


def _group_hook_pairs(overlays: list[dict]) -> None:
    """Merge hook Thai + English into one stacked pair."""
    for i, ov in enumerate(overlays):
        if ov.get("skipInScene") or ov.get("mode") != "hook":
            continue
        if ov.get("lang") != "th":
            continue

        # Look for English within ~2s
        for j in range(i + 1, len(overlays)):
            oj = overlays[j]
            if oj["blockId"] != ov["blockId"]:
                break
            if oj.get("lang") == "en" and not oj.get("skipInScene"):
                gap = oj["displayStart"] - ov["displayStart"]
                if gap < 2.5:
                    ov["englishText"] = oj["text"]
                    ov["englishDelay"] = round(gap, 2)
                    oj["skipInScene"] = True

                    # Extend duration to cover until next overlay
                    next_start = None
                    for k in range(j + 1, len(overlays)):
                        ok = overlays[k]
                        if ok["blockId"] != ov["blockId"]:
                            break
                        if not ok.get("skipInScene"):
                            next_start = ok["displayStart"]
                            break
                    if next_start is not None:
                        ov["manimDuration"] = round(
                            next_start - ov["displayStart"], 2
                        )
                    else:
                        ov["manimDuration"] = round(
                            ov["displayEnd"] - ov["displayStart"], 2
                        )
                    break


def generate_scene(
    overlays_json: str,
    output_path: Path,
    *,
    scene_file: Path | None = None,
    script_path: Path | None = None,
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
    processed_json = _preprocess_overlays(overlays_json, script_path=script_path)
    user_prompt = (
        f"{system_prompt}\n\n"
        f"## Overlays JSON\n\n"
        f"```json\n{processed_json}\n```\n\n"
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

        print(f"  ✓ Scene written to {output_path}")
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

    if "YouTubeOverlay" not in code:
        return "Missing required class 'YouTubeOverlay'"

    if "YouTubeScene" not in code:
        return "Missing required base class 'YouTubeScene'"

    if "def construct" not in code:
        return "Missing 'construct' method"

    if code.count("elapsed") < 3:
        return "Insufficient elapsed tracking (need at least 3 references)"

    return None
