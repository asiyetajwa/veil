import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { BlurText, clamp, easeOut, popAt } from '../components/motion';
import { theme } from '../theme';
import { CANARY } from './canary-result';
import { label, NOTE, NOTE_ABSTRACT, NOTE_COUNTS, NOTE_MASKS, PLANTED_TOTAL, SEED_INFO, segs, TICKET, TICKET_GATE, TICKET_MASKS, fill, type Mask } from './data';
import { Captions, cue, Donut, Dot, Fade, Goo, Lens, MaskPill, Micro, nightPanel, panel, Pop, Roll, Stage } from './kit';

/** The technologies in play for a scene, named in the top right. */
const Tech: React.FC<{ items: string[]; dark?: boolean; at?: number }> = ({ items, dark = false, at = 10 }) => (
  <div style={{ position: 'absolute', right: 110, top: 62, display: 'flex', gap: 10 }}>
    {items.map((x, i) => (
      <Fade key={x} from={at + i * 6}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px 9px 14px', borderRadius: 999, fontSize: 19, fontWeight: 500,
          background: dark ? theme.night2 : 'rgba(15,16,18,.06)', color: dark ? theme.nightInk : theme.ink }}><Dot size={8} color={theme.pond} />{x}</div>
      </Fade>
    ))}
  </div>
);

const HIGH = new Set(['ACCOUNT', 'SECRET', 'HEALTH']);
const CAT: Record<string, string> = { NAME: 'Names', ORG: 'Organisations', PLACE: 'Places', MONEY: 'Amounts', EMAIL: 'Emails', PHONE: 'Phones', ACCOUNT: 'Account', SECRET: 'Secret', HEALTH: 'Health' };
const tone = (m: Mask): 'pattern' | 'model' | 'high' => (HIGH.has(m.category) ? 'high' : m.source === 'model' ? 'model' : 'pattern');

/** A document with its masks. Each mask shows the original until its reveal frame, then blooms into a pill. */
const Doc: React.FC<{ text: string; masks: Mask[]; revealAt: (m: Mask, i: number) => number; size: number; lineHeight?: number; wipe?: number }> = ({ text, masks, revealAt, size, lineHeight = 2, wipe = 1e9 }) => {
  const frame = useCurrentFrame();
  const gone = interpolate(frame, [wipe, wipe + 30], [0, 1], clamp);
  let i = 0;
  return (
    <div style={{ fontSize: size, lineHeight, whiteSpace: 'pre-wrap', color: theme.ink, opacity: 1 - gone, filter: gone > 0.01 ? `blur(${String(gone * 16)}px)` : undefined }}>
      {segs(text, masks).map((s, k) => {
        if (s.kind === 'text') return <span key={k}>{s.text}</span>;
        const at = revealAt(s, i++);
        return frame < at ? <span key={k}>{s.original}</span> : <MaskPill key={k} label={s.label} tone={tone(s)} size={size} at={at} />;
      })}
    </div>
  );
};

// ------------------------------------------------------------------ 1. hook
const HOOK_LINES = NOTE.split('\n').filter((l) => l.includes(':')).slice(0, 4);

export const HookScene: React.FC<{ duration: number }> = ({ duration }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, duration], [520, 1380], { ...clamp, easing: easeOut });
  return (
    <Stage dark>
      <div style={{ position: 'absolute', left: 150, top: 120, width: 1500, fontSize: 82, fontWeight: 300, letterSpacing: -3, lineHeight: 1.08 }}>
        <BlurText text="The notes you most need help with" at={4} />
        <div style={{ color: theme.nightInk3 }}><BlurText text="are the ones you least want to upload." at={cue('hook', 'are', 0, 2.4)} /></div>
      </div>
      <div style={{ position: 'absolute', left: 150, top: 520, width: 1620, display: 'flex', flexDirection: 'column', gap: 26, fontSize: 28, color: '#c9ccd1' }}>
        {HOOK_LINES.map((l, i) => <Fade key={i} from={cue('hook', 'Meeting', 0, 4.6) + i * 9}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{l}</div></Fade>)}
      </div>
      <Lens size={420} x={x} y={640} dark blur={14} />
      <Captions scene="hook" dark />
    </Stage>
  );
};

