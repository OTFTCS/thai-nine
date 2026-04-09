#!/usr/bin/env python3
"""
timestamp_server.py — Browser-based tap-to-timestamp tool.

Serves a local web page where you can listen to the episode audio and
tap spacebar to mark timestamps for each spoken line. Much nicer than
the terminal version.

Usage:
    python3 youtube/tools/timestamp_server.py \
        --script youtube/examples/YT-S01-E01.json \
        --audio youtube/recordings/YT-S01-E01.m4a

Opens http://localhost:8765 in your browser.
"""

import argparse
import json
import sys
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs
import threading


_script_path: Path = None
_audio_path: Path = None
_script_data: dict = None


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Timestamp Tool — {episode_id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0f1419;
    color: #e7e9ea;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Top bar ── */
  .top-bar {
    background: #1a1f25;
    border-bottom: 1px solid #2f3336;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .top-bar h1 { font-size: 16px; font-weight: 600; color: #e7e9ea; }
  .top-bar .stats { font-size: 13px; color: #71767b; margin-left: auto; }
  .top-bar .stats .done { color: #00ba7c; }

  /* ── Audio controls ── */
  .audio-bar {
    background: #1a1f25;
    border-bottom: 1px solid #2f3336;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .audio-bar audio { flex: 1; height: 36px; }
  .time-display {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 20px;
    color: #ffd54f;
    min-width: 80px;
    text-align: right;
  }

  /* ── Instruction banner ── */
  .instruction {
    background: #1c2733;
    border-bottom: 1px solid #2f3336;
    padding: 14px 24px;
    text-align: center;
    font-size: 15px;
    color: #8899a6;
    flex-shrink: 0;
  }
  .instruction kbd {
    background: #2f3336;
    border: 1px solid #536471;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: monospace;
    color: #ffd54f;
    font-size: 14px;
  }
  .instruction .action { color: #1d9bf0; font-weight: 600; }
  .instruction.recording { background: #1a2e1a; }
  .instruction.recording .action { color: #00ba7c; }
  .instruction.done { background: #2e1a2e; }

  /* ── Line list ── */
  .lines-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    scroll-behavior: smooth;
  }

  .block-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #536471;
    padding: 16px 0 6px 0;
    border-top: 1px solid #2f3336;
  }
  .block-header:first-child { border-top: none; padding-top: 0; }

  .line-row {
    display: flex;
    align-items: flex-start;
    padding: 8px 12px;
    border-radius: 8px;
    margin: 2px 0;
    transition: background 0.15s, opacity 0.15s;
    gap: 12px;
  }
  .line-row.past { opacity: 0.4; }
  .line-row.current {
    background: #1c2733;
    border: 1px solid #1d9bf0;
    opacity: 1;
  }
  .line-row.next { opacity: 0.7; }
  .line-row.future { opacity: 0.35; }
  .line-row.non-spoken { opacity: 0.25; }
  .line-row.non-spoken.current { opacity: 0.5; background: #1a1f25; border-color: #536471; }

  .line-num {
    font-family: monospace;
    font-size: 11px;
    color: #536471;
    min-width: 32px;
    padding-top: 3px;
  }
  .line-ts {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: #00ba7c;
    min-width: 60px;
    padding-top: 3px;
  }
  .line-ts.empty { color: #2f3336; }

  .line-content { flex: 1; }
  .line-thai {
    font-size: 22px;
    font-weight: 500;
    color: #fff;
    line-height: 1.4;
  }
  .line-translit {
    font-size: 14px;
    color: #ffd54f;
    margin-top: 2px;
  }
  .line-english {
    font-size: 15px;
    color: #b3e5fc;
    line-height: 1.4;
  }
  .line-display-tag {
    font-size: 10px;
    color: #536471;
    background: #2f3336;
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 8px;
  }

  .line-row.current .line-thai { color: #fff; }
  .line-row.current .line-english { color: #b3e5fc; }

  /* ── Next up preview ── */
  .next-preview {
    background: #1a1f25;
    border-top: 1px solid #2f3336;
    padding: 16px 24px;
    flex-shrink: 0;
    min-height: 90px;
  }
  .next-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #536471;
    margin-bottom: 6px;
  }
  .next-text-thai {
    font-size: 28px;
    font-weight: 500;
    color: #fff;
  }
  .next-text-translit {
    font-size: 16px;
    color: #ffd54f;
    margin-top: 2px;
  }
  .next-text-english {
    font-size: 18px;
    color: #b3e5fc;
  }

  /* ── Bottom bar ── */
  .bottom-bar {
    background: #1a1f25;
    border-top: 1px solid #2f3336;
    padding: 10px 24px;
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }
  .btn {
    padding: 8px 16px;
    border: 1px solid #2f3336;
    border-radius: 6px;
    background: #1c2733;
    color: #e7e9ea;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn:hover { background: #2f3336; }
  .btn.primary { background: #1d9bf0; border-color: #1d9bf0; color: #fff; font-weight: 600; }
  .btn.primary:hover { background: #1a8cd8; }
  .btn.danger { background: #f4212e; border-color: #f4212e; color: #fff; }
  .btn.success { background: #00ba7c; border-color: #00ba7c; color: #fff; font-weight: 600; }

  /* Flash animation */
  @keyframes flash-green {
    0% { background: #00ba7c33; }
    100% { background: transparent; }
  }
  .line-row.just-marked {
    animation: flash-green 0.6s ease-out;
  }
</style>
</head>
<body>

<div class="top-bar">
  <h1>Timestamp Tool</h1>
  <span style="color:#536471">{episode_id}</span>
  <div class="stats">
    <span class="done" id="stats-done">0</span>
    / <span id="stats-total">0</span> spoken lines
  </div>
</div>

<div class="audio-bar">
  <audio id="audio" controls preload="auto">
    <source src="/audio" type="audio/mp4">
  </audio>
  <div class="time-display" id="time-display">0.00s</div>
</div>

<div class="instruction" id="instruction">
  Press <kbd>Play</kbd> to start audio, then <kbd>SPACE</kbd> each time Nine starts the highlighted line
</div>

<div class="lines-container" id="lines-container"></div>

<div class="next-preview" id="next-preview">
  <div class="next-label">NEXT UP</div>
  <div id="next-content"></div>
</div>

<div class="bottom-bar">
  <button class="btn" id="btn-undo" disabled>Undo last (Z)</button>
  <button class="btn" id="btn-skip">Skip line (S)</button>
  <div style="flex:1"></div>
  <button class="btn" id="btn-restart" title="Clear all timestamps and start over">Restart</button>
  <button class="btn success" id="btn-save">Save timestamps</button>
</div>

<script>
const SCRIPT_DATA = SCRIPT_DATA_PLACEHOLDER;

// ── Build line model ──
const allLines = [];
const spokenLines = [];

SCRIPT_DATA.blocks.forEach(block => {
  block.lines.forEach((line, li) => {
    const entry = {
      line,
      blockId: block.id,
      blockMode: block.mode,
      lineIdx: allLines.length,
      spoken: isSpoken(line),
      displayStart: line.displayStart ?? null,
      displayEnd: line.displayEnd ?? null,
      marked: line.displayStart != null,
    };
    allLines.push(entry);
    if (entry.spoken) spokenLines.push(entry);
  });
});

function isSpoken(line) {
  if (line.spoken === false) return false;
  const lang = line.lang || '';
  if (lang === 'translit') return false;
  if (lang === 'th' || lang === 'th-split') return !!line.thai;
  if (lang === 'en') return !!line.english;
  if (lang === 'mixed') return !!(line.thai || line.english);
  return false;
}

function getLineText(line) {
  const lang = line.lang || 'th';
  if (lang === 'th') return { thai: line.thai, translit: line.translit, english: line.english };
  if (lang === 'th-split') return { thai: line.thaiSplit || line.thai, translit: line.translit, english: line.english };
  if (lang === 'translit') return { translit: line.translit };
  if (lang === 'en') return { english: line.english };
  if (lang === 'mixed') return { thai: line.thai, english: line.english };
  return { english: line.english || line.thai };
}

// ── State ──
let currentSpokenIdx = 0;
// Find first unmarked spoken line
for (let i = 0; i < spokenLines.length; i++) {
  if (!spokenLines[i].marked) { currentSpokenIdx = i; break; }
  if (i === spokenLines.length - 1) currentSpokenIdx = spokenLines.length;
}

const audio = document.getElementById('audio');
const timeDisplay = document.getElementById('time-display');
const linesContainer = document.getElementById('lines-container');
const instruction = document.getElementById('instruction');
const nextPreview = document.getElementById('next-preview');
const nextContent = document.getElementById('next-content');
const statsTotal = document.getElementById('stats-total');
const statsDone = document.getElementById('stats-done');

statsTotal.textContent = spokenLines.length;

// ── Render lines ──
function renderLines() {
  linesContainer.innerHTML = '';
  let currentBlock = null;

  allLines.forEach((entry, i) => {
    if (entry.blockId !== currentBlock) {
      currentBlock = entry.blockId;
      const header = document.createElement('div');
      header.className = 'block-header';
      header.textContent = `${entry.blockId} — ${entry.blockMode}`;
      linesContainer.appendChild(header);
    }

    const row = document.createElement('div');
    row.className = 'line-row';
    row.id = `line-${i}`;

    if (!entry.spoken) row.classList.add('non-spoken');

    const spIdx = spokenLines.indexOf(entry);
    if (spIdx >= 0 && spIdx < currentSpokenIdx) row.classList.add('past');
    else if (spIdx === currentSpokenIdx) row.classList.add('current');
    else if (spIdx === currentSpokenIdx + 1) row.classList.add('next');
    else if (spIdx > currentSpokenIdx + 1) row.classList.add('future');
    else if (!entry.spoken) {
      // Non-spoken: dim unless near current
      row.classList.add('future');
    }

    // Line number
    const num = document.createElement('div');
    num.className = 'line-num';
    num.textContent = entry.spoken ? `${spIdx + 1}` : '';
    row.appendChild(num);

    // Timestamp
    const ts = document.createElement('div');
    ts.className = 'line-ts' + (entry.displayStart == null ? ' empty' : '');
    ts.textContent = entry.displayStart != null ? entry.displayStart.toFixed(2) + 's' : '—';
    ts.id = `ts-${i}`;
    row.appendChild(ts);

    // Content
    const content = document.createElement('div');
    content.className = 'line-content';
    const texts = getLineText(entry.line);

    if (texts.thai) {
      const d = document.createElement('div');
      d.className = 'line-thai';
      d.textContent = texts.thai;
      content.appendChild(d);
    }
    if (texts.translit) {
      const d = document.createElement('div');
      d.className = 'line-translit';
      d.textContent = texts.translit;
      content.appendChild(d);
    }
    if (texts.english) {
      const d = document.createElement('div');
      d.className = 'line-english';
      d.textContent = texts.english;
      content.appendChild(d);
    }

    // Display tag for non-immediate
    const display = entry.line.display || 'immediate';
    if (display !== 'immediate') {
      const tag = document.createElement('span');
      tag.className = 'line-display-tag';
      tag.textContent = display;
      content.appendChild(tag);
    }

    row.appendChild(content);
    linesContainer.appendChild(row);
  });

  updateStats();
  scrollToCurrent();
  updateNextPreview();
}

function updateStats() {
  const done = spokenLines.filter(e => e.marked).length;
  statsDone.textContent = done;
}

function scrollToCurrent() {
  if (currentSpokenIdx >= spokenLines.length) return;
  const entry = spokenLines[currentSpokenIdx];
  const el = document.getElementById(`line-${entry.lineIdx}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateNextPreview() {
  if (currentSpokenIdx >= spokenLines.length) {
    nextContent.innerHTML = '<div style="color:#00ba7c;font-size:18px;font-weight:600">All lines timestamped! Click Save.</div>';
    instruction.className = 'instruction done';
    instruction.innerHTML = 'All done! Click <strong>Save timestamps</strong> to write to file.';
    return;
  }

  const entry = spokenLines[currentSpokenIdx];
  const texts = getLineText(entry.line);
  let html = '';

  if (texts.thai) html += `<div class="next-text-thai">${escHtml(texts.thai)}</div>`;
  if (texts.translit) html += `<div class="next-text-translit">${escHtml(texts.translit)}</div>`;
  if (texts.english) html += `<div class="next-text-english">${escHtml(texts.english)}</div>`;

  nextContent.innerHTML = html;

  instruction.className = 'instruction' + (audio.paused ? '' : ' recording');
  instruction.innerHTML = audio.paused
    ? 'Press <kbd>Play</kbd> to start audio, then <kbd>SPACE</kbd> when Nine starts saying the highlighted line'
    : `<span class="action">Listening...</span> Press <kbd>SPACE</kbd> when Nine starts: <strong>${escHtml((texts.thai || texts.english || '').substring(0, 40))}</strong>`;
}

function escHtml(s) {
  return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
}

// ── Mark timestamp ──
function markTimestamp() {
  if (currentSpokenIdx >= spokenLines.length) return;
  if (audio.paused) return;

  const ts = audio.currentTime;
  const entry = spokenLines[currentSpokenIdx];
  entry.displayStart = ts;
  entry.line.displayStart = ts;
  entry.marked = true;

  // Flash the row
  const row = document.getElementById(`line-${entry.lineIdx}`);
  if (row) {
    row.classList.remove('current');
    row.classList.add('past', 'just-marked');
    setTimeout(() => row.classList.remove('just-marked'), 600);
  }

  // Update timestamp display
  const tsEl = document.getElementById(`ts-${entry.lineIdx}`);
  if (tsEl) {
    tsEl.textContent = ts.toFixed(2) + 's';
    tsEl.className = 'line-ts';
  }

  currentSpokenIdx++;

  // Update next line's classes
  if (currentSpokenIdx < spokenLines.length) {
    const nextEntry = spokenLines[currentSpokenIdx];
    const nextRow = document.getElementById(`line-${nextEntry.lineIdx}`);
    if (nextRow) {
      nextRow.classList.remove('next', 'future');
      nextRow.classList.add('current');
    }
    // And the one after
    if (currentSpokenIdx + 1 < spokenLines.length) {
      const afterEntry = spokenLines[currentSpokenIdx + 1];
      const afterRow = document.getElementById(`line-${afterEntry.lineIdx}`);
      if (afterRow) {
        afterRow.classList.remove('future');
        afterRow.classList.add('next');
      }
    }
  }

  updateStats();
  scrollToCurrent();
  updateNextPreview();
}

// ── Undo ──
function undoLast() {
  if (currentSpokenIdx <= 0) return;
  currentSpokenIdx--;
  const entry = spokenLines[currentSpokenIdx];
  entry.displayStart = null;
  entry.line.displayStart = null;
  entry.marked = false;
  renderLines();
}

// ── Skip ──
function skipLine() {
  if (currentSpokenIdx >= spokenLines.length) return;
  currentSpokenIdx++;
  renderLines();
}

// ── Restart ──
function restartAll() {
  if (!confirm('Clear all timestamps and start over?')) return;
  spokenLines.forEach(e => {
    e.displayStart = null;
    e.line.displayStart = null;
    e.line.displayEnd = null;
    e.marked = false;
  });
  allLines.forEach(e => {
    if (!e.spoken) {
      e.displayStart = null;
      e.line.displayStart = null;
      e.line.displayEnd = null;
    }
  });
  currentSpokenIdx = 0;
  audio.currentTime = 0;
  renderLines();
}

// ── Save ──
async function saveTimestamps() {
  const resp = await fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SCRIPT_DATA),
  });
  if (resp.ok) {
    const result = await resp.text();
    alert(result);
  } else {
    alert('Save failed: ' + await resp.text());
  }
}

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (e.key === ' ' && !e.target.closest('button, input, textarea')) {
    e.preventDefault();
    markTimestamp();
  }
  if (e.key === 'z' || e.key === 'Z') {
    if (!e.target.closest('input, textarea')) undoLast();
  }
  if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
    if (!e.target.closest('input, textarea')) skipLine();
  }
});

// ── Audio time update ──
audio.addEventListener('timeupdate', () => {
  timeDisplay.textContent = audio.currentTime.toFixed(2) + 's';
});
audio.addEventListener('play', updateNextPreview);
audio.addEventListener('pause', updateNextPreview);

// ── Buttons ──
document.getElementById('btn-undo').addEventListener('click', undoLast);
document.getElementById('btn-skip').addEventListener('click', skipLine);
document.getElementById('btn-restart').addEventListener('click', restartAll);
document.getElementById('btn-save').addEventListener('click', saveTimestamps);

// ── Init ──
renderLines();
</script>
</body>
</html>
"""


class TimestampHandler(SimpleHTTPRequestHandler):
    """HTTP handler for the timestamp tool."""

    def do_GET(self):
        if self.path == "/":
            self._serve_html()
        elif self.path == "/audio":
            self._serve_audio()
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/save":
            self._handle_save()
        else:
            self.send_error(404)

    def _serve_html(self):
        global _script_data
        episode_id = _script_data.get("episodeId", "unknown")
        script_json = json.dumps(_script_data, ensure_ascii=False)
        html = HTML_TEMPLATE.replace("{episode_id}", episode_id)
        html = html.replace("SCRIPT_DATA_PLACEHOLDER", script_json)

        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _serve_audio(self):
        global _audio_path
        path = _audio_path
        size = path.stat().st_size

        # Handle range requests for audio seeking
        range_header = self.headers.get("Range")
        if range_header:
            range_val = range_header.strip().split("=")[1]
            start, end = range_val.split("-")
            start = int(start)
            end = int(end) if end else size - 1
            length = end - start + 1

            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", length)
            self.send_header("Content-Type", "audio/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()

            with open(path, "rb") as f:
                f.seek(start)
                self.wfile.write(f.read(length))
        else:
            self.send_response(200)
            self.send_header("Content-Type", "audio/mp4")
            self.send_header("Content-Length", size)
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()

            with open(path, "rb") as f:
                self.wfile.write(f.read())

    def _handle_save(self):
        global _script_path, _script_data
        content_length = int(self.headers["Content-Length"])
        body = self.rfile.read(content_length)

        try:
            updated_script = json.loads(body)

            # Run auto-computation for delayed lines and displayEnd
            from youtube.tools.timestamp_audio import compute_all_timestamps
            compute_all_timestamps(updated_script)

            _script_data = updated_script

            _script_path.write_text(
                json.dumps(updated_script, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

            timed = sum(
                1 for b in updated_script["blocks"] for l in b["lines"]
                if l.get("displayStart") is not None
            )
            total = sum(len(b["lines"]) for b in updated_script["blocks"])
            msg = f"Saved! {timed}/{total} lines timestamped."
            print(f"  Saved: {_script_path} ({timed}/{total} lines)")

            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            body_bytes = msg.encode("utf-8")
            self.send_header("Content-Length", len(body_bytes))
            self.end_headers()
            self.wfile.write(body_bytes)
        except Exception as e:
            err = str(e)
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            body_bytes = err.encode("utf-8")
            self.send_header("Content-Length", len(body_bytes))
            self.end_headers()
            self.wfile.write(body_bytes)

    def log_message(self, format, *args):
        # Suppress default request logging
        pass


def main():
    global _script_path, _audio_path, _script_data

    parser = argparse.ArgumentParser(
        description="Browser-based tap-to-timestamp tool"
    )
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--audio", required=True, help="Path to audio file (M4A/WAV)")
    parser.add_argument("--port", type=int, default=8765, help="Port (default: 8765)")
    args = parser.parse_args()

    _script_path = Path(args.script).resolve()
    _audio_path = Path(args.audio).resolve()

    if not _script_path.exists():
        print(f"Error: script not found: {_script_path}")
        sys.exit(1)
    if not _audio_path.exists():
        print(f"Error: audio not found: {_audio_path}")
        sys.exit(1)

    _script_data = json.loads(_script_path.read_text(encoding="utf-8"))

    episode_id = _script_data.get("episodeId", "unknown")
    spoken = sum(
        1 for b in _script_data["blocks"] for l in b["lines"]
        if l.get("spoken", True) and l.get("lang", "") not in ("translit",)
        and (l.get("thai") or l.get("english"))
    )

    url = f"http://localhost:{args.port}"
    print(f"\n  Timestamp Tool — {episode_id}")
    print(f"  {spoken} spoken lines to timestamp")
    print(f"  Opening: {url}\n")

    server = HTTPServer(("", args.port), TimestampHandler)

    # Open browser after short delay
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
