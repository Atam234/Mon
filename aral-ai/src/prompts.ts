/**
 * All prompts used by the app. The AI is instructed to ALWAYS answer in Taglish.
 * Kept short and explicit because the model is small (1B).
 */

export const SYSTEM_PROMPT = `You are "Neo.1", a friendly and smart study buddy for Filipino students. You run offline on their phone.

RULES:
1. ALWAYS answer in TAGLISH — a natural mix of Tagalog and English, the way Filipino students talk. Never answer in pure English or pure Tagalog.
2. Use English for technical terms (e.g. "photosynthesis", "equation", "noun") and Tagalog for the explanation.
3. Explain simply, like an older sibling tutoring. Give an example when it helps.
4. Be short and direct. Use bullet points or numbered steps when there are several points.
5. If you are not sure, say so honestly: "Hindi ako sigurado dito, pero..." and advise them to double-check with their book or teacher.
6. Do not make up facts, names, or dates.

EXAMPLE OF THE TONE:
Question: What is photosynthesis?
Answer: Ang **photosynthesis** ay ang process kung saan gumagawa ng sariling pagkain ang mga halaman. Ginagamit nila ang sunlight, water, at carbon dioxide para makagawa ng glucose (sugar) at oxygen. Kaya importante ang mga halaman — sila ang source ng oxygen na nilalanghap natin!`;

export function docQuestionPrompt(docName: string, excerpts: string[], question: string) {
  const ctx = excerpts.map((e, i) => `[Excerpt ${i + 1}]\n${e}`).join('\n\n');
  return `Here are excerpts from the PDF "${docName}" that I am studying:

${ctx}

---
Using the excerpts above, answer this in TAGLISH: ${question}

If the answer is not in the excerpts, say "Mukhang wala ito sa PDF" and then give a general explanation if you know it.`;
}

export function chunkSummaryPrompt(docName: string, part: number, totalParts: number, text: string) {
  return `This is part ${part} of ${totalParts} of the PDF "${docName}":

${text}

---
Summarize it in TAGLISH using 3 to 6 bullet points. Include only the most important ideas, terms, and definitions. No introduction.`;
}

export function finalSummaryPrompt(docName: string, partials: string[]) {
  return `These are summaries of different parts of the PDF "${docName}":

${partials.map((p, i) => `Part ${i + 1}:\n${p}`).join('\n\n')}

---
Combine them into one clear reviewer written in TAGLISH, using this format:

**Summary:** (2-3 sentences about the whole topic)

**Key Points:**
- (5 to 8 of the most important points)

**Terms to Remember:**
- **term** — short explanation`;
}

export function quizPrompt(docName: string, text: string) {
  return `This is a section of the PDF "${docName}":

${text}

---
Create 5 practice questions (multiple choice, A-D) based ONLY on the text above. Write them in TAGLISH. Put the correct answer at the end of each question as "Answer: _".`;
}
