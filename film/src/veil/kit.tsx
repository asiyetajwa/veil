import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, VO_LEAD } from '../components/Film';
import { clamp, easeOut, popAt } from '../components/motion';
import { theme } from '../theme';
import words from '../../public/voiceover/veil/words.json';
import { SCENES } from './script';

// ------------------------------------------------------------------ cues and captions
const WORDS = words as unknown as Record<string, [string, number][]>;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

/** The frame at which a narrated word starts, so a reveal lands on the word that names it. */
export function cue(scene: string, word: string, nth = 0, fallback = 0): number {
  let seen = 0;
  for (const [w, t] of WORDS[scene] ?? []) {
    if (norm(w).startsWith(norm(word))) {
      if (seen === nth) return Math.round((t + VO_LEAD) * FPS);
      seen++;
    }
  }
  return Math.round(fallback * FPS);
}

/**
 * Captions: the script's own words (never the transcriber's spelling), a phrase at a time. Each script word takes
 * its time from the clip's word timings by position.
 */
export const Captions: React.FC<{ scene: string; dark?: boolean }> = ({ scene, dark = false }) => {
  const frame = useCurrentFrame();
  const timings = WORDS[scene] ?? [];
  const text = (SCENES.find((x) => x.id === scene)?.voiceover ?? '').replace(/<[^>]+>/g, '');
  const script = text.split(/\s+/).filter(Boolean);
  const at = (i: number): number => timings[Math.min(timings.length - 1, Math.round((i * timings.length) / Math.max(1, script.length)))]?.[1] ?? 0;
  const phrases: { text: string; from: number; to: number }[] = [];
  let cur: string[] = [];
  let start = 0;
  script.forEach((w, i) => {
    if (cur.length === 0) start = at(i);
    cur.push(w);
    const last = i === script.length - 1;
    const ends = /[.?!:]$/.test(w) || (/,$/.test(w) && cur.length >= 5) || cur.length >= 9 || last;
    if (ends) {
      phrases.push({ text: cur.join(' '), from: start, to: last ? at(i) + 1.4 : at(i + 1) });
      cur = [];
    }
  });
  const t = frame / FPS - VO_LEAD;
  const p = phrases.find((x) => t >= x.from - 0.05 && t < x.to - 0.02);
  if (!p) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center', fontFamily: theme.font }}>
      <div style={{ padding: '12px 26px', borderRadius: 999, fontSize: 30, fontWeight: 400, letterSpacing: -0.3,
        color: dark ? theme.nightInk : theme.ink, background: dark ? 'rgba(30,31,34,.86)' : 'rgba(255,255,255,.86)',
        boxShadow: dark ? 'none' : '0 10px 30px -14px rgba(40,55,70,.35)' }}>{p.text}</div>
    </div>
  );
};

// ------------------------------------------------------------------ kit
export const Stage: React.FC<{ dark?: boolean; children: React.ReactNode }> = ({ dark = false, children }) => (
  <AbsoluteFill style={{ background: dark ? theme.night : theme.canvas, color: dark ? theme.nightInk : theme.ink, fontFamily: theme.font }}>{children}</AbsoluteFill>
);

export const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dy?: number }> = ({ at, children, style, dy = 26 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, at, 20);
  return <div style={{ opacity: Math.min(1, Math.max(0, p)), transform: `translateY(${String((1 - p) * dy)}px)`, ...style }}>{children}</div>;
};

export const Fade: React.FC<{ from: number; to?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ from, to = 1e9, children, style }) => {
  const frame = useCurrentFrame();
  const o = Math.min(interpolate(frame, [from, from + 14], [0, 1], clamp), interpolate(frame, [to, to + 14], [1, 0], clamp));
  return <div style={{ opacity: o, ...style }}>{children}</div>;
};

/** The two-line micro label from the reference boards: a grey line over an ink line. */
export const Micro: React.FC<{ a: string; b: string; dark?: boolean; size?: number; style?: React.CSSProperties }> = ({ a, b, dark = false, size = 20, style }) => (
  <div style={{ fontSize: size, lineHeight: 1.35, ...style }}>
    <div style={{ color: dark ? theme.nightInk3 : theme.ink3 }}>{a}</div>
    <div style={{ color: dark ? theme.nightInk : theme.ink }}>{b}</div>
  </div>
);