// ------------------------------------------------------------------ 2. title
export const TitleScene: React.FC<{ duration: number }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popAt(frame, fps, 2, 22);
  return (
    <Stage>
      <div style={{ position: 'absolute', left: 110, right: 110, top: 150, bottom: 190, borderRadius: 999, background: `radial-gradient(120% 140% at 20% 30%, ${theme.mistB} 0%, ${theme.mistA} 70%)`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 150, top: 150, fontSize: 300, fontWeight: 200, letterSpacing: -16, lineHeight: 0.9, opacity: p, transform: `translateY(${String((1 - p) * 30)}px)` }}>VEIL</div>
        <div style={{ position: 'absolute', left: 162, top: 470, width: 1000, fontSize: 46, fontWeight: 300, letterSpacing: -1.4, lineHeight: 1.15 }}>
          <BlurText text="Your notes, redacted on your device before any cloud sees them." at={cue('title', 'Your', 0, 1.4)} />
        </div>
        <Lens size={380} x={1260 + Math.sin(frame / 40) * 30} y={300} blur={10} />
        <Donut size={210} style={{ position: 'absolute', right: 190, bottom: 110, color: theme.ink }} turn={interpolate(frame, [0, 120], [-40, 0], { ...clamp, easing: easeOut })} />
      </div>
      <Micro a="Veil" b="Redaction-first notes (01)" style={{ position: 'absolute', left: 120, top: 70 }} />
      <Tech items={['Firebase AI Logic']} at={cue('title', 'Firebase', 0, 1.6)} />
      <Captions scene="title" />
    </Stage>
  );
};

