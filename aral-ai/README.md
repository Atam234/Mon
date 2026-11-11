# Neo.1 — Offline Study Buddy

An Android app with a **built-in local AI** — `gemma-3-1b-it-Q8_0` — so students can ask questions
and review **without load, mobile data, or Wi-Fi**. Made for students and anyone who can't afford
data to research online.

- 💬 **Ask** — ask anything about what you're studying. The AI always answers in **Taglish**.
- 📄 **PDFs** — add your modules, handouts, or reviewers (PDF). You can:
  - **Ask about it** — the app finds the most relevant parts of the PDF and the AI answers from them (with page numbers).
  - **Summarize** — creates a reviewer: summary, key points, and terms to remember.
  - **Quiz me** — creates 5 multiple-choice practice questions from the PDF.
- 🧠 **AI Model** — download the model **once**, or **get it from a classmate** (Bluetooth / Nearby Share / USB)
  so you never need internet at all. There's also a button to share the model with others.

Everything runs on the phone — your questions and PDFs are never sent to the internet.

## How it works

| Part | Details |
| --- | --- |
| AI engine | [`llama.rn`](https://github.com/mybigday/llama.rn) (llama.cpp for React Native), CPU only for wide device compatibility |
| Model | Gemma 3 1B Instruct, GGUF Q8_0 (~1.07 GB), 4096-token context |
| Taglish | Set in the system prompt (`src/prompts.ts`): always Taglish, simple, and honest when unsure |
| PDF reading | `pdf.js` bundled inside a hidden WebView — 100% offline (`src/docs/PdfExtractor.tsx`) |
| Questions about a PDF | Offline BM25 search (`src/docs/retrieval.ts`) picks the 3 most relevant passages |
| Summarizing long PDFs | Split into parts → summarize each part → combine into one reviewer |

## Phone requirements

- Android 8.0 or newer, **64-bit (arm64)**
- **3 GB RAM** or more (4 GB recommended)
- About **1.5 GB** of free storage

> Scanned PDFs (images only, no selectable text) can't be read yet.

## Getting the APK

### Option A: GitHub Actions (nothing to install)
1. Go to the repo's **Actions** tab → **Neo.1 — Build Android APK** → **Run workflow**
   (it also runs automatically when anything in `aral-ai/` changes).
2. When it finishes (~10 min), download `neo1-apk` from the run's Artifacts section.
3. Unzip it and install `app-release.apk` on your phone (allow "Install unknown apps").

### Option B: Build on your own computer
Requires Node 22, JDK 17, Android SDK + NDK (Android Studio).

```bash
cd aral-ai
npm install
npm run build:apk
# APK: android/app/build/outputs/apk/release/app-release.apk
```

For development with a phone connected over USB:

```bash
npx expo run:android
```

> This won't work in **Expo Go** because it contains native code (llama.cpp). Use a development build.

## First run

1. Open the app → **AI Model** tab.
2. Choose one:
   - **Download** (~1.07 GB, over Wi-Fi) — one time only, or
   - **Choose a .gguf file** shared by a classmate.
3. Wait for it to load (a few seconds), then go to the **Ask** tab. Everything now works offline!

## Files

```
aral-ai/
├── App.tsx                     # tabs + model loading
├── src/prompts.ts              # Taglish system prompt + summary/quiz/PDF prompts
├── src/llm/engine.ts           # llama.rn wrapper (load, generate, stop)
├── src/llm/model.ts            # download / import / share the GGUF model
├── src/docs/PdfExtractor.tsx   # offline PDF → text (pdf.js in a WebView)
├── src/docs/pdfjsHtml.js       # generated: `npm run gen:pdfjs`
├── src/docs/retrieval.ts       # chunking + BM25 search
├── src/docs/store.ts           # local PDF library
└── src/screens/                # Ask, PDFs, AI Model
```

## Note

This is a small model (1B), so **it can make mistakes**. Use it as a study buddy,
not a replacement for your books or teachers. Double-check important answers.

Model: [Gemma 3](https://ai.google.dev/gemma) by Google — subject to the Gemma Terms of Use.
PDF reader: [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0).
