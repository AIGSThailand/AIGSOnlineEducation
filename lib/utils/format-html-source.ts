/**
 * Pretty-print HTML fragments for the rich-text source editor.
 * Indents tags for readability; not a full HTML parser.
 */

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const TOKEN_RE = /<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g;

function tagName(token: string): string | null {
  const match = /^<\/?\s*([a-zA-Z0-9:-]+)/.exec(token);
  return match ? match[1].toLowerCase() : null;
}

function isClosingTag(token: string): boolean {
  return /^<\//.test(token);
}

function isSelfClosing(token: string, name: string | null): boolean {
  if (!name) return false;
  if (/\/>$/.test(token)) return true;
  return VOID_TAGS.has(name);
}

/** Indent HTML so source mode is readable. */
export function formatHtmlSource(html: string, indentUnit = "  "): string {
  const input = html.replace(/\r\n/g, "\n").trim();
  if (!input) return "";

  const tokens = input.match(TOKEN_RE);
  if (!tokens) return input;

  const lines: string[] = [];
  let depth = 0;

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;

    if (token.startsWith("<!--")) {
      lines.push(`${indentUnit.repeat(depth)}${token}`);
      continue;
    }

    if (token.startsWith("<")) {
      const name = tagName(token);
      const closing = isClosingTag(token);
      const selfClosing = isSelfClosing(token, name);

      if (closing) {
        depth = Math.max(0, depth - 1);
      }

      lines.push(`${indentUnit.repeat(depth)}${token}`);

      if (!closing && !selfClosing && name) {
        depth += 1;
      }
      continue;
    }

    // Text / mixed content — keep on its own indented line when non-empty
    const text = token.replace(/\s+/g, " ").trim();
    if (text) {
      lines.push(`${indentUnit.repeat(depth)}${text}`);
    }
  }

  return lines.join("\n");
}
