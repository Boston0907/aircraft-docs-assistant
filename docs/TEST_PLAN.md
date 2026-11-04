# Test Plan

## A. Automated tests (run on a PC after every change)

```bash
npm install                                    # once: pdf.js for the Node harness
node tools/build-index.mjs sources/original/*.pdf --out tests/out/index.json
node tests/validate-sources.mjs                # every passage vs. an independent PDF engine
node tests/run-golden.mjs                      # golden question set
node tests/e2e/e2e.cjs                         # browser: import → ask → view → offline reload
```

### Results — 2026-11-04 (desktop, Chromium, iPad-size viewport 820×1180; documents: MMEL Rev 11, MOPP Rev 11)

| Test | Result |
|---|---|
| Source validation: page exists, printed label appears on the page, passage words appear on the page (checked with poppler `pdftotext`, a different engine from the app's pdf.js) | **1,665 / 1,665 passages pass**, lowest word match 100% |
| Printed page labels found | MMEL 207/208 pages, MOPP 384/396. The pages without one are covers and blank or figure pages. |
| Golden set (30 questions: exact terms, CAS messages, abbreviations, alternative wording, Hebrew, mixed Hebrew/English, multiple documents, document filter, no result, not established, ambiguous) | **30 / 30** |
| Search time (desktop) | median ≈1 ms, max ≈8 ms |
| Import time, both PDFs, 604 pages (desktop) | ≈5 s |
| Index load at startup (desktop) | ≈0.1–0.15 s |
| External network requests during the whole e2e run | **0** |
| Offline reload (network disabled) → app, documents, search and PDF viewer | ✓ |
| Persistence across reload | ✓ |
| JavaScript errors | 0 |

**Not yet tested:** the AFM, AOM and PTH files (too large to bring into the development session), scanned pages (none in the current files), and real Safari/WebKit (Chromium was used).

## A2. Optional AI composer — automated (desktop, stubbed)

Real on-device generation cannot be tested from this development environment: there is no route to Hugging Face (where the model weights live) and no WebGPU in the sandboxed browser used for testing. What *was* tested:

| Test | Result |
|---|---|
| App behavior with AI untouched (default) is unaffected | Full regression suite unchanged: 30/30 golden, 1,665/1,665 validated passages, 0 external requests |
| "Unsupported device" path (no WebGPU — same as any pre-iPadOS-26 device) | Enable button correctly disabled, clear message shown, no crash |
| Generation UI contract (streamed text, labeling, quotes unchanged below it, clean cancel on a new question), using a stand-in composer | Pass |
| **Composer is never invoked when search found nothing** (`notFound`/`unrecognized`) | Confirmed directly: 0 calls, 0 generated-answer boxes |

**Required on the real device** (add to §B/§C once hardware is available): iPadOS version check, real download success/time, tokens/sec, Hebrew output quality, memory stability over several questions, and app behavior if the OS kills the tab for memory pressure.

## B. On-device acceptance (iPad 10th gen) — **required, pending**

Record: iPadOS version ______  date ______  tester ______

| # | Check | Pass/Fail | Notes / measurement |
|---|---|---|---|
| 1 | Installed from Home Screen; Airplane Mode on; app opens | | |
| 2 | Import all 7 PDFs from USB-C drive; all ✓ | | time per file: |
| 3 | Integrity check: all ✓ | | |
| 4 | Revision column matches the authorized revisions | | |
| 5 | Ask the 10 questions in §C. Each opens the cited page, and the page and text match | | |
| 6 | "how to make pizza" → "לא נמצא" (not found) | | |
| 7 | Force-quit the app (app switcher) and reopen in Airplane Mode: documents still there, search works | | |
| 8 | Restart the iPad and reopen in Airplane Mode: still works | | |
| 9 | Open a 60 MB AOM page in the viewer, then go to the next/previous page: no crash | | time to first page: |
| 10 | Startup time (tap icon → able to type) | | sec |
| 11 | Search response time (typical question) | | sec |
| 12 | Storage used (shown at the bottom of 📚 מסמכים) | | MB |
| 13 | Battery: % used during 15 minutes of continuous use | | % |
| 14 | Next day (or after 7+ days) the documents are still installed | | |
| 15 | Portrait and landscape layouts are readable | | |

## C. Questions for on-device spot checks

Run these after the AFM, AOM and PTH are imported. Then extend `tests/golden.json` with answers verified by a pilot from the new documents.

1. שסתום פליטה (outflow valve) → MMEL 21-6 / MOPP 21-6
2. APU generator inoperative → MMEL 24-7 (Standby Inverter) and APU GEN FAIL CAS pages
3. מה זה ADLS? (what is ADLS?) → MOPP F-23
4. AP 1-2 Fail → MMEL 2-10 / MOPP 2-18
5. emergency medical kit → MMEL 25-14 / MOPP 25-18
6. *(AFM)* maximum landing gear extended speed → AFM limitations section
7. *(AFM)* מגבלות רוח צד (crosswind limitations) → AFM limitations
8. *(AOM)* APU start → AOM systems/procedures
9. *(G550 vs GV)* the same question with the G550 filter, then with GV: the correct manual is cited
10. A Hebrew question with a word not in the glossary: shows "⚠ לא ניתן לקבוע" (cannot be established) and lists the unknown word

## D. Source validation for newly imported documents

Run the Node harness on the same PDFs on a PC (`tools/build-index.mjs` + `tests/validate-sources.mjs`). The harness uses the same code as the iPad, so this validates every reference of the new documents. Check the document report's low-text page list for figure and scanned pages and inspect them manually.
