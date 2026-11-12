// Veil, the entry film. Six beats from the video spec, in eight scenes. Copy rules: the product is Veil, the two
// passes are described by where they run (on your device, in the cloud), the model is never named, and every claim
// matches the shipped build and the test that was actually run. The canary numbers, spoken and on screen, are the
// run recorded in src/veil/canary-result.ts. Firebase technologies are named (owner's instruction, 2026-11-12).
// Voiceover: node scripts/voiceover.mjs veil (one clip per scene).

import type { SceneSpec } from '../components/Film';

export type SceneId = 'hook' | 'title' | 'masks' | 'gate' | 'cloud' | 'canary' | 'receipt' | 'close';

export const SCENES: SceneSpec<SceneId>[] = [
  { id: 'hook', voiceover: 'The notes you most need help with are the ones you least want to upload. Meeting transcripts. Email threads. Anything with names and numbers in it.', minSeconds: 9 },
  { id: 'title', voiceover: 'This is Veil, built on Firebase AI Logic. Your notes, redacted on your device, before any cloud sees them.', minSeconds: 7 },
  { id: 'masks', voiceover: 'Paste a messy transcript. A first pass runs right here, on your device. Patterns catch the emails, the phone numbers and the amounts. Then Firebase AI Logic calls the on-device model in Chrome, to find the names, the places and the organisations. Each of them becomes a mask, and nothing has left the device.', minSeconds: 18 },
  { id: 'gate', voiceover: 'Some things are too sensitive to send, even masked. This support ticket contains account numbers, credentials and health information. So the cloud pass is blocked by default, and Veil offers to write the summary on your device instead.', minSeconds: 14 },
  { id: 'cloud', voiceover: 'When the gate is clear, only the masked abstract goes to the cloud, through Firebase AI Logic, with Firebase App Check guarding the call. This panel shows exactly what was sent: masks, and nothing raw. The cloud model returns a summary, the decisions and the action items. Then your device fills the real names back in.', minSeconds: 19 },
  { id: 'canary', voiceover: 'How well does the filter work? Canary mode answers that, live. Three documents with planted names, numbers and secrets, hard cases included. This is a test we actually ran, in desktop Chrome, on the app served by Firebase Hosting. The pattern layer caught every email, phone number, account number and credential: twenty of forty-four planted items. The names are the job of the on-device model, which did not run in that test, so they are listed as missed.', minSeconds: 26 },
  { id: 'receipt', voiceover: 'Every run ends with a receipt, signed in the browser: what was masked, what was sent, and where each pass ran, as Firebase AI Logic reported it. Verify it in the page. Then wipe. The raw text no longer exists here.', minSeconds: 14 },
  { id: 'close', voiceover: 'That is Veil, built with Firebase AI Logic, Firebase App Check and Firebase Hosting. Redacted on your device. Reasoned in the cloud. Proven on the receipt.', minSeconds: 10 },
];
