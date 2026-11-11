// What the film shows, computed with the app's own modules (public/js): the pattern layer, the mask map, the
// policy gate and the redacted abstract are real output. The model layer's finds are listed here as the items an
// on-device model returns for this sample (names, places, organisations); they are placed with the app's locate().
import { patternSpans } from '../../../public/js/patterns.js';
import { buildMasks, redact, locate, counts, fillIn } from '../../../public/js/masks.js';
import { gate } from '../../../public/js/policy.js';
import { SAMPLES, SEEDS, parseSeed } from '../../../public/js/seeds.js';

export type Mask = { start: number; end: number; category: string; source: string; label: string; original: string };
type Span = { start: number; end: number; category: string; source: string };

function withModel(text: string, found: [string, string][]): Mask[] {
  const spans: Span[] = patternSpans(text) as Span[];
  const taken = spans.map((s) => ({ start: s.start, end: s.end }));
  for (const [t, category] of found) {
    for (const at of locate(text, t, taken) as { start: number; end: number }[]) {
      spans.push({ ...at, category, source: 'model' });
      taken.push(at);
    }
  }
  return buildMasks(text, spans) as Mask[];
}

// The everyday note (the app's "Project sync" sample).
export const NOTE = (SAMPLES as { text: string }[])[0]?.text ?? '';
export const NOTE_MASKS = withModel(NOTE, [
  ['Lena Marsh', 'NAME'], ['Omar Haddad', 'NAME'], ['Ines Duarte', 'NAME'], ['Paulo Reis', 'NAME'], ['Ines', 'NAME'],
  ['Harbourline', 'ORG'], ['Studio Pell', 'ORG'], ['Lisbon', 'PLACE'], ['Porto', 'PLACE'],
]);
export const NOTE_ABSTRACT = redact(NOTE, NOTE_MASKS) as string;
export const NOTE_COUNTS = counts(NOTE_MASKS) as Record<string, { entities: number; occurrences: number }>;
export const NOTE_GATE = gate(NOTE_MASKS) as { blocked: boolean; high: string[] };
export const label = (original: string): string => `[${NOTE_MASKS.find((m) => m.original === original)?.label ?? '?'}]`;
export const fill = (text: string): string => fillIn(text, NOTE_MASKS) as string;

// The support ticket (a canary seed): pattern layer only, which is what trips the gate.
const ticket = parseSeed((SEEDS as { id: string; text: string }[]).find((s) => s.id === 'ticket')?.text ?? '') as { text: string; planted: unknown[] };
export const TICKET = ticket.text;
export const TICKET_MASKS = buildMasks(TICKET, patternSpans(TICKET)) as Mask[];
export const TICKET_GATE = gate(TICKET_MASKS) as { blocked: boolean; high: string[] };

export const SEED_INFO = (SEEDS as { title: string; text: string }[]).map((s) => {
  const { planted } = parseSeed(s.text) as { planted: { category: string }[] };
  return { title: s.title, planted: planted.length };
});
export const PLANTED_TOTAL = SEED_INFO.reduce((a, s) => a + s.planted, 0);

export type Seg = { kind: 'text'; text: string } | ({ kind: 'mask' } & Mask);
export function segs(text: string, masks: Mask[]): Seg[] {
  const out: Seg[] = [];
  let at = 0;
  for (const m of masks) {
    if (m.start > at) out.push({ kind: 'text', text: text.slice(at, m.start) });
    out.push({ kind: 'mask', ...m });
    at = m.end;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}
