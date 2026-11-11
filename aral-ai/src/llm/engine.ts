import { initLlama, type LlamaContext } from 'llama.rn';
import { SYSTEM_PROMPT } from '../prompts';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export const N_CTX = 4096;
const STOP = ['<end_of_turn>', '<eos>', '<start_of_turn>'];

/** Halos 3 characters bawat token (konserbatibo para sa Taglish). */
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
          n_gpu_layers: 0, // CPU lang: pinaka-compatible sa karamihan ng phone
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
          'Hindi ma-load ang model. Baka kulang ang RAM ng phone (kailangan ~2 GB na libre) o sira ang file.\n\n' +
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
   * Mag-generate ng sagot. Ang `history` ay pinuputol para kumasya sa context.
   * Ang `onToken` ay tinatawag na may buong text hanggang ngayon.
   */
  async generate(
    history: ChatMsg[],
    onText: (full: string) => void,
    opts: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    if (!ctx) throw new Error('Hindi pa naka-load ang AI model.');
    if (busy) throw new Error('May sinasagot pa ang AI. Hintayin muna o pindutin ang Stop.');
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
      // Dapat user ang unang mensahe pagkatapos ng system (Gemma template).
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
