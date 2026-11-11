// Mask categories, their labels and sensitivity tiers. High-sensitivity categories block the cloud pass by default.

export const CATEGORIES = {
  NAME: { label: 'Name', tier: 'standard' },
  ORG: { label: 'Organisation', tier: 'standard' },
  PLACE: { label: 'Place', tier: 'standard' },
  ROLE: { label: 'Role', tier: 'standard' },
  EMAIL: { label: 'Email', tier: 'standard' },
  PHONE: { label: 'Phone', tier: 'standard' },
  URL: { label: 'Link', tier: 'standard' },
  DATE: { label: 'Birth date', tier: 'standard' },
  MONEY: { label: 'Amount', tier: 'standard' },
  ACCOUNT: { label: 'Account', tier: 'high' },
  SECRET: { label: 'Secret', tier: 'high' },
  HEALTH: { label: 'Health', tier: 'high' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

/** The categories the on-device model is asked to find (the pattern layer covers the rest). */
export const MODEL_CATEGORIES = ['NAME', 'ORG', 'PLACE', 'ROLE', 'HEALTH', 'SECRET'];

export const isHigh = (category) => CATEGORIES[category]?.tier === 'high';

/** Overlap priority: a high-sensitivity span wins over a standard one covering the same characters. */
export const rank = (category) => (isHigh(category) ? 2 : 1);
