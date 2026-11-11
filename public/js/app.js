// Veil, the page. Five steps on one page, plus canary mode. Everything here runs in the browser; the only network
// calls are the model passes in ai.js, and the cloud only ever receives the masked abstract shown in step 4.

import { CATEGORIES, isHigh } from './categories.js';
import { patternSpans } from './patterns.js';
import { buildMasks, redact, segments, counts, fillIn, locate, categoryLabel } from './masks.js';
import { gate, outcome } from './policy.js';
import { sign, verify, sha256, receiptId } from './receipt.js';
import { SEEDS, SAMPLES, parseSeed } from './seeds.js';
import { score, combine } from './canary.js';
import * as ai from './ai.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MAX_CHARS = 60000;

const state = {
  raw: '',
  spans: [], // every span from every layer and the user, before merging
  removed: new Set(), // "CATEGORY|text" keys the user unmasked
  masks: [],
  open: new Set(), // labels revealed locally
  layers: { pattern: null, model: null },
  edits: { added: 0, removed: 0 },
  gate: null,
  override: false,
  pass: null, // { kind: 'cloud' | 'device', source, payload, result }
  receipt: null,
};

// ------------------------------------------------------------------ steps
const RAIL_TOP = { 1: 20, 2: 95, 3: 170, 4: 245, 5: 320 };
function setStep(n, { scroll = true } = {}) {
  // After a wipe only intake and the receipt remain: the steps in between held the raw text and its results.
  for (const i of [1, 2, 3, 4, 5]) {
    $(`#step-${String(i)}`).hidden = state.receipt ? !(i === 1 || i === 5) : i > n;
  }
  $('#rail-blob').style.top = `${String(RAIL_TOP[n])}px`;
  document.querySelectorAll('.rail-labels li').forEach((li) => li.classList.toggle('on', Number(li.dataset.step) <= n));
  if (scroll) $(`#step-${String(n)}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ------------------------------------------------------------------ 1. intake
const raw = $('#raw');
function onInput() {
  const n = raw.value.length;
  $('#char-count').textContent = `${n.toLocaleString()} characters${n > MAX_CHARS ? `, over the ${MAX_CHARS.toLocaleString()} limit` : ''}`;
  $('#prepare').disabled = n === 0 || n > MAX_CHARS;
}
raw.addEventListener('input', onInput);
document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => {
  const seed = [...SAMPLES, ...SEEDS].find((s) => s.id === b.dataset.sample);
  if (!seed) return;
  raw.value = parseSeed(seed.text).text;
  onInput();
}));

async function readFile(file) {
  if (!file) return;
  if (!/\.(txt|md|eml)$/i.test(file.name) && !/^text\//.test(file.type)) {
    $('#char-count').textContent = `${file.name} is not a .txt, .md or .eml file. Nothing was read.`;
    return;
  }
  raw.value = await file.text(); // read as text only; never opened, rendered or run
  onInput();
}
$('#file').addEventListener('change', (e) => { void readFile(e.target.files?.[0]); });
const drop = $('#drop');
for (const t of ['dragenter', 'dragover']) drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const t of ['dragleave', 'drop']) drop.addEventListener(t, () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); void readFile(e.dataTransfer?.files?.[0]); });

// ------------------------------------------------------------------ 2. on-device pass
const keyOf = (category, text) => `${category}|${text.toLowerCase().replace(/\s+/g, ' ').trim()}`;

function rebuild() {
  const spans = state.spans.filter((s) => !state.removed.has(keyOf(s.category, state.raw.slice(s.start, s.end))));
  state.masks = buildMasks(state.raw, spans);
  renderDoc();
  renderRings();
}

/** Places model findings (text plus category) onto exact offsets in the raw text, every occurrence. */
function placeModelSpans(found, source) {
  const taken = state.spans.map((s) => ({ start: s.start, end: s.end }));
  for (const f of found) {
    const category = String(f.category ?? '').toUpperCase();
    const text = String(f.text ?? '');
    if (!CATEGORIES[category] || !text || text.includes('[')) continue;
    for (const at of locate(state.raw, text, taken)) {
      state.spans.push({ ...at, category, source });
      taken.push(at);
    }
  }
}

$('#prepare').addEventListener('click', async () => {
  state.raw = raw.value;
  state.spans = patternSpans(state.raw);
  state.removed = new Set();
  state.open = new Set();
  state.edits = { added: 0, removed: 0 };
  state.layers = { pattern: { ran: 'on this device, in code' }, model: null };
  state.pass = null;
  state.override = false;
  state.namesUnmaskedSent = false;
  rebuild();
  setStep(2);
  await runModelLayer();
});

async function runModelLayer() {
  const fb = $('#fallback');
  fb.hidden = true;
  if (!ai.configured()) {
    state.layers.model = { state: 'not connected', note: 'The model passes are not connected in this build. The pattern layer ran; names, places and organisations need the model layer.' };
    renderLayers();
    return;
  }
  state.layers.model = { state: 'running', note: 'Reading names, places and organisations on this device.' };
  renderLayers();
  try {
    const { spans, source } = await ai.extractOnDevice(state.raw, (i, n) => {
      state.layers.model.note = n > 1 ? `Reading part ${String(i + 1)} of ${String(n)} on this device.` : 'Reading on this device.';
      renderLayers();
    });
    placeModelSpans(spans, 'model');
    state.layers.model = { state: 'ran', source, input: 'raw text', note: `Ran with the SDK reporting ${source}.` };
    rebuild();
  } catch (e) {
    if (e instanceof ai.Unavailable) {
      state.layers.model = { state: 'unavailable', note: 'This browser has no on-device model, so names, places and organisations are not masked yet. Raw text is never sent to make up for it.' };
      fb.hidden = false;
      fb.innerHTML = `<span>You can let the cloud model look for names in the text that is already masked. It sees only what step 4 would send.</span><button class="pill pill-ghost" id="cloud-extract" type="button"><i class="dot"></i>Find Names in the Cloud, on Masked Text</button>`;
      $('#cloud-extract').addEventListener('click', cloudExtract, { once: true });
    } else {
      state.layers.model = { state: 'failed', note: `The model layer stopped: ${String(e?.message ?? e)}. The pattern layer still applies.` };
    }
  }
  renderLayers();
}

async function cloudExtract() {
  const fb = $('#fallback');
  fb.innerHTML = '<span>Sending the masked text only.</span>';
  try {
    const masked = redact(state.raw, state.masks);
    const { spans, source } = await ai.extractInCloudMasked(masked);
    placeModelSpans(spans, 'model');
    state.layers.model = { state: 'ran', source, input: 'masked text', note: `Ran on the masked text, with the SDK reporting ${source}.` };
    fb.hidden = true;
    rebuild();
  } catch (e) {
    fb.innerHTML = `<span>The cloud model could not be reached: ${esc(String(e?.message ?? e))}</span>`;
  }
  renderLayers();
}

function renderLayers() {
  const m = state.layers.model;
  const rows = [
    { cls: 'ran', title: 'Pattern layer', text: 'Ran on this device, in code: emails, phones, links, account and card numbers, secrets, amounts, birth dates.' },
    m ? { cls: m.state === 'ran' ? 'ran' : m.state === 'running' ? '' : 'missing', title: 'Model layer', text: m.note } : null,
  ].filter(Boolean);
  $('#layers').innerHTML = rows.map((r) => `<li class="${r.cls}"><i class="dot"></i><div><b>${esc(r.title)}</b><br><span>${esc(r.text)}</span></div></li>`).join('');
  const sent = state.layers.model?.input === 'masked text';
  $('#local-status').innerHTML = sent
    ? '<i class="dot"></i>Only masked text has left this device.'
    : '<i class="dot"></i>Nothing has left this device.';
}

function renderDoc() {
  const doc = $('#doc');
  const segs = segments(state.raw, state.masks);
  let html = '';
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.kind === 'text') { html += `<span data-start="${String(s.start)}">${esc(s.text)}</span>`; continue; }
    const open = state.open.has(s.label);
    const cls = ['mask', isHigh(s.category) ? 'high' : '', s.source === 'model' ? 'model' : '', open ? 'open' : ''].join(' ');
    const chip = `<button type="button" class="${cls}" data-label="${esc(s.label)}" title="${esc(categoryLabel(s.category))}"><i class="dot"></i>${esc(open ? s.original : s.label)}</button>`;
    // Keep a mask and the punctuation right after it on one line.
    const next = segs[i + 1];
    const punct = next?.kind === 'text' ? /^[.,;:!?)'"]+/.exec(next.text)?.[0] : undefined;
    if (punct && next) {
      html += `<span class="nb">${chip}<span data-start="${String(next.start)}">${esc(punct)}</span></span>`;
      segs[i + 1] = { ...next, start: next.start + punct.length, text: next.text.slice(punct.length) };
    } else {
      html += chip;
    }
  }
  doc.innerHTML = html;
}

// Tap a mask: reveal it here; the bar offers to unmask it everywhere.
$('#doc').addEventListener('click', (e) => {
  const b = e.target.closest('.mask');
  if (!b) return;
  const label = b.dataset.label;
  const m = state.masks.find((x) => x.label === label);
  if (!m) return;
  if (state.open.has(label)) state.open.delete(label); else state.open.add(label);
  renderDoc();
  const bar = $('#maskbar');
  if (!state.open.has(label)) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<span><b>${esc(label)}</b> is <em>${esc(m.original)}</em>, shown on this device only.</span><button class="chip" type="button" id="unmask">Unmask Everywhere</button><button class="chip" type="button" id="keep">Keep Masked</button>`;
  $('#unmask').addEventListener('click', () => {
    state.removed.add(keyOf(m.category, m.original));
    state.open.delete(label);
    state.edits.removed++;
    bar.hidden = true;
    rebuild();
  });
  $('#keep').addEventListener('click', () => { state.open.delete(label); bar.hidden = true; renderDoc(); });
});

