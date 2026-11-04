// Optional, local, on-device chat composer (WebLLM / MLC, runs entirely in the browser via WebGPU).
//
// This is NOT a general chatbot. It is a strict "read and compose" layer on top of the search
// results that already exist: it is only ever shown the passages search() found, is instructed to
// use nothing else, and is never invoked when search found nothing. The exact quoted passages are
// always shown too, unchanged, so a generated sentence can always be checked against its source.
//
// The model itself is NOT bundled with the app (it is 0.7-0.9 GB). It downloads once, on explicit
// user action, directly from Hugging Face onto the device, then is cached by the browser
// (Cache Storage / IndexedDB) and reused fully offline from then on - the same one-time-online
// pattern as installing the app itself. See docs/LLM_FEASIBILITY.md.
import * as webllm from '../vendor/webllm/web-llm.js';

export const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const MODEL_SIZE_MB = 879; // approximate download + runtime memory, per MLC's own listing

const SYSTEM_PROMPT = `You are a citation-only reading assistant for aircraft documentation passages.
Rules you must never break:
1. Use ONLY the passages given to you in this turn. Never use outside knowledge, never invent a fact, a page number, a value, a procedure, or a quote that is not literally present in the given passages.
2. If the passages do not contain an answer to the question, say plainly that the installed documentation does not establish an answer - do not guess, do not improvise, do not generalize from similar items.
3. Never turn the passages into new instructions, recommendations, or troubleshooting steps. Only describe what the passages say.
4. Reply in the same language as the question (Hebrew or English). Keep the answer short: 2-4 sentences.
5. When you state something from a passage, mention which document it is from (by the short name given).`;

export function supportsWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

export async function probeWebGPU() {
  if (!supportsWebGPU()) return { ok: false, reason: 'no-navigator-gpu' };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: 'no-adapter' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

export async function isModelCached() {
  try { return await webllm.hasModelInCache(MODEL_ID); } catch { return false; }
}

export async function clearCachedModel() {
  try { await webllm.deleteModelAllInfoInCache(MODEL_ID); } catch { /* ignore */ }
}

export class Composer {
  constructor() {
    this.engine = null;
    this.state = 'idle'; // idle | loading | ready | error | unsupported
    this.error = null;
  }

  async init(onProgress) {
    if (this.state === 'ready') return;
    const probe = await probeWebGPU();
    if (!probe.ok) { this.state = 'unsupported'; this.error = probe.reason; throw new Error('WebGPU not available: ' + probe.reason); }
    this.state = 'loading';
    try {
      this.engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => onProgress?.(report),
      });
      this.state = 'ready';
    } catch (e) {
      this.state = 'error';
      this.error = String(e?.message || e);
      throw e;
    }
  }

  get ready() { return this.state === 'ready' && !!this.engine; }

  async unload() {
    if (this.engine) { try { await this.engine.unload(); } catch { /* ignore */ } }
    this.engine = null;
    this.state = 'idle';
  }

  // passages: [{ label, text }]  (label e.g. "MMEL · 21-6"); onToken(deltaText) called as tokens stream in.
  // Returns the full generated text, or null if generation was aborted.
  async compose(question, passages, { onToken, signal } = {}) {
    if (!this.ready) throw new Error('composer not ready');
    const context = passages
      .map((p, i) => `[${i + 1}] (${p.label})\n${p.text}`)
      .join('\n\n');
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Passages:\n${context}\n\nQuestion: ${question}` },
    ];
    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: 0.2,
      max_tokens: 260,
      stream: true,
    });
    let full = '';
    for await (const chunk of chunks) {
      if (signal?.aborted) { try { await this.engine.interruptGenerate(); } catch { /* ignore */ } return null; }
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) { full += delta; onToken?.(delta); }
    }
    return full;
  }
}
