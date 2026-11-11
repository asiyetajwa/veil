// The mask map: merges pattern and model spans into one non-overlapping set, gives each entity a stable label
// (the same text always gets the same mask, across chunks and passes), and builds the redacted abstract.
// The map (label to original text) never leaves the device.

import { CATEGORIES, rank } from './categories.js';

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Finds every occurrence of `needle` in `text` on word boundaries, skipping ranges already covered by `taken`.
 * Used to place model findings, which come back as text, onto exact offsets. Matching is case-sensitive by
 * default: names, places and organisations are proper nouns, so the name "Will" must not mask the verb "will".
 */
export function locate(text, needle, taken = [], { ignoreCase = false } = {}) {
  const n = needle.trim();
  if (n.length < 2) return [];
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, ignoreCase ? 'giu' : 'gu');
  const out = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (!taken.some((t) => start < t.end && end > t.start)) out.push({ start, end });
  }
  return out;
}

/** Merges spans into a sorted, non-overlapping list. On overlap the higher tier wins, then the longer span. */
export function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => rank(b.category) - rank(a.category) || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept = [];
  for (const s of sorted) {
    if (s.end <= s.start) continue;
    if (kept.some((k) => s.start < k.end && s.end > k.start)) continue;
    kept.push(s);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * Builds the mask map from merged spans: labels like NAME 1, ACCOUNT 2, numbered per category in order of first
 * appearance, with the same normalised text sharing one label.
 */
export function buildMasks(text, spans) {
  const merged = mergeSpans(spans);
  const byKey = new Map();
  const counters = {};
  const masks = merged.map((s) => {
    const original = text.slice(s.start, s.end);
    const key = `${s.category}|${norm(original)}`;
    let label = byKey.get(key);
    if (!label) {
      counters[s.category] = (counters[s.category] ?? 0) + 1;
      label = `${s.category} ${String(counters[s.category])}`;
      byKey.set(key, label);
    }
    return { start: s.start, end: s.end, category: s.category, source: s.source, label, original };
  });
  return masks;
}

/** The redacted abstract: the text with every mask replaced by its [LABEL]. */
export function redact(text, masks) {
  let out = '';
  let at = 0;
  for (const m of masks) {
    out += text.slice(at, m.start) + `[${m.label}]`;
    at = m.end;
  }
  return out + text.slice(at);
}

/** Splits the text into plain and masked segments for rendering. */
export function segments(text, masks) {
  const out = [];
  let at = 0;
  for (const m of masks) {
    if (m.start > at) out.push({ kind: 'text', start: at, end: m.start, text: text.slice(at, m.start) });
    out.push({ kind: 'mask', ...m });
    at = m.end;
  }
  if (at < text.length) out.push({ kind: 'text', start: at, end: text.length, text: text.slice(at) });
  return out;
}

/** Counts masked entities (distinct labels) and occurrences by category. */
export function counts(masks) {
  const out = {};
  for (const m of masks) {
    const c = (out[m.category] ??= { entities: new Set(), occurrences: 0 });
    c.entities.add(m.label);
    c.occurrences++;
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { entities: v.entities.size, occurrences: v.occurrences }]));
}

/** Puts the originals back into text that carries [LABEL] masks. Runs only on the device, from the local map. */
export function fillIn(text, masks) {
  const map = new Map(masks.map((m) => [m.label, m.original]));
  return text.replace(/\[([A-Z]+ \d+)\]/g, (whole, label) => map.get(label) ?? whole);
}

export const categoryLabel = (id) => CATEGORIES[id]?.label ?? id;