// ------------------------------------------------------------------ 3. masks bloom on the device
const Rings: React.FC<{ at: number; modelAt: number }> = ({ at, modelAt }) => {
  const frame = useCurrentFrame();
  const cats = Object.keys(NOTE_COUNTS);
  const order = [...cats.filter((c) => !['NAME', 'ORG', 'PLACE'].includes(c)), ...cats.filter((c) => ['NAME', 'ORG', 'PLACE'].includes(c))];
  const shown = (c: string) => frame >= (['NAME', 'ORG', 'PLACE'].includes(c) ? modelAt : at);
  const total = NOTE_MASKS.filter((m) => frame >= (m.source === 'model' ? modelAt : at)).length;
  const S = 520;
  return (
    <div style={{ position: 'relative', width: S, height: S }}>
      <svg width={S} height={S} viewBox={`0 0 ${String(S)} ${String(S)}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {order.map((c, i) => {
          const r = 118 + i * 24;
          const a = (-62 + i * 33) * (Math.PI / 180);
          const x = S / 2 + r * Math.cos(a);
          const y = S / 2 + r * Math.sin(a);
          const o = interpolate(frame, [(shown(c) ? (['NAME', 'ORG', 'PLACE'].includes(c) ? modelAt : at) : 1e9) + i * 3, (shown(c) ? (['NAME', 'ORG', 'PLACE'].includes(c) ? modelAt : at) : 1e9) + i * 3 + 14], [0, 1], clamp);
          return (
            <g key={c} opacity={o}>
              <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke={theme.steel2} strokeWidth="1.6" />
              <circle cx={x} cy={y} r="6" fill={['NAME', 'ORG', 'PLACE'].includes(c) ? theme.pond : theme.ink} />
              <text x={x + 14} y={y + 7} fontSize="19" fill={theme.ink2} fontFamily="Inter Tight">{CAT[c] ?? c} {String(NOTE_COUNTS[c]?.entities ?? 0)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div><div style={{ fontSize: 120, fontWeight: 300, letterSpacing: -5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(total)}</div><div style={{ fontSize: 19, color: theme.ink3 }}>masks</div></div>
      </div>
    </div>
  );
};

export const MasksScene: React.FC<{ duration: number }> = () => {
  const pat = cue('masks', 'Patterns', 0, 5.2);
  const mod = cue('masks', 'names', 0, 13);
  const fb = cue('masks', 'Firebase', 0, 9.6);
  const left = cue('masks', 'nothing', 0, 14.6);
  let pi = 0;
  let mi = 0;
  // Keyed by position: the document renders copies of each mask, so identity would not match.
  const order = new Map<number, number>();
  for (const m of NOTE_MASKS) order.set(m.start, m.source === 'model' ? mod + 6 + mi++ * 4 : pat + 4 + pi++ * 7);
  return (
    <Stage>
      <Micro a="On your device" b="Two layers (02)" style={{ position: 'absolute', left: 110, top: 64 }} />
      <Pop at={2} style={{ position: 'absolute', left: 100, top: 150 }}>
        <div style={{ ...panel, width: 1190, padding: '44px 52px' }}>
          <Doc text={NOTE} masks={NOTE_MASKS} revealAt={(m) => order.get(m.start) ?? 0} size={26} lineHeight={2.05} />
        </div>
      </Pop>
      <div style={{ position: 'absolute', right: 90, top: 150 }}><Rings at={pat + 4} modelAt={mod + 6} /></div>
      <div style={{ position: 'absolute', right: 110, top: 700, width: 480, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 22 }}>
        <Fade from={pat}><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Dot size={14} color={theme.steel} />Pattern layer, in code</div></Fade>
        <Fade from={fb}><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Dot size={14} color={theme.pond} />Model layer, the on-device model in Chrome</div></Fade>
        <Fade from={left}><div style={{ display: 'flex', gap: 14, alignItems: 'center', color: theme.ok, fontWeight: 500 }}><Dot size={14} color={theme.ok} />Nothing has left this device.</div></Fade>
      </div>
      <Tech items={['Firebase AI Logic', 'On-device inference']} at={fb} />
      <Captions scene="masks" />
    </Stage>
  );
};

// ------------------------------------------------------------------ 4. the policy gate
export const GateScene: React.FC<{ duration: number }> = () => {
  const frame = useCurrentFrame();
  const inside = cue('gate', 'Inside', 0, 3.6);
  const blocked = cue('gate', 'blocked', 0, 8.8);
  const offers = cue('gate', 'offers', 0, 10.6);
  const turn = interpolate(frame, [blocked - 14, blocked + 16], [140, 0], { ...clamp, easing: easeOut });
  let hi = 0;
  return (
    <Stage>
      <Micro a="Policy gate" b="Sensitivity tiers (03)" style={{ position: 'absolute', left: 110, top: 64 }} />
      <Pop at={2} style={{ position: 'absolute', left: 100, top: 150 }}>
        <div style={{ ...panel, width: 1020, padding: '40px 48px' }}>
          <Doc text={TICKET} masks={TICKET_MASKS} size={23} lineHeight={1.95}
            revealAt={(m) => (HIGH.has(m.category) ? inside + 8 + hi++ * 8 : 6)} />
        </div>
      </Pop>
      <div style={{ position: 'absolute', left: 1200, top: 170, width: 620 }}>
        <Donut size={300} turn={turn} open={frame < blocked - 2 ? 1 : 0} ring={0.19} style={{ color: theme.ink }} />
        <Fade from={blocked}>
          <div style={{ marginTop: 40, fontSize: 52, fontWeight: 300, letterSpacing: -1.8, lineHeight: 1.1 }}>The cloud pass is blocked by default.</div>
          <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
            {TICKET_GATE.high.map((c) => <MaskPill key={c} label={(CAT[c] ?? c).toUpperCase()} tone="high" size={26} />)}
          </div>
        </Fade>
        <Pop at={offers} style={{ marginTop: 34 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '18px 30px 18px 24px', borderRadius: 999, background: theme.ink, color: '#fff', fontSize: 26, fontWeight: 500 }}>
            <Dot size={11} color="#fff" />Summarise on This Device
          </div>
        </Pop>
      </div>
      <Captions scene="gate" />
    </Stage>
  );
};

// ------------------------------------------------------------------ 5. the cloud pass
const BRIEF = {
  summary: `${label('Lena Marsh')} confirmed the ${label('Harbourline')} launch for 3 December in ${label('Lisbon')}. ${label('Studio Pell')} will make the launch film for ${label('€18,000')}, down from ${label('€21,500')}.`,
  decisions: [`Launch on 3 December in ${label('Lisbon')}.`, `${label('Studio Pell')} makes the film.`],
  actions: [`${label('Omar Haddad')}: send the signed quote to ${label('lena.marsh@corvid-studio.example')} by Friday.`, `${label('Ines Duarte')}: book the crew through ${label('Paulo Reis')}.`, `${label('Ines')}: check the hall by Thursday.`],
};

const Labelled: React.FC<{ text: string; filled: boolean }> = ({ text, filled }) => {
  const parts = text.split(/(\[[A-Z]+ \d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^\[[A-Z]+ \d+\]$/.test(p)) return <span key={i}>{p}</span>;
        return filled
          ? <span key={i} style={{ boxShadow: `inset 0 -3px 0 ${theme.pond}` }}>{fill(p)}</span>
          : <MaskPill key={i} label={p.slice(1, -1)} tone="night" size={24} />;
      })}
    </>
  );
};

export const CloudScene: React.FC<{ duration: number }> = () => {
  const frame = useCurrentFrame();
  const panelAt = cue('cloud', 'panel', 0, 4.4);
  const turns = cue('cloud', 'returns', 0, 13);
  const fills = cue('cloud', 'fills', 0, 13.4);
  const lines = NOTE_ABSTRACT.split('\n');
  const card = (title: string, body: React.ReactNode, at: number) => (
    <Pop at={at}><div style={{ ...nightPanel, padding: '24px 30px' }}><div style={{ fontSize: 18, color: theme.nightInk3, marginBottom: 8 }}>{title}</div><div style={{ fontSize: 24, lineHeight: 1.5 }}>{body}</div></div></Pop>
  );
  const filled = frame >= fills;
  return (
    <Stage dark>
      <Micro dark a="In the cloud" b="Abstract only (04)" style={{ position: 'absolute', left: 110, top: 64 }} />
      <Pop at={4} style={{ position: 'absolute', left: 100, top: 150 }}>
        <div style={{ ...nightPanel, width: 860, padding: '28px 34px', boxShadow: `0 0 0 2px rgba(126,147,166,${String(interpolate(frame, [panelAt, panelAt + 12, turns - 10, turns], [0, 0.9, 0.9, 0], clamp))})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, fontWeight: 500 }}><Dot size={11} color="#fff" />What the cloud received
            <span style={{ fontSize: 18, color: theme.nightInk3, fontWeight: 400 }}>{String(NOTE_ABSTRACT.length)} characters, all masked</span></div>
          <div style={{ marginTop: 18, fontFamily: theme.mono, fontSize: 17.5, lineHeight: 1.75, color: '#c9ccd1', whiteSpace: 'pre-wrap' }}>
            {lines.map((l, i) => <div key={i} style={{ opacity: interpolate(frame, [16 + i * 5, 26 + i * 5], [0, 1], clamp), minHeight: 30 }}>{l}</div>)}
          </div>
        </div>
      </Pop>
      <div style={{ position: 'absolute', left: 1010, top: 150, width: 810, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {card('Summary', <Labelled text={BRIEF.summary} filled={filled} />, turns)}
        {card('Decisions', BRIEF.decisions.map((d, i) => <div key={i}><Labelled text={d} filled={filled} /></div>), turns + 14)}
        {card('Action items', BRIEF.actions.map((d, i) => <div key={i}><Labelled text={d} filled={filled} /></div>), turns + 28)}
        <Fade from={fills}><div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, color: theme.nightInk2 }}><Dot size={12} color={theme.pond} />Originals filled in here, on this device</div></Fade>
      </div>
      <Tech dark items={['Firebase AI Logic', 'Cloud inference', 'Firebase App Check']} at={cue('cloud', 'Firebase', 0, 4)} />
      <Captions scene="cloud" dark />
    </Stage>
  );
};