// Select text: offer to mask it (every occurrence, same label).
$('#doc').addEventListener('mouseup', () => {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  const a = r.startContainer.parentElement?.closest('[data-start]');
  const b = r.endContainer.parentElement?.closest('[data-start]');
  if (!a || !b) return;
  let start = Number(a.dataset.start) + r.startOffset;
  let end = Number(b.dataset.start) + r.endOffset;
  while (start < end && /\s/.test(state.raw[start])) start++;
  while (end > start && /\s/.test(state.raw[end - 1])) end--;
  if (end - start < 2 || state.masks.some((m) => start < m.end && end > m.start)) return;
  const text = state.raw.slice(start, end);
  const bar = $('#maskbar');
  bar.hidden = false;
  const choices = ['NAME', 'ORG', 'PLACE', 'ROLE', 'ACCOUNT', 'SECRET', 'HEALTH'];
  bar.innerHTML = `<span>Mask <em>${esc(text.length > 40 ? `${text.slice(0, 40)}…` : text)}</em> as</span>${choices.map((c) => `<button class="chip" type="button" data-cat="${c}">${esc(categoryLabel(c))}</button>`).join('')}`;
  bar.querySelectorAll('[data-cat]').forEach((c) => c.addEventListener('click', () => {
    const category = c.dataset.cat;
    state.removed.delete(keyOf(category, text));
    const taken = state.masks.map((m) => ({ start: m.start, end: m.end }));
    const spots = locate(state.raw, text, taken);
    for (const at of spots.length ? spots : [{ start, end }]) state.spans.push({ ...at, category, source: 'user' });
    state.edits.added++;
    bar.hidden = true;
    sel.removeAllRanges();
    rebuild();
  }));
});

