// The pattern layer: deterministic detectors that run in code on the device, before any model.
// Each detector returns spans { start, end, text, category, source: 'pattern' } over the original text.
// It is a filter with limits: it finds shapes, not meaning. Names, organisations and places are the model layer's job.

const digitsIn = (s) => (s.match(/\d/g) ?? []).length;

/** Luhn check for card-shaped numbers. */
function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const before = (text, start, n = 28) => text.slice(Math.max(0, start - n), start).toLowerCase();

/** Trim trailing sentence punctuation that a greedy match picked up. */
function trimEnd(text, start, end) {
  while (end > start && /[.,;:!?)\]'"]/.test(text[end - 1])) end--;
  return end;
}

function collect(text, re, category, map) {
  const out = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const span = map ? map(m) : { start: m.index, end: m.index + m[0].length };
    if (span && span.end > span.start) out.push({ ...span, category: span.category ?? category });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

const DETECTORS = [
  // Emails.
  (t) => collect(t, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'EMAIL'),

  // Links: scheme or www, trailing punctuation trimmed.
  (t) => collect(t, /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi, 'URL', (m) => ({ start: m.index, end: trimEnd(t, m.index, m.index + m[0].length) })),

  // Secrets: a value after a credential word ("password: x", "PIN is 1234", "api key = x").
  (t) => collect(t, /\b(?:pass(?:word|code|phrase)?|pwd|pin|secret|token|api[ _-]?key|access[ _-]?key|recovery code)\b\s*(?:is|was|:|=|-)\s*["'`]?([^\s"'`,;]{3,})/gi, 'SECRET',
    (m) => { const v = m[1] ?? ''; const s = m.index + m[0].lastIndexOf(v); return { start: s, end: trimEnd(t, s, s + v.length) }; }),

  // Secrets: well-known key shapes, and long mixed tokens.
  (t) => collect(t, /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, 'SECRET'),

  // IBAN-shaped account numbers.
  (t) => collect(t, /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, 'ACCOUNT'),

  // Digit runs (spaces and hyphens allowed between digits). Classified by length, shape and the words before them:
  // card-shaped (13 to 19 digits passing Luhn) or labelled account numbers are ACCOUNT; phone-shaped runs are PHONE;
  // any other run of 8 or more digits is treated as an account number, the safer reading.
  (t) => collect(t, /(?<![\w]|\d[.,])\+?\(?\d(?:[\s().-]{0,2}\d){6,22}(?!\w|[.,]\d)/g, 'ACCOUNT', (m) => {
    const raw = m[0];
    const start = m.index;
    const end = trimEnd(t, start, start + raw.length);
    const digits = raw.replace(/\D/g, '');
    const ctx = before(t, start);
    if (digits.length < 7) return null;
    const phoneWords = /(phone|tel|call|mobile|cell|whatsapp|text me|ring|fax|ext)\b[^.\n]*$/.test(ctx);
    const accountWords = /(account|acct|a\/c|card|iban|sort code|routing|policy|member|customer|reference|ref|invoice|order)\b[^.\n]*$/.test(ctx);
    const phoneShape = /^\+|^\(/.test(raw) || /^\d{3}[\s.-]\d{3}[\s.-]\d{4}$/.test(raw) || /^0\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{3,4}$/.test(raw);
    if (accountWords) return { start, end, category: 'ACCOUNT' };
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return { start, end, category: 'ACCOUNT' };
    if ((phoneWords || phoneShape) && digits.length >= 9 && digits.length <= 15) return { start, end, category: 'PHONE' };
    if (digits.length >= 8) return { start, end, category: 'ACCOUNT' };
    return null;
  }),

  // Birth dates: a date after a birth word, in numeric or written form.
  (t) => collect(t, /\b(?:dob|d\.o\.b\.?|date of birth|born(?: on)?|birthday)\b[:\s]*((?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4})|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}))/gi, 'DATE',
    (m) => { const v = m[1] ?? ''; const s = m.index + m[0].lastIndexOf(v); return { start: s, end: s + v.length }; }),

  // Currency amounts.
  (t) => collect(t, /(?:[$£€¥₦₹]|\b(?:USD|GBP|EUR|KES|NGN|ZAR|CAD|AUD)\s?)\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:k|m|bn|million|billion)\b)?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:dollars|pounds|euros|shillings)\b/gi, 'MONEY',
    (m) => ({ start: m.index, end: trimEnd(t, m.index, m.index + m[0].length) })),

  // Health details: a phrase after a clinical cue, up to the end of the clause or the next joining word.
  (t) => collect(t, /\b(?:diagnosed with|diagnosis of|prescribed|on medication for|being treated for|treatment for|recovering from|suffers from|has been off with|off sick with)\s+([^.,;\n]{3,60}?)(?=\s+(?:and|so|but|which|who|since|until)\b|[.,;\n]|$)/gi, 'HEALTH',
    (m) => { const v = m[1] ?? ''; const s = m.index + m[0].lastIndexOf(v); return { start: s, end: trimEnd(t, s, s + v.length) }; }),
];

/** Every pattern span in the text, unmerged. */
export function patternSpans(text) {
  const spans = [];
  for (const detect of DETECTORS) {
    for (const s of detect(text)) {
      if (s.category === 'PHONE' && digitsIn(text.slice(s.start, s.end)) < 9) continue;
      spans.push({ start: s.start, end: s.end, text: text.slice(s.start, s.end), category: s.category, source: 'pattern' });
    }
  }
  return spans;
}
