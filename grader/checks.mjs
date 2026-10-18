// Every check motionbench runs. A check reads the measured frames (and, for a few, pixels) and
// returns one or more {id, pass, got, want}. No model judges anything.

export const FRAME = { W: 1920, H: 1080, SAFE: [96, 54, 1824, 1026] };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgb = (css) => {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
};
const near = (a, b, tol = 2) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
export const PALETTE = [
  "#FCF4F2", "#FAE8E5", "#F5D1CB", "#EAA397", "#E07563", "#D44027", "#BB3822", "#A1311E", "#882919", "#6E2114", "#4C170E",
  "#F9F9FA", "#DDDFE4", "#C3C6CC", "#AFB3BB", "#8C929C", "#5B616D", "#1B202A", "#0A0C11",
  "#8A909C", "#232937", "#2C3342", "#FDFDFD",
].map(hex);
const CORAL = PALETTE.slice(0, 11);
const CORAL_INK = ["#D44027", "#BB3822"].map(hex);
const DARK = ["#1B202A", "#0A0C11", "#000000"].map(hex);

const r2 = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
const res = (id, pass, got, want) => ({ id, pass: !!pass, got: r2(got), want });

// ---------- series helpers ----------
export function series(ctx, role, key) {
  return ctx.frames.map((f) => {
    const r = f.roles[role];
    if (!r) return null;
    switch (key) {
      case "cx": return r.x + r.w / 2;
      case "cy": return r.y + r.h / 2;
      case "r": return r.x + r.w;
      case "b": return r.y + r.h;
      default: return r[key];
    }
  });
}
const idx = (ctx, t) => Math.max(0, Math.min(ctx.frames.length - 1, Math.round((t - ctx.frames[0].t) * ctx.fps)));
const tAt = (ctx, i) => ctx.frames[i].t;
const speeds = (v, fps) => v.map((x, i) => (i === 0 || x == null || v[i - 1] == null ? 0 : Math.abs(x - v[i - 1]) * fps));
const maxOf = (a) => a.reduce((m, x) => (x != null && x > m ? x : m), -Infinity);
const minOf = (a) => a.reduce((m, x) => (x != null && x < m ? x : m), Infinity);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// The span between leaving the starting value and settling on the final one.
function moveSpan(v, tol = 1, from = 0) {
  const v0 = v[from], vEnd = v[v.length - 1];
  let s = -1, e = -1;
  for (let i = from; i < v.length; i++) if (v[i] != null && Math.abs(v[i] - v0) > tol) { s = i; break; }
  for (let i = v.length - 1; i >= 0; i--) if (v[i] != null && Math.abs(v[i] - vEnd) > tol) { e = i + 1; break; }
  if (s < 0 || e < 0 || e <= s) return null;
  return { s: Math.max(from, s - 1), e: Math.min(v.length - 1, e) };
}
// Mean speed over the first and last `frac` of a span, as a share of its peak speed.
function easeRatios(v, span, fps, frac = 0.15) {
  const sp = speeds(v, fps).slice(span.s + 1, span.e + 1);
  const n = Math.max(2, Math.round(sp.length * frac));
  const peak = maxOf(sp);
  if (!(peak > 0)) return null;
  return { inR: mean(sp.slice(0, n)) / peak, outR: mean(sp.slice(-n)) / peak, peakAt: sp.indexOf(peak) / sp.length, peak };
}
function settledFrom(v, tol, i0 = 0) {
  const f = v[v.length - 1];
  for (let i = v.length - 1; i >= i0; i--) if (v[i] == null || Math.abs(v[i] - f) > tol) return i + 1;
  return i0;
}
const still = (v, i0, i1, tol = 0.5) => {
  const s = v.slice(i0, i1 + 1).filter((x) => x != null);
  return s.length ? maxOf(s) - minOf(s) <= tol : false;
};
const visibleAt = (r) => r && r.o > 0.05 && r.w > 0.5 && r.h > 0.5 && r.x + r.w > 0 && r.y + r.h > 0 && r.x < FRAME.W && r.y < FRAME.H;
const firstVisible = (ctx, role, o = 0.05) => ctx.frames.findIndex((f) => f.roles[role] && f.roles[role].o > o && visibleAt(f.roles[role]));
const final = (ctx, role) => ctx.frames[ctx.frames.length - 1].roles[role];
const inSafe = (r) => r.x >= FRAME.SAFE[0] - 0.5 && r.y >= FRAME.SAFE[1] - 0.5 && r.x + r.w <= FRAME.SAFE[2] + 0.5 && r.y + r.h <= FRAME.SAFE[3] + 0.5;
const colourOf = (r) => [r.bg, r.fill, r.stroke, r.color].map(rgb).filter((c) => c && c.a > 0.5).map((c) => c.c);

// ---------- task checks ----------
const T = {};

T.at = (ctx, p) => {
  const v = series(ctx, p.role, p.key);
  const i0 = idx(ctx, p.from ?? p.t), i1 = idx(ctx, p.to ?? p.t);
  const s = v.slice(i0, i1 + 1);
  const ok = s.length && s.every((x) => x != null && x >= p.min && x <= p.max);
  return [res(p.id || `${p.role}.${p.key} in [${p.min},${p.max}] ${p.to != null ? `from ${p.from}s to ${p.to}s` : `at ${p.t}s`}`, ok, s.length ? [minOf(s), maxOf(s)] : null, [p.min, p.max])];
};

T.still = (ctx, p) => {
  const i0 = idx(ctx, p.from), i1 = idx(ctx, p.to);
  const bad = (p.keys || ["x", "y", "w", "h"]).filter((k) => !still(series(ctx, p.role, k), i0, i1, p.tol ?? 0.5));
  return [res(p.id || `${p.role} holds still from ${p.from}s to ${p.to}s`, bad.length === 0, bad.length ? `moves in ${bad}` : "still", `≤ ${p.tol ?? 0.5}px`)];
};

T.move = (ctx, p) => {
  // A move from rest to rest along one key: when it starts, how long it takes, and how it eases.
  const v = series(ctx, p.role, p.key);
  const span = moveSpan(v, p.tol ?? 1, idx(ctx, p.after ?? 0));
  const name = p.name || `${p.role} ${p.key}`;
  if (!span) return [res(`${name}: moves`, false, "no move", "a move")];
  const out = [];
  const t0 = tAt(ctx, span.s), dur = tAt(ctx, span.e) - t0;
  if (p.start) out.push(res(`${name}: starts at ${p.start[0]}–${p.start[1]}s`, t0 >= p.start[0] && t0 <= p.start[1], t0, p.start));
  if (p.dur) out.push(res(`${name}: takes ${p.dur[0]}–${p.dur[1]}s`, dur >= p.dur[0] && dur <= p.dur[1], dur, p.dur));
  const e = easeRatios(v, span, ctx.fps, p.frac ?? 0.15);
  if (p.ease_in != null) out.push(res(`${name}: slow in (start speed < ${p.ease_in} of peak)`, e && e.inR < p.ease_in, e && e.inR, `< ${p.ease_in}`));
  if (p.ease_out != null) out.push(res(`${name}: slow out (end speed < ${p.ease_out} of peak)`, e && e.outR < p.ease_out, e && e.outR, `< ${p.ease_out}`));
  if (p.peak_mid) out.push(res(`${name}: fastest in the middle`, e && e.peakAt >= p.peak_mid[0] && e.peakAt <= p.peak_mid[1], e && e.peakAt, p.peak_mid));
  return out;
};

T.anticipation = (ctx, p) => {
  const v0s = series(ctx, p.role, p.key || "cx"), fps = ctx.fps;
  const v = v0s.map((x, i) => (x == null ? (i ? v0s.slice(0, i).reverse().find((y) => y != null) : v0s.find((y) => y != null)) : x));
  const d = p.dir || Math.sign(v[v.length - 1] - v[0]) || 1;
  const v0 = v[0], travel = (v[v.length - 1] - v0) * d;
  const rel = v.map((x) => (x - v0) * d);
  const half = rel.findIndex((x) => x > travel / 2);
  if (half < 0 || travel <= 0) return [res("anticipation: the main move happens", false, travel, "> 0")];
  let iMin = 0;
  for (let i = 0; i < half; i++) if (rel[i] < rel[iMin]) iMin = i;
  const depth = -rel[iMin];
  const wind = rel.findIndex((x) => x < -1);
  let cross = -1;
  for (let i = iMin; i < rel.length; i++) if (rel[i] >= 0) { cross = i; break; }
  const sp = speeds(v, fps);
  const windPeak = wind >= 0 ? maxOf(sp.slice(wind, iMin + 1)) : 0;
  const mainPeak = cross >= 0 ? maxOf(sp.slice(cross)) : 0;
  const lead = wind >= 0 && cross >= 0 ? tAt(ctx, cross) - tAt(ctx, wind) : 0;
  return [
    res(`anticipation: winds up the other way (≥ max(8px, ${p.min_frac * 100}% of travel), ≤ ${p.max_frac * 100}%)`, depth >= Math.max(8, p.min_frac * travel) && depth <= p.max_frac * travel, depth, [Math.max(8, p.min_frac * travel), p.max_frac * travel]),
    res(`anticipation: wind-up lasts ${p.lead[0]}–${p.lead[1]}s`, lead >= p.lead[0] && lead <= p.lead[1], lead, p.lead),
    res(`anticipation: wind-up slower than the release (< ${p.speed_ratio} of its peak)`, mainPeak > 0 && windPeak < p.speed_ratio * mainPeak, mainPeak ? windPeak / mainPeak : null, `< ${p.speed_ratio}`),
    ...(p.release ? [res(`anticipation: released at ${p.release[0]}–${p.release[1]}s`, cross >= 0 && tAt(ctx, cross) >= p.release[0] && tAt(ctx, cross) <= p.release[1], cross >= 0 ? tAt(ctx, cross) : null, p.release)] : []),
  ];
};