/** Hairline measurement rings, one per category, with the count on the ring. */
function renderRings() {
  const c = counts(state.masks);
  const cats = Object.keys(c).sort((x, y) => c[y].occurrences - c[x].occurrences);
  const size = 280;
  const mid = size / 2;
  const total = state.masks.length;
  const rings = cats.map((k, i) => {
    const r = 62 + i * 13;
    const ang = (-60 + i * 31) * (Math.PI / 180);
    const x = mid + r * Math.cos(ang);
    const y = mid + r * Math.sin(ang);
    return `<circle cx="${String(mid)}" cy="${String(mid)}" r="${String(r)}" fill="none" stroke="${isHigh(k) ? '#2a1d17' : '#b9bcc0'}" stroke-width="${isHigh(k) ? 1.6 : 1}"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${isHigh(k) ? '#2a1d17' : '#0f1012'}"/>
      <text x="${(x + 7).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="9.5" fill="#55595f" font-family="Inter Tight">${esc(categoryLabel(k))} ${String(c[k].entities)}</text>`;
  }).join('');
  $('#rings').innerHTML = `<svg viewBox="0 0 ${String(size)} ${String(size)}" width="${String(size)}" height="${String(size)}" aria-hidden="true">${rings}</svg>
    <div class="total"><div><b>${String(total)}</b><small>masks across ${String(cats.length)} ${cats.length === 1 ? 'category' : 'categories'}</small></div></div>`;
}

