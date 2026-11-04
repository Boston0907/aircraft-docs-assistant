# Aircraft Documentation Assistant — Architecture

Status: **MVP built and validated on desktop. Not yet tested on the target iPad.**
Last updated: 2026-11-04

## 1. Decision record

| # | Decision | Why |
|---|---|---|
| D1 | **Offline web app (PWA), installed to the iPad home screen.** No native app. | The owner has no Mac or Apple Developer account, which a native app requires. A PWA needs internet **once**, to load the app code. After that it runs fully offline. |
| D2 | **Indexing happens on the iPad, at import time.** No separate PC pipeline. | There's no Python or PC step for the user. The same JavaScript also runs in Node on a PC (`tools/build-index.mjs`) for testing and validation, so the processing stays repeatable and testable. *This replaces the off-device Python pipeline proposed in Phase 1.* |
| D3 | **Lexical retrieval (BM25) plus controlled query expansion.** No embeddings and no LLM. | The golden set passes 30/30 on the installed documents. Semantic search will be reconsidered only if real Hebrew questions fail. See `LLM_FEASIBILITY.md`. |
| D4 | **Pure JavaScript search engine.** No SQLite/WASM. | It's simpler, has no dependencies, and uses one tokenizer everywhere. On desktop the index builds in about 0.1 s for 1,665 passages and a search takes about 1 ms. |
| D5 | **The original PDF is the authority.** Every answer is verbatim text plus a one-tap original page. | This rules out generated wording that could pass as documentation. |
| D6 | **Optional local LLM added 2026-11-04, strictly grounded (RAG), off by default.** A small model (Llama-3.2-1B, via WebLLM/WebGPU) may rephrase the already-retrieved passages into fluent prose, but is never given anything else and is never invoked when nothing was found. The verbatim quotes (D5) are always still shown, unchanged, below it. See `docs/LLM_FEASIBILITY.md`. |

## 2. Components

```
iPad (Safari, home-screen app, offline)
┌───────────────────────────────────────────────────────────────────────┐
│ A. Chat UI (Hebrew, RTL)              app/index.html, js/app.js       │
│ B. Repository (IndexedDB)             js/store.js                     │
│     docs      — manifest: id, title, revision, SHA-256, pages, report │
│     files     — original PDF bytes, unmodified                        │
│     passages  — indexed passages per document                         │
│ C. Import + indexing                  js/importer.js                  │
│     extract.js   pdf.js → lines with x/y segments, outline, labels    │
│     passages.js  headers/footers, printed page labels, sections,      │
│                  table-column recovery, chunking, abbreviation mining │
│ D. Search + answer                    js/search.js, js/lexicon.js     │
│     BM25 · abbreviations · synonyms · Hebrew→English glossary         │
│     status: found / partial (cannot establish) / notFound / unrecog.  │
│ E. Original-page viewer               js/viewer.js (pdf.js)           │
│ Service worker                        sw.js (caches app code only)    │
└───────────────────────────────────────────────────────────────────────┘
```

An optional LLM is implemented as a separate "answer composer" (`js/llm.js`) that only reads `search()` results — it never touches the repository or the index, and the app is functionally and behaviorally identical with it untouched (verified: full regression suite passes unchanged). It downloads on demand (≈879 MB, from Hugging Face, once) rather than being bundled, and runs fully offline after that.

## 3. Processing details