T.struck = (ctx, p) => {
  const v = series(ctx, p.role, p.key || "cx"), fps = ctx.fps;
  const all = moveSpan(v, 1);
  if (!all) return [res(`${p.role}: moves`, false, null, "moves")];
  // The forward move starts from the back-most point before it (a pull-back is allowed, not needed).
  const d = Math.sign(v[all.e] - v[all.s]) || 1;
  let back = all.s;
  for (let i = all.s; i <= all.e; i++) { if ((v[i] - v[all.s]) * d > 0.5 * Math.abs(v[all.e] - v[all.s])) break; if ((v[i] - v[back]) * d < 0) back = i; }
  const span = { s: back, e: all.e };
  const e = easeRatios(v, span, fps, 0.1);
  return [
    res(`${p.role}: leaves fast, like it was hit (speed in the first 10% ≥ 50% of peak)`, e && e.inR >= 0.5, e && e.inR, "≥ 0.5"),
    res(`${p.role}: glides to a stop (end speed < 35% of peak)`, e && e.outR < 0.35, e && e.outR, "< 0.35"),
  ];
};

T.overshoot = (ctx, p) => {
  const v = series(ctx, p.role, p.key || "w"), o = series(ctx, p.role, "o");
  const f = v[v.length - 1];
  const ia = v.findIndex((x, i) => x != null && o[i] > 0.5 && x > 0.1 * f);
  if (ia < 0 || !(f > 0)) return [res(`${p.role}: appears`, false, null, "appears")];
  const peak = maxOf(v.slice(ia)), over = peak / f - 1;
  const settle = settledFrom(v.map((x) => x / f), p.settle_tol ?? 0.005, ia);
  let reach = v.findIndex((x, i) => i >= ia && x >= f), cross = 0, sgn = 0;
  if (reach >= 0)
    for (let i = reach; i < v.length; i++) {
      const dv = (v[i] - f) / f;
      if (Math.abs(dv) < 0.003) continue;
      const s = Math.sign(dv);
      if (sgn && s !== sgn) cross++;
      sgn = s;
    }
  const ta = tAt(ctx, ia), ts = tAt(ctx, Math.min(settle, v.length - 1));
  const out = [
    res(`${p.role}: overshoots by ${p.over[0] * 100}–${p.over[1] * 100}%`, over >= p.over[0] && over <= p.over[1], over, p.over),
    res(`${p.role}: settles within ${p.settle}s of appearing`, ts - ta <= p.settle, ts - ta, `≤ ${p.settle}`),
    res(`${p.role}: settles without ringing (≤ ${p.max_cross} crossings)`, cross <= p.max_cross, cross, `≤ ${p.max_cross}`),
  ];
  if (p.appear) out.push(res(`${p.role}: appears at ${p.appear[0]}–${p.appear[1]}s`, ta >= p.appear[0] && ta <= p.appear[1], ta, p.appear));
  return out;
};

T.stagger = (ctx, p) => {
  const key = p.key || "x";
  const rows = p.roles.map((role) => {
    const v = series(ctx, role, key), v2 = series(ctx, role, key === "x" ? "y" : "x"), o = series(ctx, role, "o");
    const s = firstVisible(ctx, role);
    const fv = v[v.length - 1], f2 = v2[v2.length - 1], fo = o[o.length - 1];
    let e = v.length - 1;
    for (let i = v.length - 1; i >= 0; i--) { if (v[i] == null || Math.abs(v[i] - fv) > 0.5 || Math.abs(v2[i] - f2) > 0.5 || Math.abs(o[i] - fo) > 0.01) { e = i + 1; break; } if (i === 0) e = 0; }
    return { s: s < 0 ? null : tAt(ctx, s), e: tAt(ctx, Math.min(e, v.length - 1)), f: final(ctx, role) };
  });
  if (rows.some((r) => r.s == null || !r.f)) return [res("cascade: every item appears", false, rows.map((r) => r.s), "all")];
  const gaps = rows.slice(1).map((r, i) => r.s - rows[i].s);
  const ordered = gaps.every((g) => g > 0.001);
  const inRange = gaps.every((g) => g >= p.gap[0] && g <= p.gap[1]);
  const even = Math.max(...gaps) / Math.max(1e-6, Math.min(...gaps));
  const overlap = rows.slice(1).every((r, i) => r.s < rows[i].e);
  const done = Math.max(...rows.map((r) => r.e));
  const xs = rows.map((r) => r.f.x), ys = rows.map((r) => r.f.y);
  const steps = ys.slice(1).map((y, i) => y - ys[i]);
  return [
    res("cascade: items start in order", ordered, gaps, "each after the one before"),
    res(`cascade: ${p.gap[0]}–${p.gap[1]}s between starts`, ordered && inRange, gaps, p.gap),
    res(`cascade: an even rhythm (longest gap ≤ ${p.even}× shortest)`, ordered && even <= p.even, even, `≤ ${p.even}`),
    res("cascade: each item starts before the one above has settled (overlap)", overlap, rows.map((r) => [r.s, r.e]), "next start < previous settle"),
    ...(p.by != null ? [res(`cascade: all settled by ${p.by}s`, done <= p.by, done, `≤ ${p.by}`)] : []),
    res("cascade: final rows aligned and evenly spaced", maxOf(xs) - minOf(xs) <= 1 && steps.every((s) => s > 0) && maxOf(steps) - minOf(steps) <= 2, { xs, steps }, "same left edge, equal steps"),
  ];
};

T.bounce = (ctx, p) => {
  const fps = ctx.fps;
  const w = series(ctx, p.role, "w"), h = series(ctx, p.role, "h"), b = series(ctx, p.role, "b");
  // Without a stated floor, the floor is where the ball comes to rest.
  const F = p.floor != null ? p.floor : b[b.length - 1];
  const wr = w[w.length - 1], hr = h[h.length - 1];
  const air = b.map((x) => F - x);
  const groups = [];
  let inC = false, lastAir = 0;
  for (let i = 0; i < air.length; i++) {
    if (air[i] <= 3) {
      if (!inC && (groups.length === 0 || lastAir > 30)) { groups.push({ s: i, e: i }); lastAir = 0; }
      else if (groups.length) groups[groups.length - 1].e = i;
      inC = true;
    } else { inC = false; lastAir = Math.max(lastAir, air[i]); }
  }
  const apexes = groups.slice(1).map((g, k) => {
    let best = groups[k].e;
    for (let i = groups[k].e; i <= g.s; i++) if (air[i] > air[best]) best = i;
    return best;
  });
  const heights = apexes.map((i) => air[i]);
  // squash at the first two contacts
  let sq = null;
  for (const g of groups.slice(0, 2))
    for (let i = g.s; i <= g.e; i++) if (!sq || h[i] / hr < h[sq] / hr) sq = i;
  const dropStart = b.findIndex((x) => x > b[0] + 1);
  const first = groups[0];
  let stretch = 0;
  if (first && dropStart >= 0) {
    const from = Math.round(dropStart + 0.7 * (first.s - dropStart));
    for (let i = from; i < first.s; i++) stretch = Math.max(stretch, h[i] / w[i] / (hr / wr));
  }
  const vol = w.map((x, i) => (x * h[i]) / (wr * hr)).filter((x, i) => series(ctx, p.role, "o")[i] > 0.5);
  const sp = speeds(b, fps);
  let grav = null;
  if (first && dropStart >= 0 && first.s - dropStart >= 10) {
    const n = Math.max(2, Math.round((first.s - dropStart) * 0.2));
    grav = mean(sp.slice(dropStart + 1, dropStart + 1 + n)) / Math.max(1e-6, mean(sp.slice(first.s - n + 1, first.s + 1)));
  }
  let apexSlow = null;
  if (apexes.length) {
    const g = groups[0], a = apexes[0], n = Math.max(2, Math.round((a - g.e) * 0.2));
    apexSlow = mean(sp.slice(a - n, a + n + 1)) / Math.max(1e-6, maxOf(sp.slice(g.e + 1, g.e + 1 + n)));
  }
  const restAt = tAt(ctx, settledFrom(b, 1));
  return [
    res("bounce: never sinks into the floor", maxOf(b) <= F + 3, maxOf(b) - F, "≤ 3px"),
    res(`bounce: ${p.contacts[0]}–${p.contacts[1]} contacts with the floor`, groups.length >= p.contacts[0] && groups.length <= p.contacts[1], groups.length, p.contacts),
    res("bounce: each bounce lower than the last", heights.length >= 2 && heights.every((x, i) => i === 0 || x < heights[i - 1] - 2), heights, "decreasing"),
    res("squash: flattens on contact (h ≤ 90%, w ≥ 105% of rest)", sq != null && h[sq] / hr <= 0.9 && w[sq] / wr >= 1.05, sq != null ? [h[sq] / hr, w[sq] / wr] : null, "[≤0.9, ≥1.05]"),
    res("stretch: elongates along the fall before impact (≥ 5%)", stretch >= 1.05, stretch, "≥ 1.05"),
    res("squash and stretch keep the volume (area within ±20%)", vol.length && minOf(vol) >= 0.8 && maxOf(vol) <= 1.2, [minOf(vol), maxOf(vol)], [0.8, 1.2]),
    res("timing: accelerates as it falls (start speed < 40% of impact speed)", grav != null && grav < 0.4, grav, "< 0.4"),
    res("timing: slows into the top of the bounce (< 35% of take-off speed)", apexSlow != null && apexSlow < 0.35, apexSlow, "< 0.35"),
    p.rest != null
      ? res(`bounce: at rest on the floor by ${p.rest}s`, restAt <= p.rest && Math.abs(b[b.length - 1] - F) <= 1 && Math.abs(h[h.length - 1] / hr - 1) < 0.01, restAt, `≤ ${p.rest}`)
      : res("bounce: comes to rest on the floor (still for its last 0.3s)", still(b, b.length - 1 - Math.round(0.3 * fps), b.length - 1) && Math.abs(h[h.length - 1] / hr - 1) < 0.01, restAt, "still"),
  ];
};

