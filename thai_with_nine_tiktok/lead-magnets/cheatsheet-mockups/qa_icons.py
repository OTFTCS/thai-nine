#!/usr/bin/env python3
"""
Automated QA for the Thai classifiers cheat sheet data file.

For each (classifier, example) pair in data.json, asks Gemini two questions:
  1. ICON: does the iconSlug pedagogically represent the word?
  2. PAIRING: does the Thai word authentically take this classifier?

Writes a markdown report to icon_qa_report.md. Run before each render to
catch mismatches that would ship to learners.

Usage:
    python3 qa_icons.py              # full QA over all classifiers
    python3 qa_icons.py อัน ต้น      # filter to specific classifiers
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

DIR = Path(__file__).parent
DATA_PATH = DIR / "data.json"
REPORT_PATH = DIR / "icon_qa_report.md"
MODEL_ID = "gemini-2.5-flash"

PROMPT_TEMPLATE = """\
You are QA'ing a Thai classifiers cheat sheet.

Classifier: {classifier_thai} ({classifier_gloss}) — {classifier_description}
Example word: {example_thai} ({example_translit}) = "{example_english}"
iconSlug: "{current_slug}"

Evaluate TWO independent dimensions:

1. ICON: Does the iconSlug depict "{example_english}" pedagogically? Fluent Emoji Flat slug names follow kebab-case Unicode emoji (e.g. "banana" = yellow banana fruit, "palm-tree" = 🌴, "pencil" = yellow pencil). Some slugs are Gemini-generated custom icons (e.g. "banana-tree", "wine-bottle", "eraser") — these are illustrations matching the kebab-case name.

2. PAIRING: In authentic, everyday Thai, does "{example_thai}" actually take the classifier "{classifier_thai}"? If not, what classifier does it take?

Respond STRICTLY as JSON (no markdown fences, no prose):
{{"icon_verdict": "OK" | "MISMATCH", "icon_reason": "<one short sentence>", "suggested_slug": "<alt slug or empty>", "pairing_verdict": "OK" | "WRONG" | "BORDERLINE", "pairing_reason": "<one short sentence>", "authentic_classifier": "<Thai word or empty if OK>"}}\
"""


def load_env() -> None:
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def strip_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if present."""
    text = text.strip()
    fenced = re.match(r"^```(?:json)?\s*([\s\S]*?)```\s*$", text)
    if fenced:
        return fenced.group(1).strip()
    return text


def parse_qa_row(raw: str) -> dict:
    """Parse Gemini's response into a QA row dict. Raises ValueError on failure."""
    cleaned = strip_fences(raw)
    data = json.loads(cleaned)
    for required_key in ("icon_verdict", "pairing_verdict"):
        if required_key not in data:
            raise ValueError(f"Missing '{required_key}' key in response")
    return {
        "icon_verdict": str(data.get("icon_verdict", "ERROR")).upper(),
        "icon_reason": str(data.get("icon_reason", "")),
        "suggested_slug": str(data.get("suggested_slug", "")),
        "pairing_verdict": str(data.get("pairing_verdict", "ERROR")).upper(),
        "pairing_reason": str(data.get("pairing_reason", "")),
        "authentic_classifier": str(data.get("authentic_classifier", "")),
    }


def qa_row(
    client,
    classifier: dict,
    example: dict,
) -> dict:
    """Run QA for a single example. Returns a result dict."""
    slug = example.get("iconSlug", "")
    prompt = PROMPT_TEMPLATE.format(
        classifier_thai=classifier["thai"],
        classifier_gloss=classifier["gloss"],
        classifier_description=classifier["description"],
        example_thai=example["thai"],
        example_translit=example["translit"],
        example_english=example["english"],
        current_slug=slug,
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
    )
    raw = response.text or ""
    try:
        verdicts = parse_qa_row(raw)
    except Exception as exc:
        print(
            f"    PARSE ERROR: {exc}\n    Raw response: {raw[:200]}",
            file=sys.stderr,
        )
        verdicts = {
            "icon_verdict": "ERROR",
            "icon_reason": f"Parse failure: {exc}",
            "suggested_slug": "",
            "pairing_verdict": "ERROR",
            "pairing_reason": f"Parse failure: {exc}",
            "authentic_classifier": "",
            "raw_response": raw,
        }

    return {
        "classifier_thai": classifier["thai"],
        "classifier_gloss": classifier["gloss"],
        "classifier_description": classifier["description"],
        "example_thai": example["thai"],
        "example_translit": example["translit"],
        "example_english": example["english"],
        "current_slug": slug,
        **verdicts,
    }