// ------------------------------------------------------------------ 3. policy gate
$('#to-gate').addEventListener('click', () => {
  state.gate = gate(state.masks);
  renderGate();
  setStep(3);
});

function renderGate() {
  const g = state.gate;
  const abstract = redact(state.raw, state.masks);
  const connected = ai.configured();
  $('#gate-dial').classList.toggle('open', !g.blocked);
  const offline = connected ? '' : '<p>The model passes are not connected in this build, so nothing can be sent. You can still sign a receipt for the masking.</p>';
  // Without the model layer, names, places and organisations are still raw. Say so here, offer the name search on
  // the already-masked text first, and make sending without it an explicit, recorded choice.
  const namesMasked = state.layers.model?.state === 'ran';
  const names = connected && !namesMasked
    ? `<p class="warn"><i class="dot"></i>Names, places and organisations are not masked yet: the model layer did not run in this browser. Look for them on the masked text first, or send knowing the cloud will see them. Either choice is recorded on the receipt.</p>`
    : '';
  const findFirst = connected && !namesMasked ? '<button class="pill pill-ink" id="find-first" type="button"><i class="dot"></i>Find Names on the Masked Text First</button>' : '';
  const sendLabel = namesMasked || !connected ? null : 'Without Name Masking';
  if (!g.blocked) {
    $('#gate-copy').innerHTML = `<h3>Clear to send the abstract.</h3>
      <p>Every mask here is a standard category. The cloud receives ${abstract.length.toLocaleString()} characters of masked text and never the original.</p>${names}${offline}
      <div class="row">${findFirst}<button class="pill ${findFirst ? 'pill-ghost' : 'pill-ink'}" id="send" type="button" ${connected ? '' : 'disabled'}><i class="dot"></i>${sendLabel ? `Send ${sendLabel}` : 'Send the Abstract to the Cloud'}</button><button class="pill pill-ghost" id="skip" type="button"><i class="dot"></i>Sign Without Sending</button></div>`;
  } else {
    const tags = g.high.map((c) => `<span class="tag"><i class="dot"></i>${esc(categoryLabel(c))}</span>`).join('');
    $('#gate-copy').innerHTML = `<h3>The cloud pass is blocked by default.</h3>
      <p>${tags}</p>
      <p>This text holds high-sensitivity items. Veil can write a rougher summary on this device instead, from the masked text, with nothing sent. Or you can send the masked abstract anyway: every mask stays in place, and the override is recorded on the receipt.</p>${names}${offline}
      <div class="row"><button class="pill pill-ink" id="local" type="button" ${connected && state.layers.model?.state !== 'unavailable' ? '' : 'disabled'} title="${state.layers.model?.state === 'unavailable' ? 'This browser has no on-device model.' : ''}"><i class="dot"></i>Summarise on This Device</button>${findFirst.replace('pill-ink', 'pill-ghost')}<button class="pill pill-ghost" id="send" type="button" ${connected ? '' : 'disabled'}><i class="dot"></i>Send Anyway${sendLabel ? `, ${sendLabel}` : ''}</button><button class="pill pill-ghost" id="skip" type="button"><i class="dot"></i>Sign Without Sending</button></div>`;
    $('#local')?.addEventListener('click', runDeviceSummary);
  }
  $('#find-first')?.addEventListener('click', async () => {
    $('#find-first').disabled = true;
    await cloudExtract();
    state.gate = gate(state.masks);
    renderGate();
  });
  $('#send')?.addEventListener('click', () => { state.override = g.blocked; state.namesUnmaskedSent = !namesMasked; void runCloud(); });
  $('#skip').addEventListener('click', () => { void signAndWipe(); });
}

