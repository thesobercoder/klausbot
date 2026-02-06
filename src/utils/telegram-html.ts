/**
 * Convert Markdown to Telegram HTML format using markdown-it
 *
 * Telegram HTML supports: <b>, <i>, <u>, <s>, <code>, <pre>, <a>, <blockquote>, <tg-spoiler>
 * See: https://core.telegram.org/bots/api#html-style
 *
 * Uses markdown-it for robust parsing (same parser as OpenClaw), with a custom
 * renderer that emits only Telegram-compatible HTML tags.
 */

import MarkdownIt from "markdown-it";

/** Shared markdown-it instance with GFM tables enabled */
const md = new MarkdownIt({ linkify: true }).enable("table");

/**
 * Escape HTML entities to prevent injection
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape for use inside href="..." attributes */
function escapeAttr(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ── Custom Telegram HTML renderer ──────────────────────────────────────────

// Override block rules
md.renderer.rules.heading_open = (_tokens, idx, _options, _env, _self) => {
  // All headings → bold
  return _tokens[idx].tag === "h1" ? "\n<b>" : "\n<b>";
};
md.renderer.rules.heading_close = () => "</b>\n";

md.renderer.rules.paragraph_open = (_tokens, idx) => {
  // Suppress paragraph newlines inside list items (markdown-it wraps li content in <p>)
  if (idx > 0 && _tokens[idx - 1].type === "list_item_open") return "";
  return "";
};
md.renderer.rules.paragraph_close = (_tokens, idx) => {
  if (idx + 1 < _tokens.length && _tokens[idx + 1].type === "list_item_close")
    return "";
  return "\n";
};

md.renderer.rules.blockquote_open = () => "<blockquote>";
md.renderer.rules.blockquote_close = () => "</blockquote>";

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim();
  const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  return `<pre><code${langAttr}>${escapeHtml(token.content.trimEnd())}</code></pre>\n`;
};

md.renderer.rules.code_block = (tokens, idx) => {
  return `<pre><code>${escapeHtml(tokens[idx].content.trimEnd())}</code></pre>\n`;
};

md.renderer.rules.code_inline = (tokens, idx) => {
  return `<code>${escapeHtml(tokens[idx].content)}</code>`;
};

// Bold / italic
md.renderer.rules.strong_open = () => "<b>";
md.renderer.rules.strong_close = () => "</b>";
md.renderer.rules.em_open = () => "<i>";
md.renderer.rules.em_close = () => "</i>";

// Strikethrough
md.renderer.rules.s_open = () => "<s>";
md.renderer.rules.s_close = () => "</s>";

// Links
md.renderer.rules.link_open = (tokens, idx) => {
  const href = tokens[idx].attrGet("href") ?? "";
  return `<a href="${escapeAttr(href)}">`;
};
md.renderer.rules.link_close = () => "</a>";

// Images → just show alt text as link
md.renderer.rules.image = (tokens, idx) => {
  const src = tokens[idx].attrGet("src") ?? "";
  const alt = tokens[idx].content || "image";
  return `<a href="${escapeAttr(src)}">${escapeHtml(alt)}</a>`;
};

// Softbreak / hardbreak
md.renderer.rules.softbreak = () => "\n";
md.renderer.rules.hardbreak = () => "\n";

// Text — escape HTML
md.renderer.rules.text = (tokens, idx) => escapeHtml(tokens[idx].content);

// Horizontal rule
md.renderer.rules.hr = () => "\n———\n";

// Lists — Telegram has no list tags, render as text with bullets/numbers
md.renderer.rules.bullet_list_open = () => "";
md.renderer.rules.bullet_list_close = () => "\n";
md.renderer.rules.ordered_list_open = (_tokens, idx, _options, env) => {
  env.__orderedCounter = 1;
  return "";
};
md.renderer.rules.ordered_list_close = (_tokens, _idx, _options, env) => {
  delete env.__orderedCounter;
  return "\n";
};
md.renderer.rules.list_item_open = (tokens, idx, _options, env) => {
  // Determine if parent is ordered or bullet
  // Walk backwards to find parent list token
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i].type === "ordered_list_open") {
      const num = env.__orderedCounter ?? 1;
      env.__orderedCounter = num + 1;
      return `${num}. `;
    }
    if (tokens[i].type === "bullet_list_open") {
      return "• ";
    }
  }
  return "• ";
};
md.renderer.rules.list_item_close = () => "\n";

// ── Tables → <pre> monospace ───────────────────────────────────────────────
// Telegram has no <table>. We collect cells during rendering, then emit
// a padded monospace <pre> block on table_close.

md.renderer.rules.table_open = (_tokens, _idx, _options, env) => {
  env.__table = {
    headers: [] as string[],
    rows: [] as string[][],
    currentRow: [] as string[],
  };
  return "";
};