T.arc = (ctx, p) => {
  const x = series(ctx, p.role, "cx"), y = series(ctx, p.role, "cy"), fps = ctx.fps;
  const sx = moveSpan(x, 1), sy = moveSpan(y, 1);
  if (!sx) return [res("arc: moves", false, null, "moves")];
  const s = Math.min(sx.s, sy ? sy.s : sx.s);
  let e = Math.max(sx.e, sy ? sy.e : sx.e);
  // The flight ends when the object first comes back down to its landing height after the top.
  const yEnd = y[e];
  let top = s;
  for (let i = s; i <= e; i++) if (y[i] < y[top]) top = i;
  for (let i = top; i <= e; i++) if (y[i] >= yEnd - 2) { e = Math.max(i, s + 2); break; }
  const [x0, y0, x1, y1] = [x[s], y[s], x[e], y[e]];  // chord of the flight
  const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  let dev = 0, apex = s;
  for (let i = s; i <= e; i++) {
    const d = (x[i] - x0) * nx + (y[i] - y0) * ny;
    if (Math.abs(d) > Math.abs(dev)) dev = d;
    if (y[i] < y[apex]) apex = i;
  }
  const up = (y[apex] < Math.min(y0, y1));
  const dir = Math.sign(x1 - x0);
  const backX = maxOf(x.slice(s + 1, e + 1).map((v, i) => -(v - x[s + i]) * dir));
  const vy = y.map((v, i) => (i ? (v - y[i - 1]) * fps : 0));
  let turns = 0, sg = 0;
  for (let i = s + 1; i <= e; i++) { if (Math.abs(vy[i]) < 30) continue; const g = Math.sign(vy[i]); if (sg && g !== sg) turns++; sg = g; }
  const apexFrac = (x[apex] - x0) / (x1 - x0);
  const n = Math.max(2, Math.round((e - s) * 0.05));
  const vyAbs = vy.map(Math.abs);
  const apexSlow = mean(vyAbs.slice(apex - n, apex + n + 1)) / Math.max(1e-6, maxOf(vyAbs.slice(s, e + 1)));
  const sp = x.map((v, i) => (i ? Math.hypot(v - x[i - 1], y[i] - y[i - 1]) : 0));
  const spMax = maxOf(sp.slice(s, e + 1));
  let kink = 0;
  for (let i = s + 2; i <= e; i++) {
    if (sp[i] < 0.05 * spMax || sp[i - 1] < 0.05 * spMax) continue;
    const a1 = Math.atan2(y[i - 1] - y[i - 2], x[i - 1] - x[i - 2]), a2 = Math.atan2(y[i] - y[i - 1], x[i] - x[i - 1]);
    let da = Math.abs(a2 - a1) * 180 / Math.PI; if (da > 180) da = 360 - da;
    kink = Math.max(kink, da);
  }
  const land = tAt(ctx, e);
  return [
    res(`arc: bulges up by ≥ ${p.min_dev * 100}% of the distance`, up && Math.abs(dev) / L >= p.min_dev, Math.abs(dev) / L, `≥ ${p.min_dev}`),
    res("arc: one smooth rise and fall (single turning point)", turns === 1, turns, 1),
    res("arc: keeps travelling forward (never goes back)", backX <= 1, backX, "≤ 1px"),
    res("arc: top of the arc near the middle (25–75% of the way)", apexFrac >= 0.25 && apexFrac <= 0.75, apexFrac, [0.25, 0.75]),
    res("arc: slows into the top (vertical speed < 30% of max)", apexSlow < 0.3, apexSlow, "< 0.3"),
    res("arc: no corners in the path (turn ≤ 20° per frame)", kink <= 20, kink, "≤ 20°"),
    ...(p.land != null ? [res(`arc: lands by ${p.land}s`, land <= p.land, land, `≤ ${p.land}`)] : []),
  ];
};

T.swing = (ctx, p) => {
  const cx = series(ctx, p.card, "cx"), rot = series(ctx, p.tag, "rot"), fps = ctx.fps;
  const span = moveSpan(cx, 1);
  if (!span) return [res("swing: the card moves", false, null, "moves")];
  const sp = speeds(cx, fps);
  let tp = span.s;
  for (let i = span.s; i <= span.e; i++) if (sp[i] > sp[tp]) tp = i;
  const stop = span.e, dir = Math.sign(cx[span.e] - cx[span.s]);
  const r0 = rot[rot.length - 1];
  const d = rot.map((r) => (r == null ? 0 : r - r0));
  const amp = maxOf(d.slice(tp).map(Math.abs));
  let firstBig = -1;
  for (let i = tp; i <= Math.min(d.length - 1, stop + Math.round(0.4 * fps)); i++) if (Math.abs(d[i]) > 1.5 && (firstBig < 0 || Math.abs(d[i]) > Math.abs(d[firstBig]))) firstBig = i;
  const want = -dir; // a tag hanging under its pin swings forward, in the direction of travel
  const lagI = Math.min(d.length - 1, stop + Math.round(0.15 * fps));
  const settle = settledFrom(rot, 0.5, tp);
  const lobes = [];
  let cur = 0, sg = 0;
  for (let i = tp; i < d.length; i++) {
    const g = Math.sign(d[i]);
    if (Math.abs(d[i]) < 0.2) continue;
    if (sg && g !== sg) { lobes.push(cur); cur = 0; }
    sg = g; cur = Math.max(cur, Math.abs(d[i]));
  }
  if (cur) lobes.push(cur);
  const attached = ctx.frames.every((f) => {
    const a = f.roles[p.card], b = f.roles[p.tag];
    if (!a || !b || a.o < 0.5 || b.o < 0.5) return true;
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  });
  return [
    res(`secondary: the tag swings ${p.amp[0]}–${p.amp[1]}° after the card's peak speed`, amp >= p.amp[0] && amp <= p.amp[1], amp, p.amp),
    res("secondary: the big swing as it stops is forward, the way the card was travelling", firstBig >= 0 && Math.sign(d[firstBig]) === want, firstBig >= 0 ? Math.sign(d[firstBig]) : 0, want),
    res("secondary: still swinging just after the card stops (follows, not leads)", Math.abs(d[lagI]) > 1, d[lagI], "> 1°"),
    res(`secondary: dies down ${p.settle_by != null ? "by " + p.settle_by + "s" : "before the scene ends"}, each swing after the biggest smaller`, tAt(ctx, Math.min(settle, d.length - 1)) <= (p.settle_by != null ? p.settle_by : tAt(ctx, d.length - 1) - 0.1) && lobes.slice(lobes.indexOf(Math.max(...lobes))).every((l, i, a) => i === 0 || l <= a[i - 1] + 0.3), { settle: tAt(ctx, Math.min(settle, d.length - 1)), lobes: lobes.map(r2) }, p.settle_by != null ? `≤ ${p.settle_by}` : "before the end"),
    res("secondary: comes to rest hanging straight (|rot| ≤ 1°)", Math.abs(r0) <= 1, r0, "≤ 1°"),
    res("secondary: the tag stays attached to the card", attached, attached, true),
  ];
};

