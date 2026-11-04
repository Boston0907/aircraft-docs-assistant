# Security & Data Handling

## Network

- **No runtime network use.** The page's Content-Security-Policy restricts every fetch, script, style, font and worker to the app's own origin (`connect-src 'self' blob: data:`). The browser itself blocks any call to an external API, analytics service or font host.
- The service worker serves all app files from the on-device cache. It only goes to the network for a file that isn't cached, which happens at first installation or during an app update, and only to the app's own origin.
- Verified in the automated browser test: **0 external requests** during import, search, PDF viewing and offline reload.
- No telemetry, analytics, accounts or cloud AI.

## Data at rest

- PDFs, the index and the manifest are stored in the app's own storage area on the iPad (IndexedDB). They're protected by iPadOS device encryption when the iPad is locked with a passcode. **A device passcode is therefore required.**
- The original PDFs are stored byte-for-byte. SHA-256 is recorded at import and re-verified by the integrity check.
- Questions and the conversation exist in memory only and are lost when the app is closed.

## Documents and licensing — must be resolved before operational use

- The **MOPP** (Gulfstream GAC Doc GV-1) and the **GV AFM** licence terms state that the publications may not be *"stored in any retrieval system"* and that electronic copies may be used *"only on a single computer"* without authorization. This app is a retrieval system.
- Use requires written authorization from the document owner, or confirmation that the operator's existing licence covers this use, plus unit and information-security approval.
- The **MMEL** is an FAA publication.

## Development environment disclosure

- During development, two documents (MMEL Rev 11 and MOPP Rev 11) were downloaded from the owner's Google Drive into a temporary cloud development session, at the owner's request, to build and test the processing. They are git-ignored and are never part of the deployed app.
- The other documents (AFMs, AOMs, PTH) were not downloaded. Only a partial text preview of the GV AFM was read to understand its layout.
- The production workflow needs no cloud step. PDFs go straight from the authorized computer to the iPad over USB-C.

## Hosting the app code

- The host receives only the generic app code (no documents, no indexes, no user data).
- The repository must never contain PDFs. `.gitignore` excludes `sources/`, `tests/out/` and `*.pdf`.

## Safety boundary

- Answers are verbatim passages with source references. The only text the app writes itself is the short status line and summary, which are labelled "סיכום המערכת — אינו ציטוט" (system summary — not a quotation).
- Fault-related questions show a fixed notice: the app doesn't diagnose and doesn't recommend actions.
- The app is a reference aid. It doesn't replace the approved manuals, checklists or procedures.
