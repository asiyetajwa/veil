// Model passes through Firebase AI Logic. Three rules are enforced here, in code:
// 1. Raw text only ever goes to an ONLY_ON_DEVICE model. If no on-device model exists the call fails; it never
//    falls back to the cloud.
// 2. The cloud only ever receives masked text, built by the caller and shown verbatim in the page.
// 3. The inference source on every result is the one the SDK reports, never assumed.

import { firebaseConfig, appCheckSiteKey } from './firebase-config.js';
import { MODEL_CATEGORIES } from './categories.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.5.0';
const CLOUD_MODEL = 'gemini-2.5-flash';

let ready;
/** Connects Firebase, App Check and AI Logic once. Resolves to null when the app is not configured. */
export function connect() {
  ready ??= (async () => {
    if (!firebaseConfig) return null;
    const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, ai] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-app-check.js`),
      import(`${SDK}/firebase-ai.js`),
    ]);
    const app = initializeApp(firebaseConfig);
    // App Check before any AI call. On localhost, set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true before this runs and
    // register the printed token in the console.
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    return { sdk: ai, instance: ai.getAI(app, { backend: new ai.GoogleAIBackend() }) };
  })();
  return ready;
}

export const configured = () => Boolean(firebaseConfig);
/** Whether this browser exposes an on-device language model at all (the SDK still decides at call time). */
export const deviceApiPresent = () => typeof globalThis.LanguageModel !== 'undefined';

// ------------------------------------------------------------------ schemas
const EXTRACT_JSON = {
  type: 'object',
  properties: {
    spans: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, category: { type: 'string', enum: MODEL_CATEGORIES } },
        required: ['text', 'category'],
      },
    },
  },
  required: ['spans'],
};

const BRIEF_JSON = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    decisions: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, task: { type: 'string' }, due: { type: 'string' } }, required: ['owner', 'task'] } },
    draft: { type: 'string' },
  },
  required: ['summary', 'decisions', 'actions'],
};

const SUMMARY_JSON = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };

/** Converts a plain JSON schema into the SDK's Schema for the cloud model. */
function toSdkSchema(S, js) {
  switch (js.type) {
    case 'object': {
      const optional = Object.keys(js.properties).filter((k) => !(js.required ?? []).includes(k));
      return S.object({ properties: Object.fromEntries(Object.entries(js.properties).map(([k, v]) => [k, toSdkSchema(S, v)])), optionalProperties: optional });
    }
    case 'array': return S.array({ items: toSdkSchema(S, js.items) });
    default: return js.enum ? S.enumString({ enum: js.enum }) : S.string();
  }
}

function model(conn, mode, schema) {
  const { sdk, instance } = conn;
  return sdk.getGenerativeModel(instance, {
    mode,
    inCloudParams: { model: CLOUD_MODEL, generationConfig: { responseMimeType: 'application/json', responseSchema: toSdkSchema(sdk.Schema, schema), temperature: 0.2 } },
    onDeviceParams: { createOptions: { expectedInputs: [{ type: 'text' }] }, promptOptions: { responseConstraint: schema } },
  });
}

function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  return JSON.parse(t);
}

async function run(conn, mode, schema, prompt) {
  const result = await model(conn, mode, schema).generateContent(prompt);
  const response = result.response;
  return { data: parseJson(response.text()), source: response.inferenceSource ?? 'not reported' };
}

export class Unavailable extends Error {}

const EXTRACT_PROMPT = (chunk) => `Find sensitive items in the text below that a privacy filter must hide.
Categories: NAME (a person's name, including a first name on its own), ORG (a company or organisation), PLACE (a city, site, address or country), ROLE (a job title tied to a person), HEALTH (an illness, injury, treatment or medical detail about a person), SECRET (a password, code, key or other credential).
Return every item exactly as it is written in the text. Skip anything already in square brackets.

Text:
"""
${chunk}
"""`;

/** Splits long text at paragraph boundaries so each model call stays small. */
export function chunks(text, size = 1400) {
  const out = [];
  let cur = '';
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length > size) { out.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + para;
  }
  if (cur) out.push(cur);
  return out;
}

/** Model layer on the raw text, on this device only. Throws Unavailable when there is no on-device model. */
export async function extractOnDevice(text, onProgress) {
  const conn = await connect();
  if (!conn) throw new Unavailable('The model passes are not connected in this build.');
  const found = [];
  const sources = new Set();
  const parts = chunks(text);
  for (const [i, part] of parts.entries()) {
    onProgress?.(i, parts.length);
    try {
      const { data, source } = await run(conn, conn.sdk.InferenceMode.ONLY_ON_DEVICE, EXTRACT_JSON, EXTRACT_PROMPT(part));
      sources.add(source);
      found.push(...(data.spans ?? []));
    } catch (e) {
      if (e?.code === 'unsupported' || e?.code === 'api-not-enabled' || /not available|unsupported/i.test(String(e?.message))) throw new Unavailable('This browser has no on-device model.');
      throw e;
    }
  }
  return { spans: found, source: [...sources].join(', ') || 'on_device' };
}

/** Fallback model layer: the cloud model reads the pattern-masked text only, with the user's approval. */
export async function extractInCloudMasked(maskedText) {
  const conn = await connect();
  if (!conn) throw new Unavailable('The model passes are not connected in this build.');
  const found = [];
  const sources = new Set();
  for (const part of chunks(maskedText)) {
    const { data, source } = await run(conn, conn.sdk.InferenceMode.ONLY_IN_CLOUD, EXTRACT_JSON, EXTRACT_PROMPT(part));
    sources.add(source);
    found.push(...(data.spans ?? []));
  }
  return { spans: found, source: [...sources].join(', ') };
}

/** The exact text the cloud brief sends: instructions plus the masked abstract, nothing else. */
export const briefPayload = (abstract) => `Turn these notes into a working brief. Names, numbers and other details are masked as [LABEL n]; keep every mask exactly as written and never guess what is behind one.
Return a short summary, the decisions made, the action items with an owner (a mask is fine) and a due date if one is stated, and a short draft reply to the group.

Notes:
"""
${abstract}
"""`;

/** The cloud pass. Receives the payload built above, which the page shows verbatim. */
export async function cloudBrief(payload) {
  const conn = await connect();
  if (!conn) throw new Unavailable('The model passes are not connected in this build.');
  return run(conn, conn.sdk.InferenceMode.ONLY_IN_CLOUD, BRIEF_JSON, payload);
}

/** The on-device summary offered when the cloud pass is blocked. Reads the masked abstract, on this device only. */
export async function deviceSummary(abstract) {
  const conn = await connect();
  if (!conn) throw new Unavailable('The model passes are not connected in this build.');
  try {
    return await run(conn, conn.sdk.InferenceMode.ONLY_ON_DEVICE, SUMMARY_JSON, `Summarise these notes in three or four plain sentences. Keep every [LABEL n] mask exactly as written.\n\nNotes:\n"""\n${abstract}\n"""`);
  } catch (e) {
    if (/not available|unsupported/i.test(String(e?.message))) throw new Unavailable('This browser has no on-device model.');
    throw e;
  }
}
