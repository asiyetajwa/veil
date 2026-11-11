// The policy gate. Standard categories may go to the cloud as masks. High-sensitivity categories (account numbers,
// secrets, health details) block the cloud pass by default; the user can send the masked abstract anyway, per run,
// and that override is recorded on the receipt.

import { isHigh } from './categories.js';

export function gate(masks) {
  const high = [...new Set(masks.filter((m) => isHigh(m.category)).map((m) => m.category))];
  return { blocked: high.length > 0, high };
}

/** The receipt's sensitivity outcome for a run. */
export function outcome({ blocked, override, cloudUsed, deviceSummary }) {
  if (blocked && override && cloudUsed) return 'overridden';
  if (blocked && deviceSummary) return 'blocked, on-device summary';
  if (blocked) return 'blocked';
  if (cloudUsed) return 'cloud used';
  return 'not sent';
}