// ------------------------------------------------------------------ 4. cloud pass (or the on-device summary)
async function runCloud() {
  const abstract = redact(state.raw, state.masks);
  const payload = ai.briefPayload(abstract);
  state.pass = { kind: 'cloud', payload, abstract, source: null, result: null };
  showPass();
  try {
    const { data, source } = await ai.cloudBrief(payload);
    state.pass.result = data;
    state.pass.source = source;
  } catch (e) {
    state.pass.error = String(e?.message ?? e);
  }
  showPass();
}

async function runDeviceSummary() {
  const abstract = redact(state.raw, state.masks);
  state.pass = { kind: 'device', payload: null, abstract, source: null, result: null };
  showPass();
  try {
    const { data, source } = await ai.deviceSummary(abstract);
    state.pass.result = { summary: data.summary, decisions: [], actions: [] };
    state.pass.source = source;
  } catch (e) {
    state.pass.error = e instanceof ai.Unavailable ? 'This browser has no on-device model, so the on-device summary cannot run here.' : String(e?.message ?? e);
  }
  showPass();
}

function showPass() {
  const p = state.pass;
  setStep(4, { scroll: !p.result && !p.error });
  const cloud = p.kind === 'cloud';
  $('#step-4 .micro').innerHTML = cloud ? '<span>In the cloud</span><span>Abstract only (04)</span>' : '<span>On your device</span><span>Summary, nothing sent (04)</span>';
  $('#received').hidden = !cloud;
  if (cloud) {
    $('#payload').textContent = p.payload;
    $('#received-size').textContent = `${p.payload.length.toLocaleString()} characters, all masked`;
  }
  $('#cloud-source').textContent = p.source ? `Source reported by the SDK: ${p.source}` : '';
  renderBrief();
}

function withMasks(text) {
  const fill = $('#fill').checked;
  const shown = fill ? fillIn(text, state.masks) : text;
  if (fill) {
    // Mark what was filled in locally.
    let out = esc(text);
    for (const m of state.masks) out = out.split(esc(`[${m.label}]`)).join(`<span class="filled">${esc(m.original)}</span>`);
    return out;
  }
  return esc(shown).replace(/\[([A-Z]+ \d+)\]/g, '<span class="lab">$1</span>');
}

