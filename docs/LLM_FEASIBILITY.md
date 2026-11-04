# Local LLM Feasibility — iPad 10th Gen (A14 Bionic) — Preliminary

Status: **Preliminary desk assessment. No LLM in the MVP.** This will be revisited in Phase 6 with on-device measurements.

| Factor | Assessment |
|---|---|
| Hardware | A14 Bionic, **4 GB RAM** (shared with the OS and GPU). In practice an app can use about 2 to 3 GB before iPadOS terminates it. |
| Apple Foundation Models (on-device Apple Intelligence) | **Not available.** It requires Apple Intelligence hardware (A17 Pro / M-series). The A14 is excluded. |
| Core ML | Runs on A14 (CPU/GPU/ANE). Converted LLMs at the 1B scale are possible. ANE use isn't automatic and depends on the operators in the model and how it was converted. Needs a Mac toolchain. |
| llama.cpp (Metal) | Builds for iOS and runs on A14. Realistic model ceiling is **~1–3B parameters at 4-bit** (0.7–2 GB). Expected speed is roughly 5–20 tokens/s, depending on size. **Not measured yet.** |
| Web (WebLLM/WebGPU in Safari) | Not viable on 4 GB with this workload. |
| Quality vs. need | Small models are weak in Hebrew and prone to fluent fabrication. The only safe use would be *extractive* (rephrasing or summarising retrieved passages, with mandatory citations). That adds little over showing the passages verbatim, and it adds risk. |
| Battery/thermal | Sustained GPU inference noticeably drains battery and causes throttling. Acceptable for occasional queries; to be measured. |
| Licensing | Candidate models (Llama 3.2 1B/3B, Qwen2.5 1.5B/3B, Gemma) have their own licences. Distribution inside an organisational app must be reviewed. |

**Preliminary conclusion:** it's technically possible to run a 1–3B model, but it isn't justified for the MVP. The retrieval app is designed with an optional, empty "answer composer" slot, so an LLM could be added later without changing the repository or index. A better near-term AI investment is a small **multilingual embedding model** (about 100 MB) for Hebrew→English semantic retrieval. That will only be added if the Phase 2 tests show the glossary approach isn't enough.