T.holds = (ctx, p) => {
  const fps = ctx.fps;
  const runs = p.roles.map((role) => {
    let best = null, cur = null;
    ctx.frames.forEach((f, i) => {
      const r = f.roles[role], prev = i ? ctx.frames[i - 1].roles[role] : null;
      const ok = r && r.o >= 0.98 && visibleAt(r) && prev && ["x", "y", "w", "h"].every((k) => Math.abs(r[k] - prev[k]) <= 0.5);
      if (ok) { cur = cur ? { ...cur, e: i } : { s: i, e: i }; if (!best || cur.e - cur.s > best.e - best.s) best = cur; }
      else cur = null;
    });
    return best;
  });
  const lens = runs.map((r) => (r ? (r.e - r.s + 1) / fps : 0));
  const starts = runs.map((r) => (r ? r.s : Infinity));
  let both = 0, worst = 0;
  ctx.frames.forEach((f) => {
    const n = p.roles.filter((role) => f.roles[role] && f.roles[role].o > 0.15 && visibleAt(f.roles[role])).length;
    both = n > 1 ? both + 1 : 0; worst = Math.max(worst, both);
  });
  const placed = runs.every((r, k) => r && [r.s, r.e].every((i) => { const x = ctx.frames[i].roles[p.roles[k]]; return (p.centre === false || Math.abs(x.x + x.w / 2 - 960) <= 40) && inSafe(x) && x.h >= p.min_h; }));
  return [
    res(`staging: each line held readable and still for ≥ ${p.hold}s`, lens.every((l) => l >= p.hold), lens, `≥ ${p.hold}`),
    res("staging: lines come in order", starts.every((s, i) => i === 0 || s > starts[i - 1]), starts.map((s) => (isFinite(s) ? tAt(ctx, s) : null)), "increasing"),
    res(`staging: never two lines competing (overlap ≤ ${p.overlap}s)`, worst / fps <= p.overlap, worst / fps, `≤ ${p.overlap}`),
    res(`staging: each line ${p.centre === false ? "" : "centred, "}inside title-safe, at least ${p.min_h}px tall`, placed, placed, true),
  ];
};

T.stations = (ctx, p) => {
  const x = series(ctx, p.world, "x"), fps = ctx.fps;
  const holds = p.targets.map((tg) => {
    let best = null, cur = null;
    for (let i = 0; i < x.length; i++) {
      const ok = x[i] != null && Math.abs(x[i] - tg) <= 1 && (i === 0 || Math.abs(x[i] - x[i - 1]) <= 0.25);
      if (ok) { cur = cur ? { s: cur.s, e: i } : { s: i, e: i }; if (!best || cur.e - cur.s > best.e - best.s) best = cur; } else cur = null;
    }
    return best;
  });
  const out = [res(`camera: holds each station (±1px, no drift) for ≥ ${p.hold}s`, holds.every((h) => h && (h.e - h.s + 1) / fps >= p.hold), holds.map((h) => (h ? (h.e - h.s + 1) / fps : 0)), `≥ ${p.hold}`)];
  const ordered = holds.every((h, i) => h && (i === 0 || h.s > holds[i - 1].e));
  out.push(res("camera: visits the stations in order", ordered, holds.map((h) => h && tAt(ctx, h.s)), "1 → 2 → 3"));
  const dir = Math.sign(p.targets[1] - p.targets[0]);
  const back = maxOf(x.slice(1).map((v, i) => (v - x[i]) * -dir));
  out.push(res("camera: never backs up or overshoots a station", back <= 0.25 && minOf(x.map((v) => v * dir)) >= Math.min(...p.targets.map((t) => t * dir)) - 1, back, "≤ 0.25px"));
  if (ordered) {
    const pans = holds.slice(1).map((h, k) => ({ s: holds[k].e, e: h.s }));
    const durs = pans.map((q) => (q.e - q.s) / fps);
    out.push(res(`camera: each pan takes ${p.dur[0]}–${p.dur[1]}s`, durs.every((d) => d >= p.dur[0] && d <= p.dur[1]), durs, p.dur));
    const ends = pans.map((q) => {
      const n = Math.max(1, Math.round((q.e - q.s) * 0.15)), D = Math.abs(x[q.e] - x[q.s]);
      return [Math.abs(x[q.s + n] - x[q.s]) / D, Math.abs(x[q.e] - x[q.e - n]) / D];
    });
    out.push(res(`camera: strong ease in and out (≤ ${p.edge * 100}% of the distance in the first and last 15% of each pan)`, ends.every(([a, b]) => a <= p.edge && b <= p.edge), ends, `≤ ${p.edge}`));
    const centred = holds.every((h, k) => [h.s, h.e].every((i) => { const s = ctx.frames[i].roles[p.labels[k]]; return s && s.o > 0.9 && Math.abs(s.x + s.w / 2 - 960) <= 12 && Math.abs(s.y + s.h / 2 - 540) <= 80; }));
    out.push(res("camera: each station's word centred when held", centred, centred, true));
  }
  return out;
};

T.continuity = (ctx, p) => {
  const L = p.line, Hd = p.headline;
  const fr = ctx.frames;
  const ta = fr.findIndex((f) => f.roles[L] && f.roles[L].o > 0.9);
  if (ta < 0) return [res("continuity: the element appears", false, null, "appears")];
  const stays = fr.slice(ta).every((f) => f.roles[L] && f.roles[L].o >= 0.9);
  const dotI = fr.findIndex((f, i) => i >= ta && f.roles[L].w >= 6 && f.roles[L].h >= 6);
  const dot = dotI >= 0 ? fr[dotI].roles[L] : null;
  const tol = p.dot_tol ?? 20, maxH = p.max_h ?? 6;
  const isDot = dot && dot.w <= 48 && dot.h <= 48 && dot.w / dot.h >= 0.6 && dot.w / dot.h <= 1.67 && Math.abs(dot.x + dot.w / 2 - 960) <= tol && Math.abs(dot.y + dot.h / 2 - 540) <= tol;
  let jump = 0;
  for (let i = ta + 1; i < fr.length; i++) {
    const a = fr[i - 1].roles[L], b = fr[i].roles[L];
    if (!a || !b) { jump = Infinity; break; }
    jump = Math.max(jump, Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h));
  }
  const hairI = fr.findIndex((f) => f.roles[L] && f.roles[L].w >= 0.6 * FRAME.W && f.roles[L].h <= maxH && (p.centre === false || Math.abs(f.roles[L].y + f.roles[L].h / 2 - 540) <= 30));
  const l = final(ctx, L), hd = final(ctx, Hd);
  const gap = l && hd ? l.y - (hd.y + hd.h) : null;
  const divider = l && hd && l.h <= maxH && l.w >= 200 && gap >= 8 && gap <= 140 && (Math.abs(l.x + l.w / 2 - hd.x - hd.w / 2) <= 24 || Math.abs(l.x - hd.x) <= 12 || (l.x <= hd.x + 12 && l.x + l.w >= hd.x + hd.w - 12)) && (p.centre === false || l.y + l.h / 2 >= 580);
  // The headline's entrance: when it starts to move, or (if it never moves) when it appears. A masked line
  // counts as "visible" while it waits under its mask, so its motion is the better clock.
  const hcy = series(ctx, Hd, "cy"), ho = series(ctx, Hd, "o");
  const hFinal = hcy[hcy.length - 1];
  let hv = -1;
  for (let i = 1; i < hcy.length; i++) if (hcy[i] != null && hcy[i - 1] != null && Math.abs(hcy[i] - hcy[i - 1]) > 0.5 && ho[i] > 0.05) { hv = i - 1; break; }
  if (hv < 0) hv = fr.findIndex((f) => f.roles[Hd] && f.roles[Hd].o > 0.5 && visibleAt(f.roles[Hd]));
  const rose = hv >= 0 && maxOf(hcy.slice(hv)) - hFinal >= 16;
  const coral = l && colourOf(l).some((c) => CORAL_INK.some((k) => near(c, k)));
  return [
    res("continuity: a centred dot first", isDot, dot && [dot.w, dot.h, dot.x + dot.w / 2, dot.y + dot.h / 2], "≤48px square-ish at the centre"),
    res("continuity: stretches into a hairline across the frame", hairI > dotI && dotI >= 0, hairI >= 0 ? tAt(ctx, hairI) : null, "w ≥ 60% of frame, h ≤ 6px"),
    res("continuity: ends as the divider just under the headline", divider, l && hd ? { gap, line: [l.x, l.y, l.w, l.h], head: [hd.x, hd.y, hd.w, hd.h] } : null, "hairline 8–140px under it, aligned with it or spanning it"),
    res("continuity: one element throughout, never faded out", stays, stays, true),
    res("continuity: no cuts (no edge jumps ≥ 400px in a frame)", jump < 400, jump, "< 400"),
    res("continuity: the headline rises into place after the hairline forms", rose && hairI >= 0 && hv >= hairI - Math.round(0.25 * ctx.fps), { rise: hv >= 0 ? maxOf(hcy.slice(hv)) - hFinal : null, at: hv >= 0 ? tAt(ctx, hv) : null }, "rises ≥ 16px, after"),
    ...(p.coral === false ? [] : [res("continuity: the line is coral", coral, l && colourOf(l), "coral")]),
  ];
};

