// Core tests: the pattern layer, the mask map, the policy gate, receipts and canary scoring. Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patternSpans } from '../public/js/patterns.js';
import { buildMasks, redact, fillIn, locate, counts } from '../public/js/masks.js';
import { gate, outcome } from '../public/js/policy.js';
import { sign, verify, canonical } from '../public/js/receipt.js';
import { SEEDS, parseSeed } from '../public/js/seeds.js';
import { score, combine } from '../public/js/canary.js';

const cats = (text) => buildMasks(text, patternSpans(text)).map((m) => `${m.category}:${m.original}`);

test('pattern layer finds emails, links, phones, money and birth dates', () => {
  const t = 'Mail jo.ann@firm.example or see https://firm.example/x. Call +44 20 7946 0321. Fee $1,200.50. DOB: 02/11/1990.';
  const found = cats(t);
  assert.ok(found.includes('EMAIL:jo.ann@firm.example'));
  assert.ok(found.includes('URL:https://firm.example/x'));
  assert.ok(found.includes('PHONE:+44 20 7946 0321'));
  assert.ok(found.includes('MONEY:$1,200.50'));
  assert.ok(found.includes('DATE:02/11/1990'));
});

test('a card number split by spaces is an account, a labelled number is an account, a plain phone is a phone', () => {
  assert.ok(cats('card 4539 1488 0343 6467 was charged').includes('ACCOUNT:4539 1488 0343 6467'));
  assert.ok(cats('account number 0041 2237 9910 today').includes('ACCOUNT:0041 2237 9910'));
  assert.ok(cats('mobile 0712 345 678 any time').includes('PHONE:0712 345 678'));
  assert.deepEqual(cats('Ticket 88213, room 12, year 2026'), []);
});

test('secrets: the value after a credential word is masked, not the word', () => {
  const found = cats('She read out her password: Tulip#2291. The PIN is 4471.');
  assert.ok(found.includes('SECRET:Tulip#2291'));
  assert.ok(found.includes('SECRET:4471'));
});

test('a health mask stops at the joining word, not the end of the sentence', () => {
  assert.ok(cats('She is on medication for epilepsy and needs written instructions, not calls.').includes('HEALTH:epilepsy'));
  assert.ok(cats('He was diagnosed with type 2 diabetes last year.').includes('HEALTH:type 2 diabetes last year'));
});

test('the same entity gets the same label everywhere; labels count per category', () => {
  const text = 'Call Ana on +351 912 345 678. Ana again: +351 912 345 678. Or +44 20 7946 0321.';
  const spans = [...patternSpans(text), ...locate(text, 'Ana').map((s) => ({ ...s, category: 'NAME', source: 'model' }))];
  const masks = buildMasks(text, spans);
  assert.equal(redact(text, masks), 'Call [NAME 1] on [PHONE 1]. [NAME 1] again: [PHONE 1]. Or [PHONE 2].');
  assert.deepEqual(counts(masks).PHONE, { entities: 2, occurrences: 3 });
  assert.equal(fillIn('Ring [NAME 1] on [PHONE 2].', masks), 'Ring Ana on +44 20 7946 0321.');
});

test('on overlap a high-sensitivity mask wins', () => {
  const text = 'acct 12345678';
  const masks = buildMasks(text, [{ start: 5, end: 13, category: 'PHONE' }, { start: 5, end: 13, category: 'ACCOUNT' }]);
  assert.equal(masks.length, 1);
  assert.equal(masks[0]?.category, 'ACCOUNT');
});

test('locate finds whole words only and skips covered text', () => {
  assert.deepEqual(locate('Will will willow Will', 'Will').map((s) => s.start), [0, 17]);
  assert.deepEqual(locate('Will will willow Will', 'Will', [], { ignoreCase: true }).map((s) => s.start), [0, 5, 17]);
  assert.deepEqual(locate('Will Rivers and Will', 'Will', [{ start: 0, end: 11 }]).map((s) => s.start), [16]);
});

test('policy gate blocks high-sensitivity categories and names the outcome', () => {
  const t = 'card 4539 1488 0343 6467, email a@b.example';
  const g = gate(buildMasks(t, patternSpans(t)));
  assert.equal(g.blocked, true);
  assert.deepEqual(g.high, ['ACCOUNT']);
  assert.equal(gate(buildMasks('a@b.example', patternSpans('a@b.example'))).blocked, false);
  assert.equal(outcome({ blocked: true, override: true, cloudUsed: true }), 'overridden');
  assert.equal(outcome({ blocked: true, deviceSummary: true }), 'blocked, on-device summary');
  assert.equal(outcome({ blocked: false, cloudUsed: true }), 'cloud used');
});

test('receipts verify after a JSON round trip and fail when a field changes', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const r = await sign({ id: 'VL-TEST01', masks: { NAME: 3 }, outcome: 'cloud used' }, kp);
  const back = JSON.parse(JSON.stringify(r));
  assert.equal((await verify(back)).valid, true);
  back.body.outcome = 'not sent';
  assert.equal((await verify(back)).valid, false);
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test('seeds parse to clean text with exact planted offsets', () => {
  for (const s of SEEDS) {
    const { text, planted } = parseSeed(s.text);
    assert.ok(!text.includes('{{'));
    for (const p of planted) assert.equal(text.slice(p.start, p.end), p.text);
  }
});

test('canary: the pattern layer alone, measured on the seeds (the model layer adds names, places, organisations)', () => {
  const scores = SEEDS.map((s) => {
    const { text, planted } = parseSeed(s.text);
    return score(planted, buildMasks(text, patternSpans(text)));
  });
  const all = combine(scores);
  console.log('pattern layer only:', JSON.stringify(all.byCategory), `${String(all.caught)}/${String(all.total)}`, `extra masks ${String(all.extra)}`);
  for (const s of scores) for (const m of s.missed) if (!['NAME', 'ORG', 'PLACE', 'ROLE'].includes(m.category)) console.log('  missed', m.category, JSON.stringify(m.text));
  for (const k of ['EMAIL', 'PHONE', 'ACCOUNT', 'MONEY', 'URL', 'DATE']) assert.equal(all.byCategory[k]?.caught, all.byCategory[k]?.planted, k);
  assert.equal(all.extra, 0);
});
