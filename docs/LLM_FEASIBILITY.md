# Local LLM Feasibility — iPad 10th Gen (A14 Bionic)

Status: **Implemented as an optional, off-by-default feature (2026-11-04). Real on-device behavior — speed, Hebrew quality, memory stability — is unverified; it has only run in a sandbox with no WebGPU and no route to the model's download host.**

## What changed since the Phase-1 assessment

The original assessment (below, kept for the record) concluded a local LLM wasn't worth the risk for the MVP. Two things changed that conclusion:
1. **Safari shipped WebGPU** — the thing that lets a browser use the GPU for fast inference — in **Safari 26 / iPadOS 26**. Before that, a browser-based model could only use the CPU, which is too slow to feel like a chatbot.
2. **The user explicitly asked for word-by-word generation**, and accepted the one condition that makes it safe for an aviation manual: the model is **never allowed to answer from its own knowledge** — it may only reword the exact passages the search engine already found, and is never invoked when nothing was found.

## What was built

- **Library:** `@mlc-ai/web-llm` 0.2.87 (MLC), vendored into `app/vendor/webllm/` (Apache-2.0), runs entirely client-side via WebGPU.
- **Model:** `Llama-3.2-1B-Instruct-q4f16_1-MLC` — the smallest practical instruction model in MLC's catalog (≈879 MB, the lowest memory footprint of the viable options checked).
- **Off by default.** The app works exactly as before unless the user opens "✦ AI" and explicitly downloads the model. Nothing changes for anyone who doesn't.
- **Download, not bundle.** The 879 MB of weights are not in the app or the Git repository. They're fetched directly from Hugging Face, once, on explicit user action, and then cached by the browser (Cache Storage / IndexedDB) for fully offline reuse after that — the same one-time-online pattern as installing the app itself. This is the one deliberate exception in the Content-Security-Policy's `connect-src` (see `docs/SECURITY.md`).
- **Strictly grounded (RAG), not a free chatbot.** For a `found`/`partial` answer only, the composer is given just the top 3 already-retrieved passages and a system prompt that forbids using anything else, forbids inventing page numbers, procedures or values, and tells it to say plainly when the passages don't answer the question. It is **never called at all** for `notFound`/`unrecognized`/`empty` — verified by test. The exact quoted passages are always shown too, unchanged, directly below the generated text, which is itself labeled "נוסח על ידי מודל שפה מקומי" so it's never confused with the source.
- **Session-scoped activation.** Even after the one-time download, the model has to be switched on again each time the app is opened (a button press, fast since no re-download is needed). It is never auto-loaded at startup, so it can never make the app itself slower or heavier to open for someone not using it.

## What is and isn't verified

**Verified** (automated tests, this session, desktop Chromium):
- The app is byte-for-byte unaffected when AI is untouched: full regression suite (30/30 golden questions, 1,665/1,665 validated source passages, offline reload, 0 external requests) still passes.
- The "unsupported device" path (no WebGPU) is handled gracefully: the enable button is disabled with a clear message, nothing crashes.
- The generation UI contract, using a stand-in composer (since this sandbox has no WebGPU and no network route to Hugging Face): text streams in correctly, is labeled, the source cards remain below it unchanged, and a new question cleanly cancels a prior in-flight generation.
- **The composer is never invoked when search found nothing** — the one rule that matters most here — confirmed directly: `notFound` status produces zero calls to the model and zero generated-answer boxes.

**Not verified — must be checked on the actual iPad:**
- Whether the iPad is even running iPadOS 26+ (unknown at time of writing).
- Real generation speed on the A14 (public benchmarks exist for iPhone 15 Pro/A16 — 18-22 tok/s — and for an M2 Mac, but none for this exact, older chip).
- Whether the iPad's 4 GB of **total, shared** RAM can hold the model (≈2 GB while running, per MLC's own estimate) alongside Safari and the app's own document index without the OS killing the tab. This is the single biggest risk; it may simply not fit.
- Hebrew generation quality. Llama 3.2 1B's publicly listed supported languages do not include Hebrew. It may produce poor or broken Hebrew even though the retrieval and glossary layer behind it (which this model doesn't touch) handles Hebrew questions well. The panel's UI text says this plainly.
- Cold-load time on first activation each session on this hardware.

## Original Phase-1 assessment (superseded on the points above, kept for context)

| Factor | 2026-11-04 (Phase 1) assessment |
|---|---|
| Apple Foundation Models (on-device Apple Intelligence) | Not available — requires A17 Pro/M-series; the A14 is excluded. Still true; unrelated to WebLLM. |
| Core ML | Possible via a native app; not usable from a web page. Unrelated to this feature, which runs in-browser. |
| Safari/WebGPU | At the time, Safari on iOS/iPadOS had no WebGPU at all — a browser LLM was not realistically usable. **This is what changed.** |
| Quality vs. risk | A free-running small model is weak in Hebrew and prone to fluent fabrication — true for a free-form chatbot. The RAG-constrained design built here is the mitigation, not a reversal of this concern. |

## Recommendation going forward

Treat this as **experimental** until tested on the real iPad. If the device turns out to be on an older iPadOS, or the model doesn't fit in 4 GB, the feature simply stays unusable (button disabled) and the app is otherwise unaffected — nothing about the core retrieval product depends on it. Report back: iPadOS version, whether the download/enable succeeds, tokens/sec, and Hebrew output quality, and this document will be updated with real numbers.
