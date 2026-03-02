# Stage 4 — PDF Builder (High Quality)

Input:
- `script-master.json` (canonical)
- `course/pdf-theme-spec.md` (must follow)

Output:
- `pdf.md` (structured source)
- then export to `pdf.pdf` via `npm run course:pdf:lesson -- Mxx-Lyyy`

Requirements:
1. Keep section order from `course/pdf-theme-spec.md`.
2. Include all lesson notes that help memory retention.
3. Every taught phrase appears as Thai + transliteration + English.
4. Transliteration must use inline tone marks only.
5. Use concise spacing-friendly prose (scan-friendly, not walls of text).
6. Include role-play transcript and practical drill reminders.
7. Preserve visual consistency with Immersion Thai with Nine branding.
