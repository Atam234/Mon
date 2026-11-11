import { initLlama, type LlamaContext } from 'llama.rn';
import { SYSTEM_PROMPT } from '../prompts';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export const N_CTX = 4096;
const STOP = ['<end_of_turn>', '<eos>', '<start_of_turn>'];

/** Roughly 3 characters per token (conservative estimate). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 3);

type Listener = (s: EngineState) => void;
export type EngineState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'ready'; info: string }
  | { status: 'error'; message: string };

let ctx: LlamaContext | null = null;
let loadedPath: string | null = null;
let state: EngineState = { status: 'idle' };
const listeners = new Set<Listener>();
let busy = false;

function setState(s: EngineState) {
  state = s;
  listeners.forEach((l) => l(s));
}

export const engine = {
  getState: () => state,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  isBusy: () => busy,

  async load(path: string) {
    if (ctx && loadedPath === path) return;
    await engine.unload();
    setState({ status: 'loading', progress: 0 });
    try {
      ctx = await initLlama(
        {
          model: path,
          n_ctx: N_CTX,
          n_batch: 512,
          use_mlock: false,
          n_gpu_layers: 0, // CPU only: most compatible across phones
          ctx_shift: true,
        },
        (p) => setState({ status: 'loading', progress: p }),
      );
      loadedPath = path;
      setState({ status: 'ready', info: 'Gemma 3 1B (Q8_0) · offline' });
    } catch (e: any) {
      ctx = null;
      loadedPath = null;
      setState({
        status: 'error',
        message:
          'Could not load the model. The phone may not have enough free RAM (~2 GB needed) or the file may be corrupted.\n\n' +
          String(e?.message ?? e),
      });
      throw e;
    }
  },

  async unload() {
    if (ctx) {
      try {
        await ctx.release();
      } catch {}
    }
    ctx = null;
    loadedPath = null;
    setState({ status: 'idle' });
  },

  async stop() {
    try {
      await ctx?.stopCompletion();
    } catch {}
  },

  /**
   * Generate a reply. `history` is trimmed to fit the context window.
   * `onText` is called with the full text generated so far.
   */
  async generate(
    history: ChatMsg[],
    onText: (full: string) => void,
    opts: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    if (!ctx) throw new Error('The AI model is not loaded yet.');
    if (busy) throw new Error('The AI is still answering. Please wait or tap Stop.');
    busy = true;
    try {
      const maxTokens = opts.maxTokens ?? 700;
      const budget = N_CTX - maxTokens - estimateTokens(SYSTEM_PROMPT) - 64;
      const trimmed: ChatMsg[] = [];
      let used = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const t = estimateTokens(history[i].content) + 8;
        if (used + t > budget && trimmed.length > 0) break;
        trimmed.unshift(history[i]);
        used += t;
      }
      // The first message after the system prompt must be from the user (Gemma template).
      while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();

      let text = '';
      const res = await ctx.completion(
        {
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
          n_predict: maxTokens,
          temperature: opts.temperature ?? 0.6,
          top_k: 64,
          top_p: 0.95,
          min_p: 0.05,
          penalty_repeat: 1.1,
          penalty_last_n: 128,
          stop: STOP,
        },
        (data) => {
          text += data.token;
          onText(clean(text));
        },
      );
      return clean(res.text || text);
    } finally {
      busy = false;
    }
  },
};

function clean(s: string) {
  let out = s;
  for (const w of STOP) out = out.split(w).join('');
  return out.replace(/^\s+/, '');
}
