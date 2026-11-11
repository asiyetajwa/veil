# Veil

Your notes, redacted on your device before any cloud sees them.

Paste notes, a meeting transcript or an email thread. Veil finds and masks the sensitive parts on your own device, sends only the masked abstract to the cloud for the finished work (a summary, the decisions, the action items and a draft reply), and ends every run with a signed receipt. Then the raw text is wiped.

## How it works

1. **Intake.** Paste text, or drop a .txt, .md or .eml file. Files are read as text in the page. Nothing is opened, run or fetched.
2. **On your device.** Two layers, both local.
   - The pattern layer runs in code: emails, phone numbers, links, account and card numbers (including numbers split by spaces), credentials after words like "password" or "PIN", currency amounts, birth dates, and health details after a clinical cue.
   - The model layer runs an on-device model to find the names, organisations, places, roles and health details that patterns cannot. It reads the raw text only on this device: the call is made in on-device-only mode, so if the browser has no on-device model the call fails rather than sending anything.
   - Both layers merge into one mask map. The same entity always gets the same mask ([NAME 1], [ACCOUNT 2]). Tap a mask to see the original locally or unmask it; select text to add a mask.
3. **Policy gate.** Names, organisations, places, emails, phones, links, amounts and birth dates may go to the cloud as masks. Account numbers, credentials and health details block the cloud pass by default; Veil offers a rougher summary written on the device instead. You can send the masked abstract anyway, per run, and the override is recorded on the receipt.
4. **In the cloud.** Only the masked abstract is sent. The page shows the exact request text under "What the cloud received". The brief comes back with the masks carried through, and you can fill the originals back in on your device.
5. **Receipt and wipe.** An Ed25519 receipt is signed in the browser with a key that stays on the device: receipt id, SHA-256 of the abstract, mask counts by category, the sensitivity outcome, where each pass ran as reported by the SDK, and timestamps. The raw text, the mask map and the results are then cleared from the page. The receipt verifies in the page, or anywhere with its public key.

## Canary mode

One click from the top of the page. Three seeded documents (a meeting transcript, an email thread and a support ticket) carry planted items with known positions: names, emails, phone numbers, account numbers, a credential and health details. The on-device pass runs on them live and reports planted, caught and missed per category, the overall catch rate, and any extra masks on text that was not planted. Hard cases are planted on purpose: a name that is also a common word, a card number split by spaces, a phone number written with spaces, a health detail with no clinical cue word. Every miss is listed. Canary mode never uses the cloud.

## Limits, stated plainly

- Redaction is a filter, not a guarantee. The pattern layer finds shapes; the model layer finds what the model recognises. Canary mode measures both and lists what they miss.
- A capitalised common word can be masked as a name when the same word is a name elsewhere in the text ("Will do." when Will is a person). Canary mode counts these as extra masks.
- Veil reads pasted or dropped text only. It does not open attachments, execute files or fetch links.
- Without an on-device model the model layer does not run on raw text. Veil says what is missing, and you can choose to let the cloud model look for names in the already-masked text, which the receipt records.

## Run it

Static files in `public/`, no build step, no backend, no database, no accounts.

1. Put the web app config for your Firebase project in `public/js/firebase-config.js` (Console, Project settings, Your apps). The App Check site key (reCAPTCHA Enterprise) is set in the same file. Until the config is filled in, the pattern layer and canary mode work and the page says the model passes are not connected.
2. Enable Firebase AI Logic for the project. For local testing, register an App Check debug token.
3. `firebase deploy --only hosting`, or serve `public/` with any static server for local work.

Tests for the pattern layer, the mask map, the policy gate, receipts and canary scoring: `npm test` (Node 22).

## Licence

MIT