T.stream = (ctx, p) => {
  const toks = ctx.assets.tokens, N = toks.length, fps = ctx.fps;
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const map = new Map();
  let acc = "";
  map.set("", 0);
  toks.forEach((t, k) => { acc += t; map.set(norm(acc), k + 1); });
  const ks = ctx.frames.map((f) => (f.roles[p.reply] ? map.get(norm(f.roles[p.reply].text)) : undefined));
  const valid = ks.filter((k) => k !== undefined).length / ks.length;
  const firstTok = ks.findIndex((k) => k !== undefined && k >= 1);
  const start = p.start != null ? p.start : firstTok > 0 ? tAt(ctx, firstTok) - 1 / fps : tAt(ctx, 0);
  p = { ...p, start };
  const end = p.start + N / p.rate;
  const before = ctx.frames.every((f, i) => f.t > p.start - 0.02 || ks[i] === 0 || ks[i] === undefined && f.roles[p.reply] == null);
  const started = ks[idx(ctx, p.start + 0.05)] >= 1;
  const win = ctx.frames.map((f, i) => i).filter((i) => ctx.frames[i].t >= p.start && ctx.frames[i].t <= end);
  const errs = win.map((i) => (ks[i] === undefined ? Infinity : Math.abs(ks[i] - p.rate * (ctx.frames[i].t - p.start))));
  const onRate = errs.filter((e) => e <= p.tol).length / Math.max(1, errs.length);
  const done = ctx.frames.every((f, i) => f.t < end + 0.1 || ks[i] === N);
  const cur = win.map((i) => {
    const c = ctx.frames[i].roles[p.cursor], r = ctx.frames[i].roles[p.reply];
    if (!c || c.o < 0.5) return false;
    if (!r || !r.end) return ks[i] === 0;
    const [ex, ey, ew, eh] = r.end;
    const dx = c.x - (ex + ew);
    const ov = Math.min(c.y + c.h, ey + eh) - Math.max(c.y, ey);
    return dx >= -6 && dx <= 48 && ov >= 0.5 * Math.min(c.h, eh);
  });
  const curOk = cur.filter(Boolean).length / Math.max(1, cur.length);
  const r = final(ctx, p.reply), c = final(ctx, p.cursor) || ctx.frames[win[Math.floor(win.length / 2)]]?.roles[p.cursor];
  return [
    res("stream: always shows whole tokens, exactly as given (≥ 98% of frames)", valid >= 0.98, valid, "≥ 0.98"),
    res(`stream: nothing before ${p.start}s, first tokens right at it`, before && started, { before, started }, true),
    res(`stream: ${p.rate} tokens/s, within ${p.tol} tokens on ≥ 95% of frames`, onRate >= 0.95, onRate, "≥ 0.95"),
    res("stream: the whole reply is there when it finishes", done, ks[ks.length - 1], N),
    res("stream: a cursor sits at the end of the text while streaming (≥ 90%)", curOk >= 0.9, curOk, "≥ 0.9"),
    res("stream: the cursor is coral", c && colourOf(c).some((x) => CORAL_INK.some((k) => near(x, k))), c && colourOf(c), "coral"),
    ...(p.mono === false ? [] : [res("stream: set in the mono face", r && /JetBrains Mono/i.test(r.font.split(",")[0]), r && r.font, "JetBrains Mono")]),
  ];
};

T.count = (ctx, p) => {
  const v = series(ctx, p.role, "text").map((s) => (s == null ? null : s.trim()));
  const o = series(ctx, p.role, "o"), w = series(ctx, p.role, "w");
  const fmt = v.every((s, i) => o[i] < 0.5 || /^\d{1,3}(,\d{3})*$/.test(s));
  const n = v.map((s) => (s && /^[\d,]+$/.test(s) ? parseInt(s.replace(/,/g, ""), 10) : null));
  const mono = n.every((x, i) => i === 0 || x == null || n[i - 1] == null || x >= n[i - 1]);
  const land = n.findIndex((x) => x === p.to);
  const held = land >= 0 && n.slice(land).every((x) => x === p.to || x == null);
  const before = p.start == null || ctx.frames.every((f, i) => f.t > p.start - 0.02 || n[i] === 0 || o[i] < 0.5);
  const started = p.start == null || n[idx(ctx, p.start + 0.1)] > 0;
  const mid = p.mid != null ? n[idx(ctx, (p.start + p.land) / 2)] : null;
  const byLen = {};
  v.forEach((s, i) => { if (s && o[i] >= 0.5) (byLen[s.length] = byLen[s.length] || []).push(w[i]); });
  const wobble = Math.max(0, ...Object.values(byLen).map((a) => maxOf(a) - minOf(a)));
  const f = final(ctx, p.role);
  return [
    res("count: always a whole number with thousands separators", fmt, fmt, true),
    res("count: never goes backwards", mono, mono, true),
    ...(p.start != null ? [res(`count: starts at ${p.start}s`, before && started, { before, started }, true)] : [res("count: starts from 0", n.find((x) => x != null) === 0, n.find((x) => x != null), 0)]),
    p.land != null
      ? res(`count: lands on ${p.to.toLocaleString("en")} at ${p.land}s and holds`, land >= 0 && Math.abs(tAt(ctx, land) - p.land) <= 0.05 && held, land >= 0 ? tAt(ctx, land) : null, p.land)
      : res(`count: reaches ${p.to.toLocaleString("en")} and holds it`, land >= 0 && held && (ctx.frames.length - land) / ctx.fps >= 0.4, land >= 0 ? tAt(ctx, land) : null, p.to),
    ...(p.mid != null ? [res(`count: arrives at the number (≥ ${p.mid * 100}% of it by halfway)`, mid != null && mid >= p.mid * p.to, mid, `≥ ${p.mid * p.to}`)] : []),
    res("count: digits don't jiggle (tabular: width steady while the digit count holds)", wobble <= 1, wobble, "≤ 1px"),
    res("count: a measurement, so the mono face, at hero size", f && /JetBrains Mono/i.test(f.font.split(",")[0]) && f.h >= p.min_h, f && [f.font, f.h], `JetBrains Mono, h ≥ ${p.min_h}`),
  ];
};

T.beats = (ctx, p) => {
  // A word lands when it gets there (within 3% of its entrance travel, nearly opaque), not when its tween ends:
  // an ease-out that finishes on the beat has visibly arrived a few frames before it.
  const lands = p.roles.map((role) => {
    const keys = ["x", "y", "w", "h"].map((k) => series(ctx, role, k)), o = series(ctx, role, "o");
    const E = firstVisible(ctx, role, 0.02);
    if (E < 0) return { L: -1, E };
    const fin = keys.map((v) => v[v.length - 1]);
    const tol = keys.map((v, k) => Math.max(1, 0.03 * Math.abs(v[E] - fin[k])));
    let L = -1;
    for (let i = E; i < o.length; i++) if (o[i] >= 0.95 && keys.every((v, k) => v[i] != null && Math.abs(v[i] - fin[k]) <= tol[k])) { L = i; break; }
    return { L, E };
  });
  const fps = ctx.fps;
  const period = 60 / p.bpm;
  const beat = (i) => (p.beat1 != null ? p.beat1 + i * period : Math.round(tAt(ctx, Math.max(0, lands[i].L)) / period) * period);
  const errs = lands.map((x, i) => (x.L < 0 ? null : tAt(ctx, x.L) - beat(i)));
  const inOrder = p.beat1 != null || lands.every((x, i) => i === 0 || (x.L >= 0 && lands[i - 1].L >= 0 && beat(i) > beat(i - 1)));
  const fs = p.roles.map((r) => final(ctx, r));
  const oneLine = fs.every((f) => f) && maxOf(fs.map((f) => f.y)) - minOf(fs.map((f) => f.y)) <= 4 && fs.every((f, i) => i === 0 || f.x >= fs[i - 1].x + fs[i - 1].w - 1);
  const ux0 = minOf(fs.map((f) => f?.x)), ux1 = maxOf(fs.map((f) => f && f.x + f.w));
  return [
    res(`beat: every word lands on ${p.beat1 != null ? "its" : "a"} beat (±2 frames)${p.beat1 != null ? "" : ", one after another"}`, inOrder && errs.every((e) => e != null && Math.abs(e) <= 2 / fps + 1e-3), errs, "±0.033s"),
    res("beat: every word has an entrance (not a cut)", lands.every((x) => x.E >= 0 && (x.L - x.E) / fps >= 0.05), lands.map((x) => (x.E >= 0 ? (x.L - x.E) / fps : null)), "≥ 0.05s"),
    res("beat: the words end as one line, in reading order", oneLine, oneLine, true),
    p.centre === false
      ? res("beat: the line is inside title-safe", oneLine && fs.every(inSafe), oneLine, true)
      : res("beat: the line is centred and inside title-safe", oneLine && Math.abs((ux0 + ux1) / 2 - 960) <= 40 && fs.every(inSafe), (ux0 + ux1) / 2, "960 ±40"),
  ];
};