// ------------------------------------------------------------------ 6. canary mode
export const CanaryScene: React.FC<{ duration: number }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const three = cue('canary', 'Three', 0, 4.2);
  const ran = cue('canary', 'test', 0, 10);
  const pattern = cue('canary', 'pattern', 0, 15.6);
  const number = cue('canary', 'twenty', 0, 20.6);
  const names = cue('canary', 'names', 1, 23.6);
  const rate = Math.round((CANARY.caught / CANARY.total) * 100);
  return (
    <Stage dark>
      <Goo id="goo-c" blur={16} />
      <Micro dark a="Canary test" b={`${String(PLANTED_TOTAL)} planted items (C.3)`} style={{ position: 'absolute', left: 110, top: 64 }} />
      <Tech dark items={['Firebase Hosting', 'Desktop Chrome']} at={ran} />
      <Fade from={2} to={three - 14} style={{ position: 'absolute', left: 110, top: 300, width: 1500, fontSize: 110, fontWeight: 300, letterSpacing: -4.5, lineHeight: 1.05 }}>
        <BlurText text="How well does the filter work?" at={4} />
      </Fade>
      <div style={{ position: 'absolute', left: 110, top: 170, display: 'flex', alignItems: 'center', filter: 'url(#goo-c)' }}>
        {SEED_INFO.map((s, i) => {
          const p = popAt(frame, fps, three + i * 8, 18);
          const size = i === 1 ? 330 : 280;
          return <div key={i} style={{ width: size, height: size, borderRadius: '50%', margin: '0 -14px', transform: `scale(${String(Math.max(0, p))})`,
            background: `radial-gradient(circle at 38% 30%, #f2f4f6, #d4dbe1 60%, ${theme.pond} 100%)` }} />;
        })}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 170, width: 840, display: 'flex', alignItems: 'center', height: 330 }}>
        {SEED_INFO.map((s, i) => (
          <div key={i} style={{ width: i === 1 ? 302 : 252, textAlign: 'center', color: theme.ink }}>
            <Fade from={three + i * 8 + 10} to={pattern - 10}><div style={{ fontSize: 24, fontWeight: 500 }}>{s.title}</div><div style={{ fontSize: 19, color: theme.ink2 }}>{String(s.planted)} planted</div></Fade>
            <Fade from={pattern + i * 6} style={{ marginTop: -62 }}>
              <div style={{ fontSize: 84, fontWeight: 300, letterSpacing: -4, lineHeight: 1 }}><Roll to={CANARY.perDocument[i] ?? 0} at={pattern + i * 6} len={26} /><span style={{ fontSize: 28, letterSpacing: 0, color: theme.ink2 }}>%</span></div>
              <div style={{ fontSize: 17, color: theme.ink2, marginTop: 4 }}>{s.title}</div>
            </Fade>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 110, top: 550, width: 860, fontSize: 24, color: theme.nightInk2, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Fade from={ran}><span style={{ color: theme.nightInk, fontWeight: 500 }}>A test we actually ran.</span> {CANARY.where}.</Fade>
        <Fade from={pattern}>Pattern layer: every email, phone number, account number, credential and amount caught.</Fade>
        <Fade from={names}>The on-device model did not run in this test, so {String(CANARY.missed)} items, mostly names, places and organisations, are listed as missed.</Fade>
        <Fade from={names + 30} style={{ color: theme.nightInk3, fontSize: 20 }}>Redaction is a filter with limits, not a guarantee. {String(CANARY.extra)} extra masks. Zero raw characters sent during the test.</Fade>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 190, width: 760, textAlign: 'right' }}>
        <Fade from={number - 6}>
          <div style={{ fontSize: 400, fontWeight: 200, letterSpacing: -22, lineHeight: 0.85 }}>
            <Roll to={rate} at={number} len={36} /><span style={{ fontSize: 60, letterSpacing: 0, color: theme.nightInk2, marginLeft: 12 }}>%</span>
          </div>
          <div style={{ marginTop: 24, fontSize: 26, color: theme.nightInk2 }}>{String(CANARY.caught)} of {String(CANARY.total)} planted items caught, pattern layer only</div>
        </Fade>
      </div>
      <Captions scene="canary" dark />
    </Stage>
  );
};

