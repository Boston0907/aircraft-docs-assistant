# Update Process

## A. New revision of a document (offline)

1. Obtain the new revision through the authorized channel. Keep the revision in the filename, e.g. `G550 AFM REV 45.pdf`.
2. Copy it to the USB-C drive and import it the same way as in INSTALLATION §3.
3. The app identifies it as the same document (same short name, e.g. `G550 AFM`) and asks: **"להחליף אותו בגרסה X?"** ("replace it with revision X?"). Confirm.
   - The old PDF, its index and its manifest entry are removed, and the new ones are written, in **one atomic transaction**. Two revisions of the same document are never searchable at the same time.
   - If the revision in the filename, the PDF title and the document text disagree, the app warns before importing. Stop and check the file.
4. Run **בדיקת תקינות** (integrity check) and export the manifest (**ייצוא רשימת מסמכים**). Keep the manifest with the update record.
5. Spot-check 3 questions whose answers changed in the new revision (from the revision's "Highlights of Change"). Confirm that the new pages are cited.

Importing a file that's already installed (identical SHA-256) is detected and skipped.

## B. Adding a new document

Import it. A file whose short name doesn't match an installed document is added alongside the others.

## C. Removing a document

📚 מסמכים → **הסר** (remove) on that document. Only the app's copy is deleted.

## D. Updating the app itself (needs internet once)

1. The maintainer changes `app/`, runs the tests (`TEST_PLAN.md` §A), runs `python3 tools/gen-sw.py`, and publishes `app/` to the host.
2. On the iPad: connect to the internet, then open the app from the Home Screen and wait about 10 seconds. Close and reopen it. The new version is shown at the bottom of the documents panel (גרסת אפליקציה, the app version).
3. Documents and indexes are kept. If a release changes the processing version (shown as "עיבוד", the processing version), re-import the documents so they're indexed by the new code. The release notes must say so.

## E. Change control

- Every document update should record: who, when, the source of the PDF, the old and new revision, and the exported manifest.
- Only documents authorized for this use may be imported (see `SECURITY.md`).
