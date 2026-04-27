"""Pure-logic tests for scripts/aggregate_prompt_feedback.py.

DB-backed paths are exercised by the smoke test, not here. These tests cover:
- section rendering (input rows -> markdown)
- footer round-trip (write + parse)
- header dedup behaviour
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from aggregate_prompt_feedback import (  # noqa: E402
    FOOTER_RE,
    build_header,
    read_existing,
    render_section,
    write_notes,
)


SCRIPT_M01 = {
    "id": "11111111-1111-1111-1111-111111111111",
    "script_type": "course",
    "eval_run_id": "2026-04-26-prompt-eval",
    "script_id": "M01-L001",
    "prompt_path": "course/prompts/agent-prompts/stage-1-script-generation.prompt.md",
    "prompt_sha": "abcd12345678",
}


def make_ann(scope, block_id, rating, comment, label=None):
    return {
        "id": f"ann-{block_id or 'overall'}",
        "scope": scope,
        "block_id": block_id,
        "block_label": label,
        "rating": rating,
        "comment": comment,
    }


def test_render_section_overall_and_blocks():
    anns = [
        make_ann("overall", None, "rework", "Hook felt generic."),
        make_ann("block", "S01", "rework", "Needs a personal story.", "Three Core Words"),
        make_ann("block", "S02", "good", "", "Polite Particles"),
        make_ann("block", "S03", "ok", "", "Yes/No"),
    ]
    out = render_section(SCRIPT_M01, anns)
    assert "M01-L001" in out
    assert "Prompt SHA: `abcd12345678`" in out
    assert "Overall: rework" in out
    assert "Hook felt generic." in out
    assert "Rework sections (1):" in out
    assert "`S01` (Three Core Words)" in out
    assert "Needs a personal story." in out
    assert "**Ok (1):**" in out
    assert "**Good (1):**" in out


def test_render_section_overall_only():
    anns = [make_ann("overall", None, "good", "Nailed it.")]
    out = render_section(SCRIPT_M01, anns)
    assert "Overall: good." in out
    assert "Rework sections" not in out
    assert "Ok (" not in out


def test_render_section_no_overall():
    anns = [
        make_ann("block", "S01", "rework", "fix me"),
    ]
    out = render_section(SCRIPT_M01, anns)
    assert "Overall:" not in out
    assert "Rework sections (1)" in out


def test_render_section_unpinned_prompt():
    script = dict(SCRIPT_M01)
    script["prompt_sha"] = ""
    out = render_section(script, [make_ann("overall", None, "good", "ok")])
    assert "Prompt SHA: `(unpinned)`" in out


def test_footer_roundtrip_dedups_repeated_runs():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "notes.md"
        write_notes(path, build_header("course"), [render_section(SCRIPT_M01, [
            make_ann("overall", None, "rework", "first run"),
        ])], all_ids={"id-a", "id-b"})

        text, ids = read_existing(path)
        assert ids == {"id-a", "id-b"}
        assert "first run" in text

        write_notes(path, build_header("course"), [render_section(SCRIPT_M01, [
            make_ann("overall", None, "good", "second run"),
        ])], all_ids={"id-a", "id-b", "id-c"})

        text2, ids2 = read_existing(path)
        assert ids2 == {"id-a", "id-b", "id-c"}
        assert "first run" in text2
        assert "second run" in text2
        assert text2.count("# Course Prompt Feedback Notes") == 1


def test_footer_re_matches_csv_with_spaces():
    sample = "<!-- rolled-up-annotation-ids: id-a, id-b , id-c -->"
    m = FOOTER_RE.search(sample)
    assert m is not None
    parts = {s.strip() for s in m.group(1).split(",")}
    assert parts == {"id-a", "id-b", "id-c"}


if __name__ == "__main__":
    # Tiny inline runner so this is callable as `python3 tests/unit/test_aggregate_prompt_feedback.py`.
    import inspect
    fns = [
        v for k, v in dict(globals()).items()
        if k.startswith("test_") and inspect.isfunction(v)
    ]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  ok  {fn.__name__}")
        except AssertionError as e:
            print(f"  FAIL {fn.__name__}: {e}")
            failed += 1
    print(f"\n{len(fns) - failed} / {len(fns)} passed")
    sys.exit(1 if failed else 0)
