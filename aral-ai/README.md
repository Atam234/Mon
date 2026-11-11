# 📚 Aral AI — Offline na Study Buddy

Mobile app (Android) na may **built-in na local AI** — `gemma-3-1b-it-Q8_0` — para makapagtanong
at makapag-review kahit **walang load, walang data, walang Wi-Fi**. Ginawa para sa mga estudyante
at sa mga taong walang pang-load para mag-research online.

- 💬 **Tanong** — magtanong ng kahit ano tungkol sa pinag-aaralan mo. Laging **Taglish** ang sagot.
- 📄 **Mga PDF** — ilagay ang module, handout, o reviewer mo (PDF). Pwede mong:
  - **Magtanong tungkol dito** — hahanapin ng app ang mga related na bahagi ng PDF at doon ibabase ng AI ang sagot (may page number pa).
  - **I-summarize** — gagawa ng reviewer: buod, key points, at mga terms na dapat tandaan.
  - **Quiz me** — gagawa ng 5 practice questions (multiple choice) mula sa PDF.
- 🧠 **AI Model** — i-download ang model **isang beses lang**, o **kunin sa kaklase** (Bluetooth / Nearby Share / USB)
  para hindi na kailangan ng internet kahit kailan. May button din para i-share mo ang model sa iba.

Lahat ng processing ay nasa phone mismo — walang pinapadala sa internet ang mga tanong o PDF mo.

## Paano ito gumagana

| Bahagi | Gamit |
| --- | --- |
| AI engine | [`llama.rn`](https://github.com/mybigday/llama.rn) (llama.cpp para sa React Native), CPU lang para compatible sa karamihan ng phone |
| Model | Gemma 3 1B Instruct, GGUF Q8_0 (~1.07 GB), context na 4096 tokens |
| Taglish | Naka-set sa system prompt (`src/prompts.ts`) na laging Taglish ang sagot, simple, at tapat kapag hindi sigurado |
| PDF reading | `pdf.js` na naka-bundle sa loob ng nakatagong WebView — 100% offline (`src/docs/PdfExtractor.tsx`) |
| Tanong sa PDF | Offline na BM25 search (`src/docs/retrieval.ts`) para piliin ang 3 pinaka-related na bahagi ng PDF |
| Summary ng mahabang PDF | Hinahati sa mga bahagi → summary bawat bahagi → pinagsasama sa isang reviewer |

## Requirements ng phone

- Android 8.0 pataas, **64-bit (arm64)**
- **3 GB RAM** pataas (mas maganda kung 4 GB)
- Mga **1.5 GB** na libreng storage

> Ang scanned PDF (picture lang, walang selectable na text) ay hindi pa mababasa.

## Paano kunin ang APK

### Option A: GitHub Actions (walang kailangang i-install)
1. Pumunta sa **Actions** tab ng repo → **Aral AI — Build Android APK** → **Run workflow**
   (awtomatiko rin itong tumatakbo kapag may binago sa `aral-ai/`).
2. Pagkatapos (~15–25 min), i-download ang `aral-ai-apk` sa ilalim ng run.
3. I-install ang `app-release.apk` sa phone (i-allow ang "Install unknown apps").

### Option B: I-build sa sariling computer
Kailangan: Node 22, JDK 17, Android SDK + NDK (Android Studio).

```bash
cd aral-ai
npm install
npm run build:apk
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Para sa development (may phone na naka-USB):

```bash
npx expo run:android
```

> Hindi ito gagana sa **Expo Go** kasi may native code (llama.cpp). Gumamit ng development build.

## Unang gamit

1. Buksan ang app → **AI Model** tab.
2. Piliin ang isa:
   - **I-download** (mga 1.07 GB, sa Wi-Fi) — isang beses lang, o
   - **Pumili ng .gguf file** na ipinasa ng kaklase.
3. Hintayin mag-load (ilang segundo), tapos pumunta sa **Tanong** tab. Offline na lahat!

## Mga file

```
aral-ai/
├── App.tsx                     # tabs + pag-load ng model
├── src/prompts.ts              # Taglish system prompt + mga prompt sa summary/quiz/PDF
├── src/llm/engine.ts           # llama.rn wrapper (load, generate, stop)
├── src/llm/model.ts            # download / import / share ng GGUF model
├── src/docs/PdfExtractor.tsx   # offline PDF → text (pdf.js sa WebView)
├── src/docs/pdfjsHtml.js       # generated: `npm run gen:pdfjs`
├── src/docs/retrieval.ts       # chunking + BM25 search
├── src/docs/store.ts           # local library ng mga PDF
└── src/screens/                # Chat, Mga PDF, AI Model
```

## Paalala

Maliit na model (1B) ito kaya **pwede itong magkamali**. Gamitin ito bilang study buddy,
hindi bilang kapalit ng libro o ng teacher. I-double check ang mga importanteng sagot.

Model: [Gemma 3](https://ai.google.dev/gemma) ng Google — saklaw ng Gemma Terms of Use.
PDF reader: [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0).
