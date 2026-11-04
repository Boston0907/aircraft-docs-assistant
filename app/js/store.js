// On-device repository (IndexedDB). Original PDFs are stored byte-for-byte as Blobs.
const DB_NAME = 'aircraft-docs';
const DB_VER = 1;

let dbp = null;
export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'docId' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'docId' });
      if (!db.objectStoreNames.contains('passages')) db.createObjectStore('passages', { keyPath: 'docId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const done = (tx) => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function getAllDocs() {
  const db = await openDB();
  return reqP(db.transaction('docs').objectStore('docs').getAll());
}

export async function getAllPassages() {
  const db = await openDB();
  const rows = await reqP(db.transaction('passages').objectStore('passages').getAll());
  return rows;
}

export async function getFile(docId) {
  const db = await openDB();
  const row = await reqP(db.transaction('files').objectStore('files').get(docId));
  return row?.blob || null;
}

// Atomic: the new document, its file and its passages are written, and any replaced
// revisions removed, in ONE transaction. Either everything is committed or nothing is.
export async function putDocument(doc, blob, passages, replaceIds = []) {
  const db = await openDB();
  const tx = db.transaction(['docs', 'files', 'passages'], 'readwrite');
  for (const id of replaceIds) {
    tx.objectStore('docs').delete(id);
    tx.objectStore('files').delete(id);
    tx.objectStore('passages').delete(id);
  }
  tx.objectStore('docs').put(doc);
  tx.objectStore('files').put({ docId: doc.docId, blob });
  tx.objectStore('passages').put({ docId: doc.docId, list: passages });
  await done(tx);
}

export async function deleteDocument(docId) {
  const db = await openDB();
  const tx = db.transaction(['docs', 'files', 'passages'], 'readwrite');
  ['docs', 'files', 'passages'].forEach((s) => tx.objectStore(s).delete(docId));
  await done(tx);
}

export async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function storageInfo() {
  const out = { persisted: null, usage: null, quota: null };
  try { out.persisted = await navigator.storage?.persisted?.(); } catch { /* unsupported */ }
  try { const e = await navigator.storage?.estimate?.(); if (e) { out.usage = e.usage; out.quota = e.quota; } } catch { /* unsupported */ }
  return out;
}

export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