function renderBrief() {
  const p = state.pass;
  const b = $('#brief');
  if (p.error) { b.innerHTML = `<section class="wide"><h4>Not completed</h4><p>${esc(p.error)}</p></section>`; return; }
  if (!p.result) { b.innerHTML = `<section class="wide"><h4>${p.kind === 'cloud' ? 'The cloud model is reading the abstract' : 'The on-device model is summarising'}</h4><p>…</p></section>`; return; }
  const r = p.result;
  const list = (xs) => xs.length ? `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p>None stated.</p>';
  b.innerHTML = `<section class="wide"><h4>Summary${p.kind === 'device' ? ', written on this device (rougher than the cloud brief)' : ''}</h4><p>${withMasks(r.summary ?? '')}</p></section>`
    + (p.kind === 'cloud' ? `<section><h4>Decisions</h4>${list((r.decisions ?? []).map(withMasks))}</section>
      <section><h4>Action items</h4>${list((r.actions ?? []).map((a) => `${withMasks(a.owner ?? '')}: ${withMasks(a.task ?? '')}${a.due ? ` <span style="color:#7d8087">(${withMasks(a.due)})</span>` : ''}`))}</section>
      ${r.draft ? `<section class="wide"><h4>Draft reply</h4><p>${withMasks(r.draft)}</p></section>` : ''}` : '');
}
$('#fill').addEventListener('change', renderBrief);

// ------------------------------------------------------------------ 5. receipt and wipe
$('#to-receipt').addEventListener('click', () => { void signAndWipe(); });

async function signAndWipe() {
  const abstract = redact(state.raw, state.masks);
  const c = counts(state.masks);
  const p = state.pass;
  const cloudUsed = p?.kind === 'cloud' && Boolean(p.result);
  const deviceSummary = p?.kind === 'device' && Boolean(p.result);
  const g = state.gate ?? gate(state.masks);
  const m = state.layers.model;
  const body = {
    product: 'Veil',
    id: receiptId(),
    issuedAt: new Date().toISOString(),
    abstractSha256: await sha256(abstract),
    abstractSent: cloudUsed,
    characters: { raw: state.raw.length, sent: cloudUsed ? p.payload.length : 0 },
    masks: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.entities])),
    maskOccurrences: state.masks.length,
    userEdits: state.edits,
    sensitivity: { highCategories: g.high, outcome: outcome({ blocked: g.blocked, override: state.override, cloudUsed, deviceSummary }), namesMasked: m?.state === 'ran', sentWithoutNameMasking: cloudUsed && Boolean(state.namesUnmaskedSent) },
    passes: [
      { pass: 'pattern layer', ranOn: 'this device, in code' },
      { pass: 'model layer', source: m?.state === 'ran' ? m.source : m?.state ?? 'not run', input: m?.state === 'ran' ? m.input : 'none' },
      ...(p?.result ? [{ pass: p.kind === 'cloud' ? 'brief' : 'on-device summary', source: p.source, input: 'masked abstract' }] : []),
    ],
    wipedAt: new Date().toISOString(),
    statement: 'The raw text no longer exists here.',
  };
  state.receipt = await sign(body);
  wipe();
  renderReceipt();
  setStep(5);
}

function wipe() {
  raw.value = '';
  state.raw = '';
  state.spans = [];
  state.masks = [];
  state.open = new Set();
  state.removed = new Set();
  state.pass = null;
  $('#doc').innerHTML = '';
  $('#payload').textContent = '';
  $('#brief').innerHTML = '';
  $('#rings').innerHTML = '';
  $('#fill').checked = false;
  onInput();
  for (const i of [2, 3, 4]) $(`#step-${String(i)}`).hidden = true;
}