T.lockup = (ctx, p) => {
  const m = final(ctx, p.mark), wm = final(ctx, p.wordmark);
  if (!m || !wm) return [res("lockup: mark and wordmark present", false, null, "both")];
  const i1 = ctx.frames.length - 1, i0 = p.hold_from != null ? idx(ctx, p.hold_from) : Math.max(0, i1 - Math.round(1.0 * ctx.fps));
  const held = [p.mark, p.wordmark].every((r) => ["x", "y", "w", "h", "o"].every((k) => still(series(ctx, r, k), i0, i1, k === "o" ? 0.01 : 0.5))) && m.o > 0.98 && wm.o > 0.98;
  const ux0 = Math.min(m.x, wm.x), ux1 = Math.max(m.x + m.w, wm.x + wm.w), uy0 = Math.min(m.y, wm.y), uy1 = Math.max(m.y + m.h, wm.y + wm.h);
  const cx = (ux0 + ux1) / 2, cy = (uy0 + uy1) / 2, uw = ux1 - ux0;
  const aspect = m.w / m.h;
  const ink = rgb(wm.color);
  const gap = wm.x - (m.x + m.w);
  const mv = firstVisible(ctx, p.mark, 0.5), wv = firstVisible(ctx, p.wordmark, 0.5);
  const mw = series(ctx, p.mark, "w"), peak = maxOf(mw.slice(mv >= 0 ? mv : 0)) / m.w;
  const asset = ctx.static.logo;
  return [
    res(`lockup: holds still and whole ${p.hold_from != null ? "from " + p.hold_from + "s" : "for the last second"}`, held, held, true),
    res("lockup: centred in the frame (±6px across, ±10px down)", Math.abs(cx - 960) <= 6 && Math.abs(cy - 540) <= 10, [cx, cy], [960, 540]),
    res("lockup: large (40–85% of the frame's width)", uw >= 0.4 * FRAME.W && uw <= 0.85 * FRAME.W, uw, [768, 1632]),
    res("lockup: the real mark, used as is (asset, proportions)", asset && Math.abs(aspect / (579.22 / 636.72) - 1) <= 0.03, { asset, aspect }, "assets/logo-icon.svg, 0.91"),
    res("lockup: wordmark 'CoralBricks' in Open Sauce Two Bold, ink #0A0C11", wm.text.trim() === "CoralBricks" && /Open Sauce Two/i.test(wm.font.split(",")[0]) && +wm.weight === 700 && ink && near(ink.c, hex("#0A0C11"), 1), [wm.text.trim(), wm.font, wm.weight, wm.color], true),
    res("lockup: mark left of the wordmark, centres aligned, a tidy gap", gap >= 0.08 * m.h && gap <= 0.7 * m.h && Math.abs(m.y + m.h / 2 - (wm.y + wm.h / 2)) <= 0.06 * m.h, { gap, dy: m.y + m.h / 2 - (wm.y + wm.h / 2) }, "gap 8–70% of mark height, |dy| ≤ 6%"),
    ...(p.choreography === false ? [] : [
      res("lockup: the mark arrives first (≥ 0.1s before the wordmark)", mv >= 0 && wv >= 0 && (wv - mv) / ctx.fps >= 0.1, mv >= 0 && wv >= 0 ? (wv - mv) / ctx.fps : null, "≥ 0.1"),
      res("lockup: the mark lands with follow-through (overshoot 2–25%)", peak >= 1.02 && peak <= 1.25, peak, [1.02, 1.25])]),
  ];
};

T.rise = (ctx, p) => {
  const out = [];
  const starts = [];
  for (const role of p.lines) {
    const y = series(ctx, role, "y"), f = final(ctx, role);
    // The rise starts at the lowest point the line is parked at before it settles (a frame where the
    // starting position has not been applied yet does not count as the start).
    const o = series(ctx, role, "o");
    const settle = settledFrom(y, 1);
    let low = -1;
    for (let i = 0; i < settle; i++) if (y[i] != null && (low < 0 || y[i] >= y[low])) low = i;
    const span = low >= 0 && y[low] - f.y > 1 ? { s: low, e: Math.min(settle, y.length - 1) } : null;
    if (!span || !f) { out.push(res(`${role}: rises`, false, null, "rises")); starts.push(null); continue; }
    starts.push(tAt(ctx, span.s));
    const e = easeRatios(y, span, ctx.fps);
    const rise = y[span.s] - f.y;
    const noBounce = minOf(y.slice(span.s)) >= f.y - 2 && y.slice(span.s + 1).every((v, i) => v <= y[span.s + i] + 0.5);
    out.push(res(`${role}: rises from below its line (≥ 60% of its height), straight up`, rise >= 0.6 * f.h && noBounce, rise / f.h, "≥ 0.6, no dip"));
    out.push(res(`${role}: eases into place (end speed < 35% of peak)`, e && e.outR < 0.35, e && e.outR, "< 0.35"));
    const h0 = p.hold_from != null ? idx(ctx, p.hold_from) : ctx.frames.length - 1 - Math.round(0.3 * ctx.fps);
    out.push(res(`${role}: settles and holds still`, ["x", "y", "w", "h"].every((k) => still(series(ctx, role, k), h0, ctx.frames.length - 1)), true, true));
  }
  const g = starts[1] != null && starts[0] != null ? starts[1] - starts[0] : null;
  if (p.gap) out.push(res(`rise: line 2 follows line 1 by ${p.gap[0]}–${p.gap[1]}s`, g != null && g >= p.gap[0] && g <= p.gap[1], g, p.gap));
  const fs = p.lines.map((r) => final(ctx, r));
  if (p.layout !== false) out.push(res("rise: left-aligned on the 120px margin, upper third, headline size, Open Sauce Two", fs.every((f) => f && Math.abs(f.x - 120) <= 8 && f.h >= p.min_h && /Open Sauce Two/i.test(f.font.split(",")[0])) && fs[0].y >= 150 && fs[0].y <= 480, fs.map((f) => f && [f.x, f.y, f.h]), "x 120±8, y₁ 150–480"));
  const a = final(ctx, p.accent);
  out.push(res("rise: the accent word is coral and the only coral", a && a.text.trim() === p.accent_text && colourOf(a).some((c) => CORAL_INK.some((k) => near(c, k))) && (p.only_coral === false || ctx.coralOwners.every((o) => o === p.accent)), { text: a && a.text.trim(), owners: p.only_coral === false ? undefined : ctx.coralOwners }, `'${p.accent_text}' in coral`));
  return out;
};

// ---------- scenes of a long piece ----------
// A scene is the stretch where its roles are on screen; its checks run on just those frames.
export function sceneSpan(frames, roles, pad = 0.15, fps = 60) {
  const on = (f) => roles.some((r) => visibleAt(f.roles[r]));
  const a = frames.findIndex(on);
  if (a < 0) return null;
  let b = a;
  for (let i = frames.length - 1; i >= a; i--) if (on(frames[i])) { b = i; break; }
  // Pad before the scene (to catch its entrance), not after: once it is gone, its last state is gone too.
  return [Math.max(0, a - Math.round(pad * fps)), b];
}

T.segment = (ctx, p) => {
  const span = sceneSpan(ctx.frames, p.roles, 0.15, ctx.fps);
  if (!span) return [res(`${p.name}: the scene is there (${p.roles.join(", ")} on screen)`, false, null, "on screen")];
  // A scene in a film usually leaves. Its resting state is its last stretch of stillness (≥ 0.15s, the first
  // role fully shown); what follows is the exit, so the scene's checks stop there.
  let end = span[1];
  const need = Math.round(0.15 * ctx.fps), still1 = (i) => p.roles.every((r) => {
    const a = ctx.frames[i - 1].roles[r], b = ctx.frames[i].roles[r];
    if (!a || !b) return true;
    return ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
  }) && p.roles.some((r) => { const x = ctx.frames[i].roles[r]; return x && x.o >= 0.95 && visibleAt(x); });
  for (let i = span[1], run = 0; i > span[0]; i--) {
    run = still1(i) ? run + 1 : 0;
    if (run >= need) { let j = i + run - 1; while (j + 1 <= span[1] && still1(j + 1)) j++; end = j; break; }
  }
  const sub = { ...ctx, frames: ctx.frames.slice(span[0], end + 1) };
  const out = [];
  for (const c of p.checks) {
    let got;
    try { got = T[c.type](sub, c); } catch (e) { got = [res(`${c.type}: could not be measured`, false, String(e.message || e).slice(0, 120), "measurable")]; }
    for (const r of got) out.push({ ...r, id: `${p.name} · ${r.id}` });
  }
  return out;
};

T.stations_auto = (ctx, p) => {
  // A world that travels sideways and stops: count the stops, check the travel between them.
  const x = series(ctx, p.world, "x"), fps = ctx.fps;
  const holds = [];
  let cur = null;
  for (let i = 1; i < x.length; i++) {
    const ok = x[i] != null && x[i - 1] != null && Math.abs(x[i] - x[i - 1]) <= 0.25;
    if (ok) cur = cur ? { s: cur.s, e: i } : { s: i - 1, e: i };
    else { if (cur && (cur.e - cur.s + 1) / fps >= p.hold) holds.push(cur); cur = null; }
  }
  if (cur && (cur.e - cur.s + 1) / fps >= p.hold) holds.push(cur);
  const out = [res(`travel: stops at each of the ${p.labels.length} stops for ≥ ${p.hold}s`, holds.length >= p.labels.length, holds.length, `≥ ${p.labels.length}`)];
  if (holds.length < 2) return out;
  const dir = Math.sign(x[holds[holds.length - 1].s] - x[holds[0].s]);
  const back = maxOf(x.slice(holds[0].s + 1, holds[holds.length - 1].e + 1).map((v, i) => (v - x[holds[0].s + i]) * -dir));
  out.push(res("travel: always the same way, no overshoot past a stop", back <= 0.5, back, "≤ 0.5px"));
  const pans = holds.slice(1).map((h, k) => ({ s: holds[k].e, e: h.s }));
  const eased = pans.map((q) => easeRatios(x, q, fps));
  out.push(res("travel: each move starts and stops gently (end speeds < 35% of peak)", eased.every((e) => e && e.inR < 0.35 && e.outR < 0.35), eased.map((e) => e && [r2(e.inR), r2(e.outR)]), "< 0.35"));
  const centred = holds.slice(0, p.labels.length).every((h, k) => { const s = ctx.frames[Math.round((h.s + h.e) / 2)].roles[p.labels[k]]; return s && s.o > 0.9 && Math.abs(s.x + s.w / 2 - 960) <= 40; });
  out.push(res("travel: each stop's word sits in the middle of the frame when stopped", centred, centred, true));
  return out;
};