// ------------------------------------------------------------------ 7. receipt and wipe
const FIELDS: [string, string][] = [
  ['Masked', Object.entries(NOTE_COUNTS).map(([k, v]) => `${CAT[k] ?? k} ${String(v.entities)}`).join(', ')],
  ['Sensitivity', 'cloud used'],
  ['Sent to the cloud', 'the masked abstract only'],
  ['Abstract SHA-256', '05f50322a00477df4b3146fa448b976d…'],
  ['Passes', 'pattern layer: this device, in code · model layer and brief: the source Firebase AI Logic reports for each call'],
  ['Signature', 'Ed25519, signed in this browser (WebCrypto)'],
];

export const ReceiptScene: React.FC<{ duration: number }> = () => {
  const verify = cue('receipt', 'Verify', 0, 6.6);
  const wipe = cue('receipt', 'wipe', 0, 8.6);
  const gone = cue('receipt', 'raw', 0, 9.8);
  return (
    <Stage>
      <Micro a="Receipt" b="Ed25519 (05)" style={{ position: 'absolute', left: 110, top: 64 }} />
      <div style={{ position: 'absolute', left: 100, top: 150, width: 720 }}>
        <div style={{ ...panel, padding: '34px 40px', height: 560, overflow: 'hidden' }}>
          <div style={{ fontSize: 17, color: theme.ink3, marginBottom: 10 }}>The raw text</div>
          <Doc text={NOTE} masks={[]} revealAt={() => 0} size={17.5} lineHeight={1.9} wipe={wipe} />
        </div>
        <Fade from={gone}><div style={{ marginTop: 30, fontSize: 46, fontWeight: 300, letterSpacing: -1.6 }}>The raw text no longer exists here.</div></Fade>
      </div>
      <Pop at={cue('receipt', 'signed', 0, 2)} style={{ position: 'absolute', left: 880, top: 150 }}>
        <div style={{ ...panel, width: 940, padding: '36px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginBottom: 14 }}>
            <Donut size={120} ring={0.2} style={{ color: theme.ink }} />
            <div><div style={{ fontSize: 34, fontWeight: 300, letterSpacing: -1 }}>Signed receipt</div><div style={{ fontSize: 19, color: theme.ink3 }}>The only record that remains</div></div>
          </div>
          {FIELDS.map(([k, v], i) => (
            <Fade key={k} from={cue('receipt', 'what', 0, 3.4) + i * 7}>
              <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', padding: '13px 0', borderBottom: `1px solid rgba(15,16,18,.1)`, fontSize: 21 }}>
                <span style={{ color: theme.ink3 }}>{k}</span><span>{v}</span>
              </div>
            </Fade>
          ))}
          <Fade from={verify + 10}><div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: theme.ok }}><Dot size={12} color={theme.ok} /><b style={{ fontWeight: 600 }}>Valid.</b> The signature matches every field on this receipt.</div></Fade>
        </div>
      </Pop>
      <Tech items={['Inference source from Firebase AI Logic', 'WebCrypto Ed25519']} at={cue('receipt', 'Firebase', 0, 8)} />
      <Captions scene="receipt" />
    </Stage>
  );
};

