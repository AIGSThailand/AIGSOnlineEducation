/** True if text contains CJK ideographs or CJK punctuation. */
export function containsCjk(text: string): boolean {
  return /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(text);
}

export type TextRun = { text: string; cjk: boolean };

/** Split into alternating CJK / non-CJK runs for mixed-font PDF drawing. */
export function splitTextRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let buf = "";
  let bufCjk: boolean | null = null;

  for (const ch of text) {
    const cjk = containsCjk(ch);
    if (bufCjk === null) {
      bufCjk = cjk;
      buf = ch;
      continue;
    }
    if (cjk === bufCjk) {
      buf += ch;
      continue;
    }
    runs.push({ text: buf, cjk: bufCjk });
    buf = ch;
    bufCjk = cjk;
  }

  if (buf.length && bufCjk !== null) {
    runs.push({ text: buf, cjk: bufCjk });
  }
  return runs.length ? runs : [{ text, cjk: false }];
}
