import { Directory, File, Paths } from 'expo-file-system';
import type { DownloadTask } from 'expo-file-system';

export const MODEL_NAME = 'gemma-3-1b-it-Q8_0.gguf';
/** Tantiyang laki ng Q8_0 file (~1.07 GB). Pang-display at pang-check lang. */
export const MODEL_APPROX_BYTES = 1_069_000_000;

/**
 * Mga pwedeng pagkunan ng model. Susubukan isa-isa kapag pumalya ang nauna.
 * Kailangan lang ng internet ISANG BESES (hal. sa school Wi-Fi o piso-WiFi).
 */
export const MODEL_URLS = [
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf?download=true',
  'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf?download=true',
  'https://huggingface.co/bartowski/google_gemma-3-1b-it-GGUF/resolve/main/google_gemma-3-1b-it-Q8_0.gguf?download=true',
];

const modelsDir = () => new Directory(Paths.document, 'models');
export const modelFile = () => new File(modelsDir(), MODEL_NAME);
const partFile = () => new File(modelsDir(), MODEL_NAME + '.part');

function ensureDir() {
  const d = modelsDir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

/** Tinitingnan kung ang file ay totoong GGUF (nagsisimula sa "GGUF"). */
export function isGguf(file: File): boolean {
  try {
    const h = file.open();
    const b = h.readBytes(4);
    h.close();
    return b[0] === 0x47 && b[1] === 0x47 && b[2] === 0x55 && b[3] === 0x46;
  } catch {
    return false;
  }
}

export function getInstalledModel(): { path: string; size: number } | null {
  const f = modelFile();
  if (!f.exists) return null;
  if (f.size < 50_000_000 || !isGguf(f)) return null;
  return { path: f.uri, size: f.size };
}

export function deleteModel() {
  for (const f of [modelFile(), partFile()]) {
    if (f.exists) f.delete();
  }
}

export type DownloadHandle = { cancel: () => void; done: Promise<string> };

export function downloadModel(onProgress: (written: number, total: number, source: number) => void): DownloadHandle {
  ensureDir();
  let cancelled = false;
  let current: DownloadTask | null = null;

  const done = (async () => {
    let lastErr: unknown = null;
    for (let i = 0; i < MODEL_URLS.length; i++) {
      if (cancelled) break;
      const tmp = partFile();
      if (tmp.exists) tmp.delete();
      try {
        current = File.createDownloadTask(MODEL_URLS[i], tmp, {
          onProgress: ({ bytesWritten, totalBytes }) =>
            onProgress(bytesWritten, totalBytes > 0 ? totalBytes : MODEL_APPROX_BYTES, i),
        });
        const res = await current.downloadAsync();
        if (cancelled) break;
        if (!res || !tmp.exists) throw new Error('Hindi natapos ang download.');
        if (!isGguf(tmp)) throw new Error('Hindi GGUF ang na-download na file.');
        const dest = modelFile();
        if (dest.exists) dest.delete();
        tmp.move(dest);
        return dest.uri;
      } catch (e) {
        lastErr = e;
      } finally {
        current = null;
      }
    }
    const tmp = partFile();
    if (tmp.exists) tmp.delete();
    if (cancelled) throw new Error('Kinansela ang download.');
    throw lastErr instanceof Error ? lastErr : new Error('Hindi ma-download ang model.');
  })();

  return {
    cancel: () => {
      cancelled = true;
      try {
        current?.cancel();
      } catch {}
    },
    done,
  };
}

/**
 * Kopyahin sa app ang .gguf na nakuha mo sa ibang paraan
 * (hal. pinasa ng kaklase via Bluetooth/ShareMe/USB) — walang load na kailangan.
 */
export async function importModelFromUri(uri: string): Promise<string> {
  ensureDir();
  const src = new File(uri);
  if (!isGguf(src)) {
    throw new Error('Hindi valid na .gguf model file ang napili.');
  }
  const dest = modelFile();
  if (dest.exists) dest.delete();
  // Kung nasa cache (galing sa document picker), ilipat na lang para hindi doble ang space.
  if (src.uri.startsWith(Paths.cache.uri)) src.move(dest);
  else await src.copy(dest);
  return dest.uri;
}

export function formatBytes(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB';
  return n + ' B';
}
