// The canary test that was actually run: desktop Chrome on the hosted app, screenshot from the owner on
// 2026-11-12. The page reported 20 of 44 caught, per-document rates 25%, 54% and 73%, 0 extra masks, and
// "Pattern layer only": the on-device model layer did not run in that test, so every name, place and organisation
// (and one health detail with no cue word) is listed as missed. Replace these numbers only with another real run.
export type CanaryResult = { caught: number; total: number; extra: number; missed: number; perDocument: number[]; modelLayerRan: boolean; where: string };
export const CANARY: CanaryResult = {
  caught: 20,
  total: 44,
  extra: 0,
  missed: 24,
  perDocument: [25, 54, 73],
  modelLayerRan: false,
  where: 'Desktop Chrome, on the hosted app, November 2026',
};
