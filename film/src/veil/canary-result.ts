// The canary result measured on the hosted build in desktop Chrome, with the on-device model running.
// null until that run's numbers are entered; the film then shows a pending state and must not be delivered.
export type CanaryResult = { caught: number; total: number; extra: number; missed: string[] };
export const CANARY: CanaryResult | null = null;
