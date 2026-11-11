// Signed receipts: Ed25519 through WebCrypto, verifiable in the page. The body is serialised canonically (sorted
// keys, no spaces) so a receipt verifies after a round trip through JSON. The signing key lives on this device
// (IndexedDB, not extractable); the public key travels on every receipt.

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const DB = 'veil-keys';
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve) => { const q = db.transaction('keys').objectStore('keys').get(key); q.onsuccess = () => resolve(q.result); q.onerror = () => resolve(undefined); });
}
async function idbPut(key, value) {
  const db = await idb();
  return new Promise((resolve) => { const tx = db.transaction('keys', 'readwrite'); tx.objectStore('keys').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
}

let keyPair;
/** This device's signing key: kept in IndexedDB when available, otherwise for this session only. */
export async function deviceKey() {
  if (keyPair) return keyPair;
  try {
    keyPair = typeof indexedDB !== 'undefined' ? await idbGet('signing') : undefined;
  } catch { keyPair = undefined; }
  if (!keyPair) {
    keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    try { if (typeof indexedDB !== 'undefined') await idbPut('signing', keyPair); } catch { /* session key only */ }
  }
  return keyPair;
}

export async function sign(body, pair) {
  const kp = pair ?? (await deviceKey());
  const pub = b64(await crypto.subtle.exportKey('raw', kp.publicKey));
  const full = { ...body, publicKey: pub };
  const signature = b64(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, enc.encode(canonical(full))));
  return { body: full, signature, algorithm: 'Ed25519' };
}

/** Verifies a receipt against the public key it carries. Returns { valid, reason }. */
export async function verify(receipt) {
  try {
    if (!receipt?.body?.publicKey || !receipt.signature) return { valid: false, reason: 'This is not a Veil receipt: the key or signature is missing.' };
    const key = await crypto.subtle.importKey('raw', unb64(receipt.body.publicKey), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64(receipt.signature), enc.encode(canonical(receipt.body)));
    return ok ? { valid: true, reason: 'The signature matches every field on this receipt.' } : { valid: false, reason: 'The signature does not match. Something on this receipt was changed after it was signed.' };
  } catch (e) {
    return { valid: false, reason: `The receipt could not be checked: ${String(e instanceof Error ? e.message : e)}` };
  }
}

export function receiptId() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return `VL-${n.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