// ---------- the Open Design one-shape brief ----------
// Plateaus of the shape's size: the UI states it rests in between changes.
function plateaus(ctx, role, minDur = 0.1) {
  const w = series(ctx, role, "w"), h = series(ctx, role, "h"), fps = ctx.fps, out = [];
  let s = 0;
  for (let i = 1; i <= w.length; i++) {
    const moving = i === w.length || w[i] == null || Math.abs(w[i] - w[i - 1]) > 0.5 || Math.abs(h[i] - h[i - 1]) > 0.5;
    if (moving) { if ((i - s) / fps >= minDur) out.push({ s, e: i - 1, w: w[s], h: h[s] }); s = i; }
  }
  return out;
}

T.one_shape = (ctx, p) => {
  const o = series(ctx, p.role, "o"), fr = ctx.frames;
  const always = fr.every((f) => f.roles[p.role] && f.roles[p.role].o >= 0.9 && visibleAt(f.roles[p.role]));
  let jump = 0;
  for (let i = 1; i < fr.length; i++) {
    const a = fr[i - 1].roles[p.role], b = fr[i].roles[p.role];
    if (!a || !b) { jump = Infinity; break; }
    jump = Math.max(jump, Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h));
  }
  const pl = plateaus(ctx, p.role);
  const distinct = [];
  for (const q of pl) if (!distinct.some((d) => Math.abs(d.w - q.w) <= 6 && Math.abs(d.h - q.h) <= 6)) distinct.push(q);
  return [
    res("one shape: on screen the whole time, never faded or hidden", always, always, true),
    res("one shape: never cut (no edge jumps ≥ 400px in a frame)", jump < 400, jump, "< 400"),
    res(`one shape: morphs through at least ${p.states} different forms`, distinct.length >= p.states, distinct.length, `≥ ${p.states}`),
  ];
};

T.cursor_drives = (ctx, p) => {
  // Every change of the shape begins while the cursor is on it (or just reaching it).
  const pl = plateaus(ctx, p.shape), fps = ctx.fps;
  const starts = pl.slice(0, -1).map((q) => q.e + 1);
  const ok = starts.map((i) => {
    for (let j = Math.max(0, i - Math.round(0.35 * fps)); j <= Math.min(ctx.frames.length - 1, i + 2); j++) {
      const c = ctx.frames[j].roles[p.cursor], s = ctx.frames[j].roles[p.shape];
      if (!c || !s || c.o < 0.5) continue;
      const tip = [c.x + Math.min(c.w, 12) / 2, c.y + Math.min(c.h, 12) / 2];
      if (tip[0] >= s.x - 30 && tip[0] <= s.x + s.w + 30 && tip[1] >= s.y - 30 && tip[1] <= s.y + s.h + 30) return true;
    }
    return false;
  });
  const share = ok.length ? ok.filter(Boolean).length / ok.length : 0;
  const cv = series(ctx, p.cursor, "o");
  const seen = cv.filter((x) => x != null && x >= 0.5).length / cv.length;
  return [
    res("cursor: on screen most of the piece (≥ 80%)", seen >= 0.8, seen, "≥ 0.8"),
    res(`cursor: on the shape when each change begins (≥ 80% of ${ok.length} changes)`, ok.length >= 4 && share >= 0.8, share, "≥ 0.8"),
  ];
};

T.springs = (ctx, p) => {
  // Between two rest states the size may pass the target a little and settle; "a tiny overshoot at most".
  const pl = plateaus(ctx, p.role), w = series(ctx, p.role, "w"), h = series(ctx, p.role, "h");
  const over = [];
  for (let k = 1; k < pl.length; k++) {
    const a = pl[k - 1], b = pl[k];
    for (const [v, from, to] of [[w, a.w, b.w], [h, a.h, b.h]]) {
      const delta = Math.abs(to - from);
      if (delta < 24) continue;  // small changes: a pixel of spring is not a share worth judging
      const seg = v.slice(a.e, b.s + 1);
      const past = Math.max(0, to > from ? maxOf(seg) - to : to - minOf(seg));
      over.push(past <= 3 ? Math.min(past / delta, 0.004) : past / delta);
    }
  }
  // The brief's own slider "stretches when dragged past max", so one deliberate overshoot is allowed for.
  const within = over.length ? over.filter((x) => x <= p.max).length / over.length : 0, some = over.filter((x) => x > 0.005).length;
  return [
    res(`springs: overshoot stays tiny (≤ 3px or ${p.max * 100}% of the change) on ≥ 85% of changes`, over.length >= 4 && within >= 0.85, within, "≥ 0.85"),
    res("springs: changes settle with a little spring, not a linear slide (some overshoot on ≥ 25% of changes)", over.length >= 4 && some / over.length >= 0.25, over.length ? some / over.length : null, "≥ 0.25"),
  ];
};

T.beat_activity = (ctx, p) => {
  const b = ctx.pixels.beats || [];
  const share = b.length ? b.filter((x) => x.moving).length / b.length : 0;
  return [res(`beat: something moves on every beat at ${p.bpm} BPM (≥ 90% of ${b.length} beats)`, share >= 0.9, share, "≥ 0.9")];
};

T.loop = (ctx, p) => {
  const L = ctx.pixels.loop;
  const f0 = ctx.frames[0].roles, f1 = ctx.frames[ctx.frames.length - 1].roles;
  const same = Object.keys(f0).every((k) => f1[k] && ["x", "y", "w", "h", "o"].every((q) => Math.abs(f0[k][q] - f1[k][q]) <= (q === "o" ? 0.02 : 2)));
  return [res("loop: the last frame is the first frame", L != null && L <= 0.01 && same, { pixels: L, roles: same }, "≤ 1% of pixels differ")];
};

// ---------- pixel checks (computed from screenshots by grade.mjs) ----------
T.curtain = (ctx, p) => {
  const c = ctx.pixels.curtain;
  if (!c || !c.length) return [res("curtain: measured", false, null, "frames")];
  const cov = c.map((f) => f.cov);
  const s = c.findIndex((f) => f.cov > 0.01), e = c.findIndex((f) => f.cov >= 0.995);
  const ts = s >= 0 ? c[s].t : null, te = e >= 0 ? c[e].t : null;
  const mono = cov.every((x, i) => i === 0 || x >= cov[i - 1] - 0.002);
  const mid = c.filter((f) => f.cov > 0.02 && f.cov < 0.98);
  const fromBelow = mid.length > 0 && mid.every((f) => f.bottomUp);
  const mixed = maxOf(mid.map((f) => f.mixed));
  let eased = null;
  if (s >= 0 && e > s + 6) {
    const sp = cov.slice(s, e + 1).map((x, i, a) => (i ? x - a[i - 1] : 0)).slice(1);
    const n = Math.max(1, Math.round(sp.length * 0.15)), pk = maxOf(sp);
    eased = [mean(sp.slice(0, n)) / pk, mean(sp.slice(-n)) / pk];
  }
  const b0 = c[0], b1 = c[c.length - 1];
  return [
    ...(p.start ? [res(`curtain: starts at ${p.start[0]}–${p.start[1]}s`, ts != null && ts >= p.start[0] && ts <= p.start[1], ts, p.start)] : []),
    p.cover
      ? res(`curtain: covers the frame by ${p.cover[0]}–${p.cover[1]}s (a wipe, not a cut)`, te != null && te >= p.cover[0] && te <= p.cover[1] && te - ts >= 0.2, te, p.cover)
      : res("curtain: covers the whole frame, as a wipe (≥ 0.2s), not a cut", ts != null && te != null && te - ts >= 0.2, ts != null && te != null ? te - ts : null, "≥ 0.2s"),
    res("curtain: rises from the bottom edge", fromBelow, fromBelow, true),
    res("curtain: only moves one way", mono, mono, true),
    res("curtain: a hard edge between surfaces, no crossfade (≤ 4% mixed pixels)", mixed <= 0.04, mixed, "≤ 0.04"),
    res("curtain: eased (edge speed at start and end < 50% of peak)", eased && eased[0] < 0.5 && eased[1] < 0.5, eased, "< 0.5"),
    res("curtain: scene A before, scene B after", b0.cov <= 0.005 && b1.cov >= 0.995, [b0.cov, b1.cov], [0, 1]),
  ];
};

T.mask = (ctx, p) => {
  const m = ctx.pixels.mask;
  if (!m || !m.length) return [res("mask: measured", false, null, "frames")];
  const worst = maxOf(m.map((f) => f.outside));
  return [res("rise: never seen outside its line (masked, ≤ 150 ink pixels outside)", worst <= 150, worst, "≤ 150")];
};

T.surface_light_warm = (ctx, p) => {
  const s = ctx.pixels.surface || [];
  const ok = s.length > 0 && s.every((x) => { const c = [1, 3, 5].map((i) => parseInt(x.got.slice(i, i + 2), 16)); return Math.min(...c) >= 200 && c[0] >= c[2] && Math.max(...c) - Math.min(...c) <= 16; });
  return [res("canvas: a light warm gray, as asked", ok, s.slice(0, 3).map((x) => x.got), "light, r ≥ b, near-neutral")];
};

