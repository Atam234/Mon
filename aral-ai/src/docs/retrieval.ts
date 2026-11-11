/**
 * Simpleng offline na "search" sa loob ng PDF (BM25) para mahanap ang mga
 * bahaging may kinalaman sa tanong — kasi hindi kasya ang buong PDF sa
 * memory ng maliit na AI model.
 */

export type Chunk = { page: number; text: string };

export function chunkPages(pages: string[], size = 900, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  pages.forEach((raw, idx) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (text.length <= size) {
      chunks.push({ page: idx + 1, text });
      return;
    }
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + size);
      if (end < text.length) {
        const cut = text.lastIndexOf('. ', end);
        if (cut > start + size * 0.5) end = cut + 1;
      }
      chunks.push({ page: idx + 1, text: text.slice(start, end).trim() });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });
  return chunks;
}

const STOPWORDS = new Set(
  (
    'the a an and or of to in on at for is are was were be been it this that these those with as by from what which who whom why how ' +
    'do does did can could would should will not no yes i you he she we they me my your our their its into about than then so if ' +
    'ang ng mga sa na at ay si ni kay ko mo niya namin natin ninyo nila ito iyan iyon dito diyan doon ba po ho din rin lang lamang ' +
    'naman pa para kung kasi dahil pero ano sino saan kailan bakit paano alin ilan may mayroon wala hindi oo yung yun eh nga daw raw ' +
    'akin iyo kanya amin atin inyo kanila siya sila kami tayo kayo ako ikaw ka nito niyan noon explain ipaliwanag tungkol meaning ibig sabihin'
  ).split(/\s+/),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function search(chunks: Chunk[], query: string, topK = 3): Chunk[] {
  const q = Array.from(new Set(tokenize(query)));
  if (!chunks.length) return [];
  if (!q.length) return chunks.slice(0, topK);

  const docs = chunks.map((c) => tokenize(c.text));
  const N = docs.length;
  const avgdl = docs.reduce((a, d) => a + d.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const k1 = 1.4;
  const b = 0.75;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const term of q) {
      // tumanggap din ng bahagyang tugma (hal. "cell" ~ "cells")
      let f = tf.get(term) ?? 0;
      if (!f && term.length > 3) {
        for (const [w, c] of tf) if (w.startsWith(term) || term.startsWith(w)) f += c * 0.5;
      }
      if (!f) continue;
      const n = df.get(term) ?? 1;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgdl)));
    }
    return { i, score };
  });
  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.i);
  if (!top.length) return chunks.slice(0, topK);
  // ibalik sa pagkakasunod sa PDF para mas natural basahin
  return top.sort((a, b) => a - b).map((i) => chunks[i]);
}

/** Hatiin ang text para sa summary (map-reduce). */
export function splitForSummary(pages: string[], from: number, to: number, size = 2800): string[] {
  const text = pages
    .slice(from - 1, to)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const cut = text.lastIndexOf('. ', end);
      if (cut > start + size * 0.6) end = cut + 1;
    }
    parts.push(text.slice(start, end).trim());
    start = end;
  }
  return parts.filter(Boolean);
}