md.renderer.rules.table_close = (_tokens, _idx, _options, env) => {
  const t = env.__table as {
    headers: string[];
    rows: string[][];
    currentRow: string[];
  };
  if (!t) return "";

  const allRows = [t.headers, ...t.rows];
  const colCount = Math.max(...allRows.map((r) => r.length));
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(...allRows.map((r) => (r[i] || "").length)),
  );

  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const fmtRow = (cells: string[]) =>
    cells.map((c, i) => pad(c, colWidths[i])).join("  ");

  const lines = [
    fmtRow(t.headers),
    colWidths.map((w) => "─".repeat(w)).join("  "),
    ...t.rows.map(fmtRow),
  ];

  delete env.__table;
  return `<pre>${escapeHtml(lines.join("\n"))}</pre>\n`;
};

md.renderer.rules.thead_open = () => "";
md.renderer.rules.thead_close = () => "";
md.renderer.rules.tbody_open = () => "";
md.renderer.rules.tbody_close = () => "";
md.renderer.rules.tr_open = (_tokens, _idx, _options, env) => {
  const t = env.__table as { currentRow: string[] } | undefined;
  if (t) t.currentRow = [];
  return "";
};
md.renderer.rules.tr_close = (_tokens, idx, _options, env) => {
  const t = env.__table as
    | { headers: string[]; rows: string[][]; currentRow: string[] }
    | undefined;
  if (!t) return "";
  // First tr_close after thead is header row
  if (t.headers.length === 0) {
    t.headers = [...t.currentRow];
  } else {
    t.rows.push([...t.currentRow]);
  }
  return "";
};
md.renderer.rules.th_open = () => "";
md.renderer.rules.th_close = () => "";
md.renderer.rules.td_open = () => "";
md.renderer.rules.td_close = () => "";

// Override render() to intercept inline tokens inside table context.
// markdown-it hardcodes `type === 'inline'` → renderInline(), bypassing rules,
// so we must patch render() itself.
const origRender = md.renderer.render.bind(md.renderer);
md.renderer.render = function (tokens, options, env) {
  let result = "";
  const rules = this.rules;

  for (let i = 0, len = tokens.length; i < len; i++) {
    const type = tokens[i].type;

    if (type === "inline") {
      const t = env.__table as { currentRow: string[] } | undefined;
      if (t) {
        // Inside table: render inline content, strip HTML, collect as cell
        const cellHtml = this.renderInline(tokens[i].children!, options, env);
        t.currentRow.push(cellHtml.replace(/<[^>]*>/g, ""));
      } else {
        result += this.renderInline(tokens[i].children!, options, env);
      }
    } else if (typeof rules[type] !== "undefined") {
      result += rules[type]!(tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options);
    }
  }

  return result;
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert Markdown to Telegram HTML
 *
 * Uses markdown-it for robust parsing. Handles:
 * - Code blocks, inline code
 * - Bold, italic, strikethrough
 * - Links, images (as links)
 * - Headers → bold
 * - Blockquotes
 * - Ordered/unordered lists → text bullets
 * - Tables → <pre> monospace
 * - Horizontal rules
 */
export function markdownToTelegramHtml(markdown: string): string {
  return md.render(markdown).trim();
}

/**
 * Check if text contains markdown that would benefit from HTML parsing
 */
export function containsMarkdown(text: string): boolean {
  return (
    /```[\s\S]*?```/.test(text) ||
    /`[^`]+`/.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /(?<!\*)\*[^*]+\*(?!\*)/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /^#{1,6}\s+/m.test(text) ||
    /^>\s+/m.test(text) ||
    /^\|.+\|$/m.test(text)
  );
}

/**
 * Split HTML text into chunks that fit Telegram's message size limit.
 * Tries paragraph → sentence → word → hard boundaries.
 */
export function splitTelegramMessage(
  html: string,
  maxLength: number = 4096,
): string[] {
  const chunks: string[] = [];
  let remaining = html;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try paragraph boundary (double newline)
    let splitPoint = remaining.lastIndexOf("\n\n", maxLength);
    if (splitPoint === -1 || splitPoint < maxLength * 0.3) {
      // Try sentence boundary
      splitPoint = remaining.lastIndexOf(". ", maxLength);
    }
    if (splitPoint === -1 || splitPoint < maxLength * 0.3) {
      // Try word boundary
      splitPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitPoint === -1 || splitPoint < maxLength * 0.3) {
      // Hard split
      splitPoint = maxLength;
    }

    chunks.push(remaining.slice(0, splitPoint + 1));
    remaining = remaining.slice(splitPoint + 1);
  }

  return chunks;
}
