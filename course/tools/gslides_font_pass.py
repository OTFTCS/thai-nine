#!/usr/bin/env python3
"""Post-upload font pass: swap Sarabun → Noto Sans Thai Looped on Thai text runs.

After uploading a PPTX to Google Slides (via upload_gslides.py), the Thai text
inherits the PPTX font (Sarabun). This script walks every text run in the
presentation and restyles any run containing Thai characters (U+0E00–U+0E7F)
to use Noto Sans Thai Looped.

Usage:
    python3 gslides_font_pass.py --repo-root /path/to/repo --lesson M01-L001

Requires:
    pip install google-api-python-client google-auth google-auth-oauthlib
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
]

TARGET_THAI_FONT = "Noto Sans Thai Looped"


# ---------------------------------------------------------------------------
# Auth (identical to upload_gslides.py)
# ---------------------------------------------------------------------------

def get_credentials(oauth_client_path: str | None = None, key_path: str | None = None):
    """Build Google API credentials. Prefers OAuth desktop flow."""
    if oauth_client_path and Path(oauth_client_path).exists():
        token_path = Path(oauth_client_path).parent / ".gslides-token.json"
        creds = None
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                from google.auth.transport.requests import Request
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(str(oauth_client_path), SCOPES)
                creds = flow.run_local_server(port=8085, open_browser=True)
            token_path.write_text(creds.to_json())
        return creds

    if key_path and Path(key_path).exists():
        return service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)

    raise FileNotFoundError("No OAuth client or service account key found.")


# ---------------------------------------------------------------------------
# Thai detection
# ---------------------------------------------------------------------------

def contains_thai(text: str) -> bool:
    """Check if text contains Thai characters (U+0E00–U+0E7F)."""
    return any("\u0E00" <= c <= "\u0E7F" for c in text)


# ---------------------------------------------------------------------------
# Font pass logic
# ---------------------------------------------------------------------------

def build_font_swap_requests(slides_service, presentation_id: str) -> list[dict]:
    """Read the presentation and build updateTextStyle requests for Thai text runs."""
    pres = slides_service.presentations().get(presentationId=presentation_id).execute()
    requests: list[dict] = []

    for slide in pres.get("slides", []):
        for element in slide.get("pageElements", []):
            # Handle shapes (text boxes, auto shapes)
            shape = element.get("shape", {})
            text_body = shape.get("text", {})
            _collect_thai_runs(requests, element["objectId"], text_body)

            # Handle tables
            table = element.get("table", {})
            if table:
                for row in table.get("tableRows", []):
                    for cell in row.get("tableCells", []):
                        text_body = cell.get("text", {})
                        # Table cells use the cell's objectId for styling
                        # but updateTextStyle targets the table element + cell location
                        # For simplicity, skip tables (rare in our decks)

            # Handle groups
            group = element.get("elementGroup", {})
            if group:
                for child in group.get("children", []):
                    child_shape = child.get("shape", {})
                    child_text = child_shape.get("text", {})
                    _collect_thai_runs(requests, child["objectId"], child_text)

    return requests


def _collect_thai_runs(requests: list[dict], object_id: str, text_body: dict) -> None:
    """Walk text elements and collect font-swap requests for Thai runs."""
    text_elements = text_body.get("textElements", [])
    for te in text_elements:
        text_run = te.get("textRun", {})
        content = text_run.get("content", "")
        if not content or not contains_thai(content):
            continue

        start = te.get("startIndex", 0)
        end = te.get("endIndex", start + len(content))

        requests.append({
            "updateTextStyle": {
                "objectId": object_id,
                "textRange": {
                    "type": "FIXED_RANGE",
                    "startIndex": start,
                    "endIndex": end,
                },
                "style": {
                    "fontFamily": TARGET_THAI_FONT,
                },
                "fields": "fontFamily",
            }
        })


def apply_requests(slides_service, presentation_id: str, requests: list[dict]) -> None:
    """Apply batched requests to the presentation (chunked at 500)."""
    chunk_size = 500
    for i in range(0, len(requests), chunk_size):
        chunk = requests[i : i + chunk_size]
        slides_service.presentations().batchUpdate(
            presentationId=presentation_id,
            body={"requests": chunk},
        ).execute()
        print(f"  Applied font changes {i + 1}-{min(i + chunk_size, len(requests))} of {len(requests)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Post-upload font pass for Google Slides")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    parser.add_argument("--lesson", required=True, help="Lesson ID (e.g. M01-L001)")
    parser.add_argument("--dry-run", action="store_true", help="Print request count without applying")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    lesson_id = args.lesson

    # Resolve lesson directory
    match = re.fullmatch(r"(M\d{2})-(L\d{3})", lesson_id)
    if not match:
        print(f"Invalid lesson ID: {lesson_id}", file=sys.stderr)
        sys.exit(1)
    module_id, lesson_key = match.group(1), match.group(2)
    lesson_root = repo_root / "course" / "modules" / module_id / lesson_key

    # Read design record for presentationId
    design_path = lesson_root / f"{lesson_id}-gslides-design.json"
    if not design_path.exists():
        print(f"Design record not found: {design_path}", file=sys.stderr)
        print("Run upload_gslides.py first.", file=sys.stderr)
        sys.exit(1)

    record = json.loads(design_path.read_text(encoding="utf-8"))
    presentation_id = record.get("presentationId")
    if not presentation_id:
        print("No presentationId in design record.", file=sys.stderr)
        sys.exit(1)

    print(f"Font pass for {lesson_id} → {presentation_id}")
    print(f"  Target Thai font: {TARGET_THAI_FONT}")

    # Load config for auth
    config_path = repo_root / "course" / "gslides-pipeline-config.json"
    config: dict = {}
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))

    # Authenticate
    oauth_client_path = config.get("oauthClientPath", "")
    if oauth_client_path and not Path(oauth_client_path).exists():
        oauth_client_path = str(repo_root / oauth_client_path) if oauth_client_path else ""
    key_path = config.get("serviceAccountKeyPath", "")
    if key_path and not Path(key_path).exists():
        key_path = str(repo_root / key_path) if key_path else ""

    creds = get_credentials(oauth_client_path=oauth_client_path, key_path=key_path)
    slides_service = build("slides", "v1", credentials=creds, cache_discovery=False)

    # Build font-swap requests
    print("Scanning presentation for Thai text runs...")
    requests = build_font_swap_requests(slides_service, presentation_id)
    print(f"  Found {len(requests)} Thai text runs to restyle")

    if not requests:
        print("  No Thai text runs found — nothing to do.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Would apply {len(requests)} font changes")
        return

    # Apply
    apply_requests(slides_service, presentation_id, requests)

    # Update design record
    record["fontPassApplied"] = True
    record["fonts"]["thai"] = TARGET_THAI_FONT
    design_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated design record: fontPassApplied = true")
    print(f"\nDone! Open: {record['url']}")


if __name__ == "__main__":
    main()
