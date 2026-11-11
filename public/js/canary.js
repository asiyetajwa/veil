// Canary scoring. A planted item counts as caught only when every one of its characters is under a mask. Extra
// masks (on text that was not planted) are counted too, so a filter that masks everything cannot score well unseen.

export function score(planted, masks) {
  const covered = (p) => {
    for (let i = p.start; i < p.end; i++) {
      if (!masks.some((m) => i >= m.start && i < m.end)) return false;
    }
    return true;
  };
  const byCategory = {};
  const missed = [];
  for (const p of planted) {
    const c = (byCategory[p.category] ??= { planted: 0, caught: 0 });
    c.planted++;
    if (covered(p)) c.caught++;
    else missed.push(p);
  }
  const extra = masks.filter((m) => !planted.some((p) => m.start < p.end && m.end > p.start));
  const total = planted.length;
  const caught = total - missed.length;
  return { byCategory, missed, extra, total, caught, rate: total ? caught / total : 0 };
}

/** Combines several document scores into one. */
export function combine(scores) {
  const byCategory = {};
  for (const s of scores) {
    for (const [k, v] of Object.entries(s.byCategory)) {
      const c = (byCategory[k] ??= { planted: 0, caught: 0 });
      c.planted += v.planted;
      c.caught += v.caught;
    }
  }
  const total = scores.reduce((a, s) => a + s.total, 0);
  const caught = scores.reduce((a, s) => a + s.caught, 0);
  return { byCategory, total, caught, rate: total ? caught / total : 0, extra: scores.reduce((a, s) => a + s.extra.length, 0) };
}
