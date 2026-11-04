# Installation — iPad 10th Generation

The app has two parts that are installed separately:

| Part | What it contains | How it reaches the iPad | Internet? |
|---|---|---|---|
| **App** | Code only (HTML/JS/CSS, pdf.js). No documents. | Opened once in Safari from an HTTPS address, then "Add to Home Screen" | **Once**, at installation (and again only for app updates) |
| **Documents** | The authorized PDFs | USB-C flash drive → Files picker inside the app | Never |

## 0. Before you start

- Record the iPadOS version (Settings → General → About). **iPadOS 17 or later is recommended**, because older versions handle storage for home-screen web apps less reliably. Add the version to the test record (`TEST_PLAN.md`).
- Confirm that installing a home-screen web app is allowed on the device. On managed devices, check with IT whether Safari and home-screen apps are restricted.
- Confirm authorization to store and use each PDF in this app (see `SECURITY.md`).
- Free storage: roughly 2× the total PDF size (the PDF copy plus the index). The current 7 files total about 230 MB.

## 1. Host the app code (one-time, by the maintainer)

The contents of `app/` must be served over **HTTPS**, because iPadOS only installs and caches web apps from secure origins. Any static host works. Only the `app/` folder is uploaded. **No PDFs and nothing from `sources/` or `tests/` may be uploaded.**

Recommended host: GitHub Pages (free), from a repository that contains only this project's code.

After any change to `app/`, run `python3 tools/gen-sw.py` before publishing, so the offline cache picks up the new version.

## 2. Install on the iPad (needs internet once)

1. Open **Safari** and go to the app's HTTPS address.
2. Tap **Share** (□↑) → **Add to Home Screen** → **Add**. The icon is named "תיעוד מטוס".
3. **Open the app from the Home Screen icon**, not from a Safari tab. This matters: from iPadOS 17 onwards, a home-screen app has its own storage, separate from Safari tabs. Documents must be imported from inside the home-screen app.
4. Leave it open for about 10 seconds while still online, so all app files are cached.
5. Turn on **Airplane Mode**. Close the app completely (swipe it away in the app switcher) and open it again from the icon. It must open normally. If it doesn't, switch internet back on, open it once more, and repeat.

## 3. Load the documents (offline, via USB-C)

1. On the authorized computer, copy the PDFs to a **USB-C flash drive**. Keep the original filenames, which include the revision, e.g. `G550 AOM REV 45.pdf`. The app reads the revision from the filename and cross-checks it against the document text.
2. Plug the drive into the iPad.
3. In the app, tap **📚 מסמכים** → **הוספה / עדכון מסמכים (PDF)**.
4. In the picker, open the USB drive, tap **Select**, choose the PDFs, and tap **Open**.
5. **Keep the app in the foreground and the screen on** until every file shows ✓. Large manuals (60 MB, 1,000+ pages) can take several minutes each. If the app is interrupted, import that file again; incomplete imports are never saved.
6. Tap **בדיקת תקינות** (integrity check). Every document must show ✓.
7. Check the list against the authorized revisions: the version, the filename, and the "בדיקת גרסה" (revision check) row. Tap **ייצוא רשימת מסמכים** (export document list) to save the manifest for your records.

Alternative to a USB drive: any method that puts the PDFs in the iPad's **Files** app (On My iPad) also works, for example a Mac with Finder or an approved MDM file push.

## 4. Acceptance check (on the iPad, in Airplane Mode)

Run the "On-device acceptance" checklist in `TEST_PLAN.md` and record the results.

## Important

- **Deleting the Home Screen icon deletes the app's documents and index.** To reinstall, repeat steps 2–3.
- Opening the app's address in a Safari tab shows an empty app. That's expected (separate storage). Always use the Home Screen icon.