T.surface = (ctx, p) => {
  const s = ctx.pixels.surface || [];
  return [res(`surface: the frame is ${p.colour}`, s.length > 0 && s.every((x) => x.ok), s.map((x) => x.got), p.colour)];
};

T.coral_mark = (ctx, p) => {
  const s = ctx.pixels.coral_mark;
  return [res("lockup: the mark is coral on screen", s != null && s >= 0.2, s, "≥ 20% of its box")];
};

// ---------- the contract, for every task ----------
export function contract(ctx, task) {
  const out = [];
  out.push(res("contract: loads, with no page errors", !ctx.log.errors.length, ctx.log.errors.slice(0, 3), "no errors"));
  out.push(res("contract: offline (nothing fetched from outside the folder)", !ctx.log.network.length, ctx.log.network.slice(0, 3), "none"));
  if (task.duration_range) out.push(res(`contract: lasts ${task.duration_range[0]}–${task.duration_range[1]}s`, ctx.duration >= task.duration_range[0] && ctx.duration <= task.duration_range[1], ctx.duration, task.duration_range));
  else out.push(res(`contract: timeline lasts ${task.duration}s`, Math.abs(ctx.duration - task.duration) <= 0.02, ctx.duration, task.duration));
  const missing = task.roles.filter((r) => !ctx.frames.some((f) => f.roles[r]));
  const dup = task.roles.filter((r) => ctx.frames.some((f) => f.roles[r] && f.roles[r].dup));
  out.push(res("contract: every role is tagged, once", !missing.length && !dup.length, { missing, dup }, "all, unique"));
  // Measured boxes are not enough: a role clipped away by an ancestor (an overflow-hidden box of zero width,
  // say) moves as briefed and is never seen. Each must be shown at some moment: at least half its width and
  // half its height on screen (half the frame's, for a strip wider or taller than the frame).
  const onScreen = (r) => r && r.o >= 0.5 && (r.vw == null || (r.vw >= 0.5 * Math.min(r.w, 1920) && r.vh >= 0.5 * Math.min(r.h, 1080)));
  const unseen = task.roles.filter((r) => !missing.includes(r) && !ctx.frames.some((f) => onScreen(f.roles[r])));
  out.push(res("contract: every role is on screen at some point (not clipped away)", !unseen.length, unseen, "all"));
  out.push(res("contract: same picture whatever order it is seeked in", ctx.determinism.ok, ctx.determinism.worst, "roles exact; < 0.5% of pixels differ"));
  out.push(res("contract: a pure function of time (no clocks, randomness, loops or CSS animation)", !ctx.static.impure.length, ctx.static.impure, "none"));
  const effects = [];
  for (const s of ctx.scans)
    for (const [kind, val, tag] of s.effects) {
      let bad = false;
      const okShadow = task.palette === "neutral" ? darkShadow : shadowOk;  // Open Design asks for a soft drop shadow
      if (kind === "filter") bad = /blur\(/.test(val) || /drop-shadow/.test(val) && !okShadow(val);
      else if (kind === "box-shadow" || kind === "text-shadow") bad = !okShadow(val);
      else if (kind === "background-image") bad = /gradient\(/.test(val);
      else if (kind === "backdrop-filter" || kind === "css-animation" || kind === "css-transition") bad = true;
      if (bad && !effects.some((e) => e[0] === kind && e[2] === tag)) effects.push([kind, val.slice(0, 80), tag]);
    }
  out.push(res("brand: no glow, blur, gradients or CSS animation", !effects.length, effects.slice(0, 4), "none"));
  const off = [];
  for (const s of ctx.scans)
    for (const [c, why] of Object.entries(s.colors)) {
      const v = rgb(c);
      const ok = task.palette === "neutral" ? Math.max(...v.c) - Math.min(...v.c) <= 14 : PALETTE.some((p) => near(v.c, p, 1));
      if (v && !ok && !off.some((o) => o[0] === c)) off.push([c, why[0]]);
    }
  if (task.palette === "any") off.length = 0;
  out.push(task.palette === "any" ? res("colour: free choice", true, null, "any", ) : task.palette === "neutral"
    ? res("art direction: black, white and warm grays only", !off.length, off.slice(0, 4), "neutral colours")
    : res("brand: only the palette's colours", !off.length, off.slice(0, 4), "brand palette"));
  const fonts = new Set(), loaded = new Set();
  for (const s of ctx.scans) { Object.keys(s.fonts).forEach((f) => fonts.add(f.split(",")[0].replace(/["']/g, "").trim())); s.loaded.forEach((f) => loaded.add(f)); }
  const allowed = task.fonts === "any" ? null : task.fonts || ["Open Sauce Two", "JetBrains Mono"];
  // A free piece may use any font, but a web font it names must actually load (or the render machine substitutes).
  const badFont = [...fonts].map((f) => f.replace(/ \d+$/, "")).filter((f) => (allowed ? !allowed.includes(f) || !loaded.has(f) : false));
  out.push(allowed ? res(`${task.fonts ? "art direction" : "brand"}: only ${allowed.join(" / ")}, loaded from the folder`, !badFont.length, [...new Set(badFont)], allowed.join(" / ")) : res("type: free choice", true, null, "any"));
  const last = ctx.frames[ctx.frames.length - 1].roles;
  // Containers bigger than the frame (a world the camera moves over) are not text blocks.
  const unsafe = Object.entries(last).filter(([k, r]) => r.text && r.text.trim() && r.o > 0.5 && visibleAt(r) && r.w <= FRAME.W && r.h <= FRAME.H && !inSafe(r)).map(([k]) => k);
  out.push(res("staging: text ends inside title-safe", !unsafe.length, unsafe, "none outside"));
  const jit = jitter(ctx, task.oscillate || []);
  out.push(res("motion: no jitter or shake", !jit.length, jit.slice(0, 3), "none"));
  return out;
}

function darkShadow(val) {
  // Any dark shadow, warm or cool; light or coloured ones are glow.
  const cols = val.match(/rgba?\([^)]+\)/g) || [];
  return cols.every((c) => { const v = rgb(c); return v && (v.a === 0 || (Math.max(...v.c) <= 90 && Math.max(...v.c) - Math.min(...v.c) <= 40)); });
}

function shadowOk(val) {
  // The brand's elevation is stacked charcoal shadows at a few percent; anything coloured or light is glow.
  const cols = val.match(/rgba?\([^)]+\)/g) || [];
  return cols.every((c) => { const v = rgb(c); return v && (v.a === 0 || (DARK.some((d) => near(v.c, d, 3)) && v.a <= 0.3)); });
}

function jitter(ctx, exempt) {
  // A shake moves an element: both opposite edges go the same way. A resize moves them apart, and layout
  // rounding nudges one edge at a time; neither is shake. So only the motion both edges share counts.
  const roles = new Set();
  ctx.frames.forEach((f) => Object.keys(f.roles).forEach((r) => roles.add(r)));
  const win = Math.round(0.5 * ctx.fps), found = [];
  for (const role of roles) {
    if (exempt.includes(role)) continue;
    const o = series(ctx, role, "o");
    for (const [k1, k2, axis] of [["x", "r", "x"], ["y", "b", "y"]]) {
      const a = series(ctx, role, k1), b = series(ctx, role, k2);
      const d = a.map((v, i) => {
        if (!i || v == null || a[i - 1] == null || b[i] == null || b[i - 1] == null || o[i] <= 0.1) return 0;
        const da = v - a[i - 1], db = b[i] - b[i - 1];
        return Math.sign(da) === Math.sign(db) ? Math.sign(da) * Math.min(Math.abs(da), Math.abs(db)) : 0;
      });
      let pos = 0;
      const p = d.map((x) => (pos += x));
      for (let i = 0; i + win < d.length; i += Math.round(win / 4)) {
        const seg = d.slice(i, i + win), vals = p.slice(i, i + win);
        let rev = 0, sg = 0;
        for (const x of seg) { if (Math.abs(x) < 0.75) continue; const g = Math.sign(x); if (sg && g !== sg) rev++; sg = g; }
        if (rev >= 4 && maxOf(vals) - minOf(vals) < 12) { found.push(`${role}.${axis} at ${tAt(ctx, i)}s`); break; }
      }
    }
  }
  return found;
}

export function run(ctx, task) {
  const out = contract(ctx, task).map((r) => ({ ...r, kind: "contract" }));
  for (const c of task.checks) {
    const fn = T[c.type];
    if (!fn) throw new Error("unknown check " + c.type);
    let got;
    try { got = fn(ctx, c); } catch (e) { got = [res(`${c.type}: could not be measured`, false, String(e.message || e).slice(0, 120), "measurable")]; }
    for (const r of got) out.push({ ...r, kind: "craft", principle: c.principle || task.principle });
  }
  // A page that never shows any of its tagged elements measures nothing: its motion checks do not pass.
  const seen = out.find((r) => r.id.startsWith("contract: every role is on screen"));
  if (task.roles.length && seen && !seen.pass && seen.got.length === task.roles.length)
    for (const r of out) if (r.kind === "craft" && r.pass) { r.pass = false; r.got = "nothing tagged is ever on screen"; }
  return out;
}
