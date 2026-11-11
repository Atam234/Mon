import { Directory, File, Paths } from 'expo-file-system';
import type { DownloadTask } from 'expo-file-system';

export const MODEL_NAME = 'gemma-3-1b-it-Q8_0.gguf';
/** Approximate size of the Q8_0 file (~1.07 GB). Used for display only. */
export const MODEL_APPROX_BYTES = 1_069_000_000;

/**
 * Download sources for the model, tried in order if one fails.
 * Internet is needed only ONCE (e.g. school Wi-Fi or piso-WiFi).
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

/** Checks that the file is a real GGUF (starts with "GGUF"). */
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
        if (!res || !tmp.exists) throw new Error('The download did not finish.');
        if (!isGguf(tmp)) throw new Error('The downloaded file is not a GGUF model.');
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
    if (cancelled) throw new Error('Download cancelled.');
    throw lastErr instanceof Error ? lastErr : new Error('Could not download the model.');
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
 * Copy a .gguf obtained another way into the app
 * (e.g. shared by a classmate via Bluetooth/ShareMe/USB) — no mobile data needed.
 */
export async function importModelFromUri(uri: string): Promise<string> {
  ensureDir();
  const src = new File(uri);
  if (!isGguf(src)) {
    throw new Error('The selected file is not a valid .gguf model.');
  }
  const dest = modelFile();
  if (dest.exists) dest.delete();
  // If it is in the cache (from the document picker), move it instead of copying to save space.
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
