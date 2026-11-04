# עוזר תיעוד מטוס — Offline Aircraft Documentation Assistant

Offline, Hebrew-interface iPad web app. You ask a question and get verbatim passages from the installed aircraft PDFs, with document, revision, section and printed page, plus a one-tap view of the original page. No internet, no cloud AI, no LLM.

- Install: `docs/INSTALLATION.md` · Updates: `docs/UPDATE_PROCESS.md`
- Design: `docs/ARCHITECTURE.md` · Tests: `docs/TEST_PLAN.md` · Security: `docs/SECURITY.md` · LLM: `docs/LLM_FEASIBILITY.md`

Developer quick start:
```bash
npm install
node tools/build-index.mjs sources/original/*.pdf --out tests/out/index.json
node tests/validate-sources.mjs && node tests/run-golden.mjs && node tests/e2e/e2e.cjs
python3 tools/gen-sw.py   # after any change under app/
```
