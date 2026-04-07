# Google Slides Pipeline — Setup Guide

## One-time setup (~15 minutes)

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name it `thai-with-nine` (or whatever you like)
4. Click **Create**

### 2. Enable the APIs

In your new project:

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Slides API**
   - **Google Drive API** (needed for sharing and folder management)

### 3. Create a service account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service account**
3. Name: `deck-renderer` (or similar)
4. Click **Done** (skip the optional permissions steps)
5. Click on the service account you just created
6. Go to the **Keys** tab
7. Click **Add Key** → **Create new key** → **JSON**
8. Save the downloaded file to: `course/.secrets/gslides-service-account.json`

The `.secrets/` directory is already gitignored. If not, add it:
```
echo "course/.secrets/" >> .gitignore
```

### 4. Share a Drive folder with the service account

The service account has its own Drive — presentations it creates won't be visible to you unless you either:

**Option A (recommended): Create a shared folder**
1. In Google Drive, create a folder called `Thai with Nine — Decks`
2. Right-click → Share → paste the service account email (looks like `deck-renderer@thai-with-nine.iam.gserviceaccount.com`)
3. Give it **Editor** access
4. Copy the folder ID from the URL (the part after `/folders/`)
5. Set `targetDriveFolderId` in `gslides-pipeline-config.json`

**Option B: Auto-share each presentation**
Add your email to the `shareWith` array in `gslides-pipeline-config.json`:
```json
{
  "shareWith": ["otoppo01@googlemail.com"]
}
```

### 5. Install Python dependencies

```bash
pip install google-api-python-client google-auth Pillow --break-system-packages
```

### 6. Update the config

Edit `course/gslides-pipeline-config.json`:
```json
{
  "serviceAccountKeyPath": "course/.secrets/gslides-service-account.json",
  "targetDriveFolderId": "YOUR_FOLDER_ID_HERE",
  "shareWith": ["otoppo01@googlemail.com"],
  "thaiFontFamily": "Noto Sans Thai Looped",
  "latinFontFamily": "Sarabun",
  "translitFontFamily": "Sarabun",
  "teachingAssets": {}
}
```

## Running the pipeline

### Full pipeline (generates deck-source.json → Google Slides)
```bash
STAGE3_MODE=gslides npm run course:stage -- --lesson M01-L001 --stage 3
```

### Direct render (if deck-source.json already exists)
```bash
python3 course/tools/render_gslides.py --repo-root . --lesson M01-L001
```

### Dry run (outputs JSON requests without calling API)
```bash
python3 course/tools/render_gslides.py --repo-root . --lesson M01-L001 --dry-run
```
This writes `M01-L001-gslides-requests.json` to the lesson directory — useful for debugging layout without hitting the API.

### Override service account key path
```bash
python3 course/tools/render_gslides.py --repo-root . --lesson M01-L001 --key /path/to/key.json
```

## Environment variables

| Variable | Effect |
|----------|--------|
| `STAGE3_MODE=gslides` | Force Google Slides output (default if gslides config exists) |
| `STAGE3_MODE=canva` | Force Canva output |
| `STAGE3_MODE=pptx` | Force PPTX output (legacy) |
| `GSLIDES_DRY_RUN=1` | Dry run (no API calls) when running via pipeline-cli |

## Output artifacts

After a successful run, the lesson directory will contain:
- `M01-L001-gslides-design.json` — presentation ID, URL, metadata
- `M01-L001-deck-source.json` — canonical slide spec (format-independent)

## Troubleshooting

**"Service account key not found"**
→ Check `serviceAccountKeyPath` in `gslides-pipeline-config.json` points to the right file

**"403 Forbidden" or "Google Slides API has not been enabled"**
→ Enable the Slides API in your GCP project console

**Presentations created but you can't see them**
→ The service account owns them. Either share a Drive folder with the service account (Option A above) or add your email to `shareWith`

**Thai text not rendering in correct font**
→ Google Slides uses Google Fonts. "Noto Sans Thai Looped" and "Sarabun" are both available. Verify the font family string matches exactly.