function renderReceipt() {
  const b = state.receipt.body;
  $('#receipt-id').textContent = b.id;
  const passes = b.passes.map((p) => `${p.pass}: ${p.ranOn ?? `${p.source}${p.input && p.input !== 'none' ? `, on ${p.input}` : ''}`}`).join('<br>');
  const masks = Object.entries(b.masks).map(([k, v]) => `${categoryLabel(k)} ${String(v)}`).join(', ') || 'none';
  const rows = [
    ['Receipt', b.id], ['Issued', b.issuedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')],
    ['Masked', masks], ['Sensitivity', b.sensitivity.outcome + (b.sensitivity.highCategories.length ? ` (${b.sensitivity.highCategories.map(categoryLabel).join(', ')})` : '')],
    ['Sent to the cloud', b.abstractSent ? `${b.characters.sent.toLocaleString()} characters of masked text${b.sensitivity.sentWithoutNameMasking ? ', without name masking (chosen at the gate)' : ''}` : 'nothing'],
    ['Abstract SHA-256', `<code>${b.abstractSha256}</code>`], ['Passes', passes],
    ['Public key', `<code>${b.publicKey}</code>`], ['Signature', `<code>${state.receipt.signature.slice(0, 44)}…</code>`],
  ];
  $('#fields').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${k === 'Passes' || k.endsWith('SHA-256') || k === 'Public key' || k === 'Signature' ? v : esc(v)}</dd>`).join('');
  $('#verify-out').className = 'verify-out';
  $('#verify-out').textContent = '';
}

async function showVerify(el, receipt) {
  const r = await verify(receipt);
  el.className = `verify-out ${r.valid ? 'valid' : 'invalid'}`;
  el.innerHTML = `<i class="dot"></i><b>${r.valid ? 'Valid.' : 'Not valid.'}</b> ${esc(r.reason)}`;
}
$('#verify').addEventListener('click', () => { void showVerify($('#verify-out'), state.receipt); });
$('#verify-other').addEventListener('click', () => {
  let parsed;
  try { parsed = JSON.parse($('#other').value); } catch { $('#other-out').className = 'verify-out invalid'; $('#other-out').textContent = 'That is not valid JSON.'; return; }
  void showVerify($('#other-out'), parsed);
});
$('#download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.receipt, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.receipt.body.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#restart').addEventListener('click', () => {
  state.receipt = null;
  $('#step-5').hidden = true;
  setStep(1);
});

// ------------------------------------------------------------------ canary mode
$('#canary-open').addEventListener('click', () => {
  $('#canary').hidden = false;
  renderLenses();
  $('#canary').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function renderLenses(done = {}) {
  $('#canary-lenses').innerHTML = SEEDS.map((s) => {
    const r = done[s.id];
    return `<div class="clens ${r ? 'done' : ''}">${r ? `<span class="clens-rate">${String(Math.round(r.rate * 100))}<small>%</small></span>` : '<i class="dot"></i>'}</div>`;
  }).join('');
  if (!$('.clens-labels')) $('#canary-lenses').insertAdjacentHTML('afterend', '<div class="clens-labels" id="clens-labels"></div>');
  $('#clens-labels').innerHTML = SEEDS.map((s) => {
    const { planted } = parseSeed(s.text);
    return `<div class="clens-label"><b>${esc(s.title)}</b>${String(planted.length)} planted</div>`;
  }).join('');
}

$('#canary-run').addEventListener('click', async () => {
  const btn = $('#canary-run');
  btn.disabled = true;
  const scores = [];
  const done = {};
  let modelNote = 'Pattern layer and on-device model layer.';
  let modelRan = ai.configured();
  for (const s of SEEDS) {
    const { text, planted } = parseSeed(s.text);
    const spans = patternSpans(text);
    if (modelRan) {
      try {
        const { spans: found } = await ai.extractOnDevice(text);
        const taken = spans.map((x) => ({ start: x.start, end: x.end }));
        for (const f of found) {
          const category = String(f.category ?? '').toUpperCase();
          if (!CATEGORIES[category] || !f.text) continue;
          for (const at of locate(text, String(f.text), taken)) { spans.push({ ...at, category, source: 'model' }); taken.push(at); }
        }
      } catch (e) {
        modelRan = false;
        modelNote = e instanceof ai.Unavailable ? 'Pattern layer only: this browser has no on-device model, and canary mode never uses the cloud.' : `Pattern layer only: the model layer stopped (${String(e?.message ?? e)}).`;
      }
    } else if (!ai.configured()) {
      modelNote = 'Pattern layer only: the model passes are not connected in this build.';
    }
    // Otherwise the model layer already stopped on an earlier document, and modelNote says why.
    const sc = score(planted, buildMasks(text, spans));
    scores.push({ seed: s, ...sc });
    done[s.id] = sc;
    renderLenses(done);
  }
  showScore(scores, modelNote);
  btn.disabled = false;
});

function showScore(scores, note) {
  const all = combine(scores);
  $('#canary-score').hidden = false;
  const pct = Math.round(all.rate * 100);
  const el = $('#rate');
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / 1100); el.textContent = String(Math.round(pct * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  $('#rate-meta').innerHTML = `<span><b>${String(all.caught)} of ${String(all.total)}</b> planted items caught across ${String(scores.length)} documents.</span><span>${esc(note)}</span><span>${String(all.extra)} extra ${all.extra === 1 ? 'mask' : 'masks'} on text that was not planted.</span><span>Zero raw characters were sent anywhere during this test.</span>`;
  $('#bars').innerHTML = Object.entries(all.byCategory).sort((a, b) => b[1].planted - a[1].planted).map(([k, v]) =>
    `<div class="bar"><span>${esc(categoryLabel(k))}</span><span class="t"><i style="width:${String(Math.round((v.caught / v.planted) * 100))}%"></i></span><span class="n">${String(v.caught)}/${String(v.planted)}</span></div>`).join('');
  const missed = scores.flatMap((s) => s.missed.map((m) => ({ ...m, doc: s.seed.title })));
  $('#misses').innerHTML = missed.length
    ? `<h4>Missed (${String(missed.length)})</h4><ul>${missed.map((m) => `<li>${esc(categoryLabel(m.category))}: <em>${esc(m.text)}</em> · ${esc(m.doc)}</li>`).join('')}</ul>`
    : '<h4>Nothing missed on these documents.</h4>';
}

onInput();
setStep(1, { scroll: false });