def build_report(
    results: list[dict],
    total: int,
    icon_ok_count: int,
    icon_mismatch_count: int,
    pairing_ok_count: int,
    pairing_wrong_count: int,
    pairing_borderline_count: int,
    error_count: int,
    filter_glyphs: list[str] | None,
) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines: list[str] = []

    lines.append("# Classifiers Cheat Sheet QA Report")
    lines.append(f"Generated: {now}")
    lines.append("Data source: data.json")
    if filter_glyphs:
        lines.append(f"Filtered to classifiers: {', '.join(filter_glyphs)}")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Total examples: {total}")
    lines.append(f"- Icon OK: {icon_ok_count} / MISMATCH: {icon_mismatch_count}")
    lines.append(
        f"- Pairing OK: {pairing_ok_count} / WRONG: {pairing_wrong_count}"
        f" / BORDERLINE: {pairing_borderline_count}"
    )
    lines.append(f"- Errors: {error_count}")
    lines.append("")

    # ── Icon mismatches ──────────────────────────────────────────────────────
    icon_mismatches = [r for r in results if r["icon_verdict"] == "MISMATCH"]

    lines.append("## Icon mismatches")
    if not icon_mismatches:
        lines.append("None. All checked icons look good.")
    else:
        seen_classifiers: list[str] = []
        grouped: dict[str, list[dict]] = {}
        for r in icon_mismatches:
            key = r["classifier_thai"]
            if key not in grouped:
                grouped[key] = []
                seen_classifiers.append(key)
            grouped[key].append(r)

        for key in seen_classifiers:
            group = grouped[key]
            first = group[0]
            lines.append("")
            lines.append(
                f"### {first['classifier_thai']} ({first['classifier_gloss']}) -- {first['classifier_description']}"
            )
            lines.append("")
            lines.append("| Thai | Translit | English | Current slug | Suggested | Reason |")
            lines.append("|---|---|---|---|---|---|")
            for r in group:
                suggested = r["suggested_slug"] or ""
                reason = r["icon_reason"].replace("|", "\\|")
                lines.append(
                    f"| {r['example_thai']} | {r['example_translit']} | {r['example_english']}"
                    f" | `{r['current_slug']}` | `{suggested}` | {reason} |"
                )

    lines.append("")

    # ── Pairing mismatches ───────────────────────────────────────────────────
    pairing_wrong = [r for r in results if r["pairing_verdict"] == "WRONG"]
    pairing_borderline = [r for r in results if r["pairing_verdict"] == "BORDERLINE"]

    lines.append("## Pairing mismatches")
    if not pairing_wrong and not pairing_borderline:
        lines.append("None. All classifier-word pairings look authentic.")
    else:
        pairing_table_header = (
            "| Thai | Translit | English | Current classifier | Authentic classifier | Reason |"
        )
        pairing_table_sep = "|---|---|---|---|---|---|"

        if pairing_wrong:
            lines.append("")
            lines.append("### WRONG")
            lines.append("")
            lines.append(pairing_table_header)
            lines.append(pairing_table_sep)
            for r in pairing_wrong:
                authentic = r["authentic_classifier"] or ""
                reason = r["pairing_reason"].replace("|", "\\|")
                clf_cell = f"{r['classifier_thai']} ({r['classifier_gloss']})"
                lines.append(
                    f"| {r['example_thai']} | {r['example_translit']} | {r['example_english']}"
                    f" | {clf_cell} | {authentic} | {reason} |"
                )

        if pairing_borderline:
            lines.append("")
            lines.append("### BORDERLINE")
            lines.append("")
            lines.append(pairing_table_header)
            lines.append(pairing_table_sep)
            for r in pairing_borderline:
                authentic = r["authentic_classifier"] or ""
                reason = r["pairing_reason"].replace("|", "\\|")
                clf_cell = f"{r['classifier_thai']} ({r['classifier_gloss']})"
                lines.append(
                    f"| {r['example_thai']} | {r['example_translit']} | {r['example_english']}"
                    f" | {clf_cell} | {authentic} | {reason} |"
                )

    lines.append("")

    # ── Errors ───────────────────────────────────────────────────────────────
    errors = [r for r in results if r.get("icon_verdict") == "ERROR" or r.get("pairing_verdict") == "ERROR"]
    if errors:
        lines.append("## Errors")
        lines.append("")
        for r in errors:
            raw = r.get("raw_response", "")
            lines.append(
                f"- **{r['classifier_thai']} ({r['classifier_gloss']})** -- "
                f"{r['example_thai']} ({r['example_english']}): {r.get('icon_reason', r.get('pairing_reason', ''))}"
            )
            if raw:
                lines.append(f"  Raw response: `{raw[:300]}`")
        lines.append("")

    # ── Passed classifiers summary ────────────────────────────────────────────
    lines.append("## Passed (summary)")
    lines.append("")

    clf_totals: dict[str, dict] = {}
    clf_order: list[str] = []
    for r in results:
        key = r["classifier_thai"]
        if key not in clf_totals:
            clf_order.append(key)
            clf_totals[key] = {
                "gloss": r["classifier_gloss"],
                "icon_ok": 0,
                "pairing_ok": 0,
                "total": 0,
            }
        clf_totals[key]["total"] += 1
        if r["icon_verdict"] == "OK":
            clf_totals[key]["icon_ok"] += 1
        if r["pairing_verdict"] == "OK":
            clf_totals[key]["pairing_ok"] += 1

    all_ok_classifiers = [
        k
        for k in clf_order
        if (
            clf_totals[k]["icon_ok"] == clf_totals[k]["total"]
            and clf_totals[k]["pairing_ok"] == clf_totals[k]["total"]
        )
    ]
    if all_ok_classifiers:
        for k in all_ok_classifiers:
            info = clf_totals[k]
            lines.append(
                f"- {k} ({info['gloss']}): {info['total']}/{info['total']} OK (icon + pairing)"
            )
    else:
        lines.append("No classifiers had a perfect all-OK result on both dimensions.")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    load_env()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found. Set it in ~/src/thai-nine/.env.", file=sys.stderr)
        return 1

    data = json.loads(DATA_PATH.read_text())
    classifiers: list[dict] = data["classifiers"]

    # CLI filter: specific classifier Thai glyphs
    filter_glyphs: list[str] | None = None
    if len(sys.argv) > 1:
        filter_glyphs = sys.argv[1:]
        classifiers = [c for c in classifiers if c["thai"] in filter_glyphs]
        if not classifiers:
            print(
                f"No classifiers matched: {filter_glyphs}. "
                "Check the Thai glyphs match exactly.",
                file=sys.stderr,
            )
            return 1
        print(f"Filtering to {len(classifiers)} classifier(s): {filter_glyphs}")

    # Collect all examples to QA
    all_examples: list[tuple[dict, dict]] = []
    for clf in classifiers:
        for ex in clf.get("examples", []):
            if ex.get("iconSlug"):
                all_examples.append((clf, ex))

    total = len(all_examples)
    if total == 0:
        print("No examples with iconSlug found. Nothing to QA.")
        return 0

    print(f"QA'ing {total} example(s) across {len(classifiers)} classifier(s) via {MODEL_ID}.")

    from google import genai  # noqa: PLC0415

    client = genai.Client(api_key=api_key)

    results: list[dict] = []
    icon_ok_count = 0
    icon_mismatch_count = 0
    pairing_ok_count = 0
    pairing_wrong_count = 0
    pairing_borderline_count = 0
    error_count = 0

    for i, (clf, ex) in enumerate(all_examples, 1):
        slug = ex.get("iconSlug", "")
        result = qa_row(client, clf, ex)
        results.append(result)

        icon_v = result["icon_verdict"]
        pairing_v = result["pairing_verdict"]

        if icon_v == "OK":
            icon_ok_count += 1
            icon_status = "icon OK"
        elif icon_v == "MISMATCH":
            icon_mismatch_count += 1
            icon_status = f"icon MISMATCH: {result['icon_reason']}"
        else:
            error_count += 1
            icon_status = f"icon ERROR: {result['icon_reason']}"

        if pairing_v == "OK":
            pairing_ok_count += 1
            pairing_status = "pairing OK"
        elif pairing_v == "WRONG":
            pairing_wrong_count += 1
            authentic = result["authentic_classifier"]
            pairing_status = (
                f"pairing WRONG: takes {authentic}, not {clf['thai']}"
                if authentic
                else f"pairing WRONG: {result['pairing_reason']}"
            )
        elif pairing_v == "BORDERLINE":
            pairing_borderline_count += 1
            pairing_status = f"pairing BORDERLINE: {result['pairing_reason']}"
        else:
            if icon_v != "ERROR":
                error_count += 1
            pairing_status = f"pairing ERROR: {result['pairing_reason']}"

        print(f"[{i}/{total}] {clf['thai']} {ex['thai']} [{slug}] -> {icon_status} | {pairing_status}")

    # Build and write report
    report = build_report(
        results=results,
        total=total,
        icon_ok_count=icon_ok_count,
        icon_mismatch_count=icon_mismatch_count,
        pairing_ok_count=pairing_ok_count,
        pairing_wrong_count=pairing_wrong_count,
        pairing_borderline_count=pairing_borderline_count,
        error_count=error_count,
        filter_glyphs=filter_glyphs,
    )
    REPORT_PATH.write_text(report)

    print()
    print(
        f"Done. Icon: {icon_ok_count} OK / {icon_mismatch_count} MISMATCH  |  "
        f"Pairing: {pairing_ok_count} OK / {pairing_wrong_count} WRONG / {pairing_borderline_count} BORDERLINE  |  "
        f"Errors: {error_count}"
    )
    print(f"Report written to: {REPORT_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