- **Line reconstruction.** Text items are grouped into visual lines. Wide horizontal gaps start a new *segment*, which keeps table columns apart.
- **Headers and footers.** Two rules are applied. A whole line in the header/footer zone that repeats on ≥20% of pages is removed (digits are ignored when comparing). A single segment is removed only if it repeats **verbatim** and has ≥5 letters. Short values such as `22.`, `A` and `0` are never removed. An earlier, looser rule did delete them; that bug was found during development and fixed.
- **Printed page labels.** Checked in this order: PDF `/PageLabels`; then `PAGE NO. 25-14` / `PAGE NUMBER: 21-10`; then `00-20-00: 3 of 10` (AFM style); then a stand-alone label such as `F-24` or `2 - 18`. Both the printed label and the PDF page index are stored and displayed.
- **Sections.** Taken from the PDF outline (bookmarks), rebuilt as a tree and resolved by page range. Numbered headings found in the text (`25. Equipment/Furnishings`, `00-20-50: …`) add detail.
- **Tables.** Columns are detected from vertical white space ("rivers"). Each table item becomes a passage, made of sub-rows, and each sub-row keeps its cells. Every table passage is flagged, and the UI tells the user to verify column alignment against the original page.
- **Two-column prose** is read one column at a time.
- **Prose passages** never cross a page boundary. They are about 250–1,400 characters and each carries its heading context.
- **Figure, blank and scanned pages** (<100 characters of text) are listed in the document report as needing manual inspection. **OCR is not implemented.** Scanned pages are reported, not guessed at.
- **Abbreviation lists** inside the documents are mined automatically, for example 233 pairs from the MOPP.

## 4. Search and honesty rules

1. The query is split into *concepts*. Hebrew phrases are mapped through the glossary, with prefix and suffix variants. Known English phrases and abbreviations are expanded with their alternatives at weight 0.8.
2. Passages are scored with BM25 (section and heading tokens count at weight 0.6) and multiplied by a coverage factor. Words that appear in each other's company in the passage get a bonus. Table-of-contents pages ×0.45. Fragments under 80 characters ×0.6.
3. **"found"** only if one *content* passage, not a table of contents, contains **every** key concept **and** every Hebrew word was understood. Otherwise the status is **"partial"** ("cannot be reliably established"), shown with a warning. **"notFound"** if nothing matched. **"unrecognized"** if there was nothing searchable.
4. The UI always shows the English terms that were actually searched, and any Hebrew words it didn't understand.
5. Questions about faults add a fixed safety notice. The app never produces instructions.

## 5. Integrity and versions

- SHA-256 is computed for every PDF at import. An identical file is skipped.
- **Revision.** Read from the filename (`REV 45`), the PDF title, and the first pages of text. A disagreement between these is shown at import and in the document list.
- **One revision per document.** Importing a new revision of an already-installed document (same short name) requires confirmation and **atomically** replaces the old file, its index and its manifest entry in a single IndexedDB transaction.
- **Integrity check** (button "בדיקת תקינות"): re-hashes every stored PDF and checks the size, the passage count and that every page reference is in range.
- **Manifest export** (button "ייצוא רשימת מסמכים"): a JSON list of the installed documents and their versions.

## 6. Folder layout

```
app/                 the deployable web app (static files only)
  index.html styles.css manifest.webmanifest sw.js icons/
  js/                app, store, importer, extract, passages, search, lexicon, viewer
  vendor/pdfjs/      pdf.js 4.10.38 legacy build (Apache-2.0) + cmaps + standard fonts
tools/               build-index.mjs (Node harness), gen-sw.py, q.mjs (ad-hoc queries)
tests/               validate-sources.mjs, golden.json + run-golden.mjs, e2e/e2e.cjs
docs/                this file, INSTALLATION, UPDATE_PROCESS, TEST_PLAN, SECURITY, LLM_FEASIBILITY
sources/original/    PDFs for local testing only (git-ignored, never deployed)
```

## 7. Known limitations

- **Not tested on the target iPad yet.** Import speed and memory with the 58–68 MB AOMs are the main unknowns. On desktop, 604 pages took about 5 s. On an A14, expect several times longer, possibly minutes per AOM.
- The AFM, AOM and PTH structures were only seen through a partial text preview. The heuristics are generic, so labels, sections and tables must be checked with `validate-sources.mjs` once those files are imported.
- Hebrew coverage is limited to the glossary (about 180 entries). Unknown Hebrew words lower the status to "partial" and are shown to the user.
- In the viewer, word highlights are positioned by approximation within a text run and can sit slightly off. The quoted-region marker is exact to the line.
- OCR isn't supported. Scanned pages are reported but not searchable.