// ------------------------------------------------------------------ 8. close
export const CloseScene: React.FC<{ duration: number }> = () => {
  const frame = useCurrentFrame();
  const line = (text: string, at: number) => <div style={{ fontSize: 76, fontWeight: 300, letterSpacing: -2.8, lineHeight: 1.16 }}><BlurText text={text} at={at} /></div>;
  return (
    <Stage dark>
      <AbsoluteFill style={{ padding: '150px 150px' }}>
        <Pop at={2}><div style={{ fontSize: 150, fontWeight: 200, letterSpacing: -8, lineHeight: 0.9, marginBottom: 60, marginTop: 40 }}>VEIL</div></Pop>
        {line('Redacted on your device.', cue('close', 'Redacted', 0, 1.2))}
        {line('Reasoned in the cloud.', cue('close', 'Reasoned', 0, 2.8))}
        {line('Proven on the receipt.', cue('close', 'Proven', 0, 4.2))}
      </AbsoluteFill>
      <Lens size={360} x={1480 + Math.sin(frame / 36) * 24} y={380} dark blur={10} />
      <Donut size={170} tint={theme.steel} style={{ position: 'absolute', right: 190, bottom: 250, color: theme.nightInk }} ring={0.2} />
      <Fade from={cue('close', 'Proven', 0, 4.2) + 30} style={{ position: 'absolute', left: 150, bottom: 150, fontSize: 24, color: theme.nightInk3 }}>
        An illustrated walkthrough of the app. The canary result is from a test we ran in desktop Chrome. Try it live at veil-redact.web.app
      </Fade>
      <Tech dark items={['Firebase AI Logic', 'Firebase App Check', 'Firebase Hosting']} at={cue('close', 'Firebase', 0, 1.6)} />
      <Captions scene="close" dark />
    </Stage>
  );
};
