/**
 * Lahat ng prompt ng app. Naka-set na PALAGING Taglish ang sagot.
 * Maikli at malinaw dahil maliit na model (1B) ang gamit.
 */

export const SYSTEM_PROMPT = `Ikaw si "Aral AI", isang mabait at matalinong study buddy ng mga estudyanteng Pilipino. Offline ka tumatakbo sa phone nila.

MGA PATAKARAN:
1. PALAGING sumagot sa TAGLISH — halo ng Tagalog at English, gaya ng natural na pananalita ng estudyante sa Pilipinas. Hindi puro English, hindi puro Tagalog.
2. Gumamit ng English para sa technical terms (hal. "photosynthesis", "equation", "noun"), at Tagalog para sa paliwanag.
3. Ipaliwanag nang simple, parang kuya o ate na nagtuturo. Magbigay ng halimbawa kung makakatulong.
4. Maging maikli at diretso. Gumamit ng bullet points o numbered steps kung maraming punto.
5. Kung hindi ka sigurado sa sagot, sabihin mo nang tapat: "Hindi ako sigurado dito, pero..." at payuhan silang i-double check sa libro o sa teacher.
6. Huwag mag-imbento ng facts, pangalan, o petsa.

HALIMBAWA NG TONO:
Tanong: Ano ang photosynthesis?
Sagot: Ang **photosynthesis** ay ang process kung saan gumagawa ng sariling pagkain ang mga halaman. Ginagamit nila ang sunlight, water, at carbon dioxide para makagawa ng glucose (sugar) at oxygen. Kaya importante ang mga halaman — sila ang source ng oxygen na nilalanghap natin!`;

export function docQuestionPrompt(docName: string, excerpts: string[], question: string) {
  const ctx = excerpts.map((e, i) => `[Bahagi ${i + 1}]\n${e}`).join('\n\n');
  return `Ito ang mga bahagi mula sa PDF na "${docName}" na pinag-aaralan ko:

${ctx}

---
Gamit ang mga bahagi sa itaas, sagutin ito sa TAGLISH: ${question}

Kung wala sa mga bahagi ang sagot, sabihin mo na "Mukhang wala ito sa PDF" at saka magbigay ng general na paliwanag kung alam mo.`;
}

export function chunkSummaryPrompt(docName: string, part: number, totalParts: number, text: string) {
  return `Ito ang bahagi ${part} sa ${totalParts} ng PDF na "${docName}":

${text}

---
I-summarize mo ito sa TAGLISH gamit ang 3 hanggang 6 na bullet points. Isama lang ang pinaka-importanteng ideas, terms, at definitions. Huwag nang magdagdag ng intro.`;
}

export function finalSummaryPrompt(docName: string, partials: string[]) {
  return `Ito ang mga summary ng iba't ibang bahagi ng PDF na "${docName}":

${partials.map((p, i) => `Bahagi ${i + 1}:\n${p}`).join('\n\n')}

---
Pagsamahin mo ang mga ito sa isang maayos na reviewer sa TAGLISH na may ganitong format:

**Buod:** (2-3 pangungusap tungkol sa buong topic)

**Mga Key Points:**
- (5 hanggang 8 na pinaka-importanteng punto)

**Mga Dapat Tandaan na Terms:**
- **term** — maikling paliwanag`;
}

export function quizPrompt(docName: string, text: string) {
  return `Ito ang bahagi ng PDF na "${docName}":

${text}

---
Gumawa ng 5 practice questions (multiple choice, A-D) base LANG sa text sa itaas. Isulat sa TAGLISH. Ilagay ang tamang sagot sa dulo ng bawat tanong bilang "Sagot: _".`;
}