export const Dot: React.FC<{ size?: number; color?: string }> = ({ size = 10, color = 'currentColor' }) => (
  <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flex: 'none' }} />
);

/** A mask pill, as in the app: grey for the pattern layer, pond blue for the model layer, umber for high tiers. */
export const MaskPill: React.FC<{ label: string; tone: 'pattern' | 'model' | 'high' | 'night'; size?: number; at?: number }> = ({ label, tone, size = 19, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // No reveal frame means the pill is simply there (a spring from the distant past would never settle).
  const p = at === undefined ? 1 : popAt(frame, fps, at, 16);
  const bg = tone === 'high' ? theme.umber : tone === 'model' ? theme.pond : tone === 'night' ? '#3a3b3e' : theme.steel;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32, padding: `${String(size * 0.12)}px ${String(size * 0.55)}px ${String(size * 0.12)}px ${String(size * 0.4)}px`,
      borderRadius: 999, background: bg, color: '#fff', fontSize: size * 0.62, fontWeight: 600, letterSpacing: size * 0.03, lineHeight: 1.5,
      verticalAlign: '0.08em', margin: '0 2px', whiteSpace: 'nowrap', transform: `scale(${String(0.6 + 0.4 * Math.min(1, p))})`, opacity: Math.min(1, p) }}>
      <Dot size={size * 0.32} color="#fff" />{label}
    </span>
  );
};

/** The umber donut dial with a notch. `turn` rotates the notch; `open` fades it to steel. */
export const Donut: React.FC<{ size: number; turn?: number; open?: number; ring?: number; tint?: string; style?: React.CSSProperties }> = ({ size, turn = 0, open = 0, ring = 0.2, tint, style }) => {
  const col = tint ?? (open > 0.5 ? theme.steel2 : theme.umber);
  const mask = 'conic-gradient(from 250deg, transparent 0 9%, #000 9%)';
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${String(size * ring)}px solid ${col}`, boxSizing: 'border-box',
        WebkitMaskImage: mask, maskImage: mask, transform: `rotate(${String(turn)}deg)` }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: size * 0.06, height: size * 0.06, borderRadius: '50%', background: 'currentColor', transform: 'translate(-50%,-50%)' }} />
    </div>
  );
};

/** A frosted lens: blurs what is behind it. */
export const Lens: React.FC<{ size: number; x: number; y: number; dark?: boolean; blur?: number }> = ({ size, x, y, dark = false, blur = 12 }) => (
  <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%',
    backdropFilter: `blur(${String(blur)}px) saturate(.9)`, WebkitBackdropFilter: `blur(${String(blur)}px) saturate(.9)`,
    background: dark ? 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.2), rgba(126,147,166,.16) 70%)' : 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.6), rgba(201,211,220,.38) 70%)',
    boxShadow: dark ? 'inset 0 0 0 1.5px rgba(255,255,255,.22)' : 'inset 0 0 0 1.5px rgba(255,255,255,.7), 0 40px 80px -40px rgba(40,55,70,.4)' }} />
);

/** SVG filter that fuses neighbouring shapes into liquid bridges. */
export const Goo: React.FC<{ id?: string; blur?: number }> = ({ id = 'goo', blur = 14 }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <filter id={id}>
        <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
        <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12" result="g" />
        <feComposite in="SourceGraphic" in2="g" operator="atop" />
      </filter>
    </defs>
  </svg>
);

export const Roll: React.FC<{ to: number; at: number; len?: number }> = ({ to, at, len = 34 }) => {
  const frame = useCurrentFrame();
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(Math.round(interpolate(frame, [at, at + len], [0, to], { ...clamp, easing: easeOut })))}</span>;
};

export const panel: React.CSSProperties = { background: theme.paper, borderRadius: 64, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 50px 90px -60px rgba(40,55,70,.35)' };
export const nightPanel: React.CSSProperties = { background: theme.night2, borderRadius: 44 };
