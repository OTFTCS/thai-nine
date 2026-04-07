#!/usr/bin/env python3
"""Upload a lesson PPTX to Google Drive and convert to Google Slides.

Uses the existing PPTX output from render_lesson_deck.py (which handles all
layout, positioning, and overflow logic) and converts it to native Google Slides
via the Drive API's built-in PPTX conversion.

Usage:
    python3 upload_gslides.py --repo-root /path/to/repo --lesson M01-L001

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
from googleapiclient.http import MediaFileUpload

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
]

FONT_THAI = "Noto Sans Thai Looped"
FONT_LATIN = "Sarabun"
FONT_TRANSLIT = "Sarabun"


# ---------------------------------------------------------------------------
# Auth (shared with gslides_font_pass.py)
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


def _extract_text_from_element(element: dict) -> str:
    """Extract plain text from a Slides page element."""
    shape = element.get("shape", {})
    text_elements = shape.get("text", {}).get("textElements", [])
    parts = []
    for te in text_elements:
        run = te.get("textRun", {})
        content = run.get("content", "")
        if content:
            parts.append(content)
    return "".join(parts)


# ---------------------------------------------------------------------------
# Upload + convert
# ---------------------------------------------------------------------------

def upload_pptx(drive_service, pptx_path: Path, title: str, folder_id: str | None = None) -> tuple[str, str]:
    """Upload a PPTX file to Google Drive and convert to Google Slides.

    Returns (presentation_id, web_view_link).
    """
    metadata: dict = {
        "name": title,
        "mimeType": "application/vnd.google-apps.presentation",
    }
    if folder_id:
        metadata["parents"] = [folder_id]

    media = MediaFileUpload(
        str(pptx_path),
        mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    result = drive_service.files().create(
        body=metadata, media_body=media, fields="id,webViewLink",
    ).execute()

    return result["id"], result["webViewLink"]


def delete_presentation(drive_service, presentation_id: str) -> bool:
    """Delete an existing presentation from Drive. Returns True on success."""
    try:
        drive_service.files().delete(fileId=presentation_id).execute()
        return True
    except Exception as e:
        print(f"  Warning: could not delete old presentation {presentation_id}: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def verify_upload(
    slides_service,
    presentation_id: str,
    expected_slides: int,
) -> tuple[list[str], dict]:
    """Verify the uploaded presentation. Returns (issues, page_size)."""
    pres = slides_service.presentations().get(presentationId=presentation_id).execute()
    issues: list[str] = []

    # Slide count
    slides = pres.get("slides", [])
    actual = len(slides)
    if actual != expected_slides:
        issues.append(f"Slide count: expected {expected_slides}, got {actual}")

    # Page dimensions
    page_size = pres.get("pageSize", {})
    w = page_size.get("width", {})
    h = page_size.get("height", {})
    print(f"  Page size: {w.get('magnitude', '?')} {w.get('unit', '?')} × {h.get('magnitude', '?')} {h.get('unit', '?')}")

    # Empty slide check
    for i, slide in enumerate(slides):
        elements = slide.get("pageElements", [])
        if len(elements) < 2:
            issues.append(f"Slide {i + 1} may be empty ({len(elements)} elements)")

    # Thai text presence check
    has_thai = False
    for slide in slides:
        for el in slide.get("pageElements", []):
            text = _extract_text_from_element(el)
            if text and contains_thai(text):
                has_thai = True
                break
        if has_thai:
            break
    if not has_thai:
        issues.append("No Thai text found — conversion may have dropped content")

    return issues, page_size


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

def share_presentation(drive_service, presentation_id: str, emails: list[str]) -> None:
    """Share the presentation with specified email addresses."""
    for email in emails:
        try:
            drive_service.permissions().create(
                fileId=presentation_id,
                body={"type": "user", "role": "writer", "emailAddress": email},
                sendNotificationEmail=False,
            ).execute()
            print(f"  Shared with: {email}")
        except Exception as e:
            print(f"  Warning: could not share with {email}: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Upload lesson PPTX to Google Slides")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    parser.add_argument("--lesson", required=True, help="Lesson ID (e.g. M01-L001)")
    parser.add_argument("--pptx-path", help="Override path to PPTX file")
    parser.add_argument("--share-with", action="append", default=[], help="Email to share with (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without calling API")
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

    # Find PPTX file
    if args.pptx_path:
        pptx_path = Path(args.pptx_path)
    else:
        # Try canva-deck first, then plain deck
        pptx_path = lesson_root / f"{lesson_id}-canva-deck.pptx"
        if not pptx_path.exists():
            pptx_path = lesson_root / f"{lesson_id}-deck.pptx"
    if not pptx_path.exists():
        print(f"PPTX not found: {pptx_path}", file=sys.stderr)
        print("Run render_lesson_deck.py first to generate the PPTX.", file=sys.stderr)
        sys.exit(1)
    print(f"Source PPTX: {pptx_path}")

    # Load deck-source for expected slide count
    deck_source_path = lesson_root / f"{lesson_id}-deck-source.json"
    expected_slides = 0
    if deck_source_path.exists():
        deck_source = json.loads(deck_source_path.read_text(encoding="utf-8"))
        expected_slides = len(deck_source.get("slides", []))
    title = f"{lesson_id} — Lesson Deck"

    # Load config
    config_path = repo_root / "course" / "gslides-pipeline-config.json"
    config: dict = {}
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))

    # Check for existing design record (idempotency)
    design_path = lesson_root / f"{lesson_id}-gslides-design.json"
    old_presentation_id = None
    if design_path.exists():
        try:
            old_record = json.loads(design_path.read_text(encoding="utf-8"))
            old_presentation_id = old_record.get("presentationId")
        except (json.JSONDecodeError, KeyError):
            pass

    if args.dry_run:
        print(f"\n[DRY RUN] Would upload: {pptx_path}")
        print(f"[DRY RUN] Title: {title}")
        print(f"[DRY RUN] Expected slides: {expected_slides}")
        if old_presentation_id:
            print(f"[DRY RUN] Would delete old presentation: {old_presentation_id}")
        share_emails = args.share_with or config.get("shareWith", [])
        if share_emails:
            print(f"[DRY RUN] Would share with: {', '.join(share_emails)}")
        return

    # Authenticate
    oauth_client_path = config.get("oauthClientPath", "")
    if oauth_client_path and not Path(oauth_client_path).exists():
        oauth_client_path = str(repo_root / oauth_client_path) if oauth_client_path else ""
    key_path = config.get("serviceAccountKeyPath", "")
    if key_path and not Path(key_path).exists():
        key_path = str(repo_root / key_path) if key_path else ""

    creds = get_credentials(oauth_client_path=oauth_client_path, key_path=key_path)
    drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
    slides_service = build("slides", "v1", credentials=creds, cache_discovery=False)

    # Delete old presentation if re-running
    if old_presentation_id:
        print(f"Deleting previous presentation: {old_presentation_id}")
        delete_presentation(drive_service, old_presentation_id)

    # Upload and convert
    folder_id = config.get("targetDriveFolderId")
    print(f"Uploading {pptx_path.name} to Google Slides...")
    presentation_id, url = upload_pptx(drive_service, pptx_path, title, folder_id)
    print(f"Created presentation: {presentation_id}")
    print(f"\n  >> {url}\n")

    # Verify
    if expected_slides > 0:
        print("Verifying upload...")
        issues, page_size = verify_upload(slides_service, presentation_id, expected_slides)
        if issues:
            for issue in issues:
                print(f"  ⚠ {issue}", file=sys.stderr)
        else:
            print("  All checks passed.")

    # Share
    share_emails = args.share_with or config.get("shareWith", [])
    if share_emails:
        share_presentation(drive_service, presentation_id, share_emails)

    # Write design record
    record = {
        "schemaVersion": 2,
        "lessonId": lesson_id,
        "presentationId": presentation_id,
        "url": url,
        "slideCount": expected_slides,
        "pipeline": "pptx-upload-convert",
        "sourcePptx": pptx_path.name,
        "fonts": {
            "thai": FONT_THAI,
            "latin": FONT_LATIN,
            "translit": FONT_TRANSLIT,
        },
        "fontPassApplied": False,
    }
    design_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote design record: {design_path}")
    print(f"\nDone! Open: {url}")


if __name__ == "__main__":
    main()
