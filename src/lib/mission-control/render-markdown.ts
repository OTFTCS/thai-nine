function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; language: string; lines: string[] }
  | { type: "hr" }
  | { type: "table"; header: string[]; rows: string[][] };

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (_, label: string, href: string) => {
      const safeHref = escapeHtml(href);
      const safeLabel = escapeHtml(label);
      const isExternal = /^https?:\/\//.test(href);
      const extra = isExternal ? ' target="_blank" rel="noreferrer"' : "";
      return `<a href="${safeHref}" class="text-indigo-300 underline underline-offset-2 hover:text-indigo-200"${extra}>${safeLabel}</a>`;
    })
    .replace(/`([^`]+)`/g, (_, code: string) => `<code class="rounded bg-slate-800 px-1.5 py-0.5 text-[0.95em] text-sky-200">${escapeHtml(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => `<strong class="font-semibold text-slate-50">${escapeHtml(value)}</strong>`)
    .replace(/\*([^*]+)\*/g, (_, value: string) => `<em class="italic text-slate-100">${escapeHtml(value)}</em>`);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language, lines: codeLines });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (trimmed.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1] ?? "")) {
      const header = parseTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length) {
        const maybeRow = (lines[index] ?? "").trim();
        if (!maybeRow || !maybeRow.includes("|")) break;
        rows.push(parseTableRow(maybeRow));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        if (!/^[-*]\s+/.test(current)) break;
        items.push(current.replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        if (!/^\d+\.\s+/.test(current)) break;
        items.push(current.replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith("```") ||
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        /^---+$/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed) ||
        (currentTrimmed.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1] ?? ""))
      ) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraphLines });
      continue;
    }

    index += 1;
  }

  return blocks;
}

function headingClass(level: number): string {
  switch (level) {
    case 1:
      return "text-3xl font-semibold tracking-tight text-slate-50";
    case 2:
      return "text-2xl font-semibold tracking-tight text-slate-50";
    case 3:
      return "text-xl font-semibold text-slate-100";
    default:
      return "text-lg font-semibold text-slate-100";
  }
}

export function renderMissionControlMarkdown(markdown: string): string {
  const blocks = parseMarkdown(markdown);

  const html = blocks
    .map((block) => {
      if (block.type === "heading") {
        const level = Math.min(block.level, 6);
        return `<h${level} class="${headingClass(level)}">${renderInline(block.text)}</h${level}>`;
      }

      if (block.type === "paragraph") {
        return `<p class="text-sm md:text-[15px] text-slate-200">${renderInline(block.lines.join(" "))}</p>`;
      }

      if (block.type === "ul") {
        const items = block.items
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join("");
        return `<ul class="list-disc space-y-1 pl-5 text-sm md:text-[15px] text-slate-200">${items}</ul>`;
      }

      if (block.type === "ol") {
        const items = block.items
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join("");
        return `<ol class="list-decimal space-y-1 pl-5 text-sm md:text-[15px] text-slate-200">${items}</ol>`;
      }

      if (block.type === "code") {
        return `<div class="overflow-auto rounded-xl border border-slate-700 bg-slate-950/80"><div class="border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">${escapeHtml(block.language || "code")}</div><pre class="p-4 text-xs leading-6 text-slate-200 whitespace-pre-wrap">${escapeHtml(block.lines.join("\n"))}</pre></div>`;
      }

      if (block.type === "table") {
        const header = block.header
          .map((cell) => `<th class="px-3 py-2 text-left font-semibold text-slate-100">${renderInline(cell)}</th>`)
          .join("");
        const rows = block.rows
          .map(
            (row) =>
              `<tr class="bg-slate-950/20">${row
                .map((cell) => `<td class="px-3 py-2 align-top">${renderInline(cell)}</td>`)
                .join("")}</tr>`
          )
          .join("");
        return `<div class="overflow-auto rounded-xl border border-slate-700 bg-slate-950/40"><table class="min-w-full divide-y divide-slate-800 text-sm text-slate-200"><thead class="bg-slate-900/70"><tr>${header}</tr></thead><tbody class="divide-y divide-slate-800">${rows}</tbody></table></div>`;
      }

      return '<hr class="border-slate-800" />';
    })
    .join("");

  return `<div class="space-y-4 leading-7 text-slate-200">${html}</div>`;
}
