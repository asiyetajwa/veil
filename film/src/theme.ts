import { continueRender, delayRender, staticFile } from 'remotion';

// Veil's look, the app's own tokens: a pale canvas, frosted lenses, steel liquid bridges, an umber dial, black
// inversions. Inter Tight (SIL Open Font License).
export const theme = {
  canvas: '#f1f2f4',
  paper: '#fafbfc',
  mistA: '#dde3e9',
  mistB: '#eef1f4',
  frost: '#c9d3dc',
  pond: '#7e93a6',
  steel: '#a1a4a9',
  steel2: '#b9bcc0',
  ink: '#0f1012',
  ink2: '#55595f',
  ink3: '#94989f',
  night: '#0b0b0c',
  night2: '#18181a',
  nightInk: '#e9eaec',
  nightInk2: '#a6a9ae',
  nightInk3: '#7d8087',
  umber: '#2a1d17',
  ok: '#3f6b58',
  bad: '#9a3b2e',
  font: "'Inter Tight', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

let fontsRequested = false;

/** Loads the font before the first frame renders. */
export function ensureFonts(): void {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  const handle = delayRender('Loading fonts');
  new FontFace('Inter Tight', `url(${staticFile('fonts/inter-tight.woff2')}) format('woff2')`, { weight: '100 700' })
    .load()
    .then((f) => { document.fonts.add(f); })
    .catch((err: unknown) => { console.error(err); })
    .finally(() => { continueRender(handle); });
}
