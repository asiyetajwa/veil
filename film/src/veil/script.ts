// Veil, the entry film. Six beats from the video spec, in eight scenes. Copy rules: the product is Veil, the two
// passes are described by where they run (on your device, in the cloud), the model is never named, and every claim
// matches the shipped build. The canary line never speaks the catch rate: the number on screen comes from
// src/veil/canary-result.ts, which holds the rate measured in desktop Chrome.
// Voiceover: node scripts/voiceover.mjs veil (one clip per scene).

import type { SceneSpec } from '../components/Film';

export type SceneId = 'hook' | 'title' | 'masks' | 'gate' | 'cloud' | 'canary' | 'receipt' | 'close';

export const SCENES: SceneSpec<SceneId>[] = [
  { id: 'hook', voiceover: 'The notes you most need help with are the ones you least want to upload. Meeting transcripts. Email threads. Anything with names and numbers in it.', minSeconds: 9 },
  { id: 'title', voiceover: 'This is Veil. Your notes, redacted on your device, before any cloud sees them.', minSeconds: 6 },
  { id: 'masks', voiceover: 'Paste a messy transcript. A first pass runs right here, on your device. Patterns catch the emails, the phone numbers and the amounts. Then an on-device model finds the names, the places and the organisations. Every one becomes a mask, and nothing has left the device.', minSeconds: 17 },
  { id: 'gate', voiceover: 'Some things are too sensitive to send, even masked. Inside this support ticket: account numbers, credentials and health information. So the cloud pass is blocked by default, and Veil offers to write the summary on your device instead.', minSeconds: 14 },
  { id: 'cloud', voiceover: 'When the gate is clear, only the masked abstract goes to the cloud. This panel shows exactly what was sent: masks, and nothing raw. The cloud model turns it into a summary, the decisions and the action items. Then your device fills the real names back in.', minSeconds: 16 },
  { id: 'canary', voiceover: 'How well does the filter work? Canary mode answers that, live. Three documents with planted names, numbers and secrets, hard cases included. It reports what was caught, it lists what was missed, and the number on screen is what it measured.', minSeconds: 16 },
  { id: 'receipt', voiceover: 'Every run ends with a signed receipt: what was masked, what was sent, and where each pass ran. Verify it in the page. Then wipe. The raw text no longer exists here.', minSeconds: 13 },
  { id: 'close', voiceover: 'Veil. Redacted on your device. Reasoned in the cloud. Proven on the receipt.', minSeconds: 8 },
];
