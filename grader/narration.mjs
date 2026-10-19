// Timecoded narration fixtures test synchronization, not ASR or the truth of a claim.
// Each role has to remain fully shown: a tagged box behind a clip is not readable.
const safe = (r, minHeight) => r && r.o >= 0.98 && r.h >= minHeight && r.w > 0 &&
  [r.x, r.y, r.w, r.h, r.o].every(Number.isFinite) &&
  r.x >= 96 && r.y >= 54 && r.x + r.w <= 1824 && r.y + r.h <= 1026 &&
  r.vw >= r.w - 0.5 && r.vh >= r.h - 0.5;
const normalized = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
const result = (id, pass, got, want) => ({id: `narration: ${id}`, pass: !!pass, got, want});

export function narratedStat(ctx, p) {
  const frames = ctx.frames;
  const held = frames.filter((f) => f.t >= p.cue && f.t <= p.hold_to);
  // grade.mjs rounds sample times to four decimals.
  const complete = held.length > 0 && held[0].t - p.cue <= 1 / ctx.fps + 1e-4 &&
    p.hold_to - held.at(-1).t <= 1 / ctx.fps + 1e-4 &&
    held.every((f, i) => !i || f.t - held[i - 1].t <= 1 / ctx.fps + 1e-4);
  const landed = frames.find((f) => {
    const r = f.roles[p.value];
    return r && r.o >= 0.5 && normalized(r.text) === p.target;
  });
  const error = landed ? landed.t - p.cue : null;
  const out = [result('final value arrives on the spoken cue',
    error != null && Math.abs(error) <= p.tolerance_frames / ctx.fps + 1e-6,
    error, `within ${p.tolerance_frames} frames of ${p.cue}s`),
    result('final value stays readable through the hold', complete && held.every((f) => {
      const r = f.roles[p.value];
      return safe(r, p.value_min_h) &&
        (f.t < p.cue + p.tolerance_frames / ctx.fps || normalized(r.text) === p.target);
    }), held.length, `fully shown from ${p.cue}s to ${p.hold_to}s`)];
  for (const item of p.copy) {
    out.push(result(`${item.role} stays exact and readable through the hold`,
      complete && held.every((f) => {
        const r = f.roles[item.role];
        return safe(r, item.min_h) && normalized(r.text) === item.text;
      }), held.length, item.text));
  }
  const roles = [p.value, ...p.copy.map((item) => item.role)];
  out.push(result('value, qualifier and source never overlap during the hold',
    complete && held.every((f) => roles.every((role, i) => {
      const a = f.roles[role];
      return a && roles.slice(i + 1).every((other) => f.roles[other] && !overlaps(a, f.roles[other]));
    })), held.length, 'no intersecting role boxes'));
  return out;
}
