// Polish and taste, measured over every element on the page (tagged or not), for any piece.
//
// Polish: the glitches a viewer notices: tooling words on screen, one-frame flashes, text on text, text
// cut off at rest, characters the font cannot draw, empty screen in the middle, unreadably small type.
// Taste: Emil Kowalski's written rules for motion and type (emilkowal.ski: "7 Practical Animation Tips",
// "You Don't Need Animations", "Agents with Taste"), measured on every appearance, exit and move.
// Both report checks with kind "polish" / "taste"; neither changes the task's own score.

const W = 1920, H = 1080;
const r2 = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
const res = (id, pass, got, want, kind) => ({ id, pass: !!pass, got: r2(got), want, kind });

// Words about the production itself, not the piece: the "Export ready" kind of slip.
const TOOLING = /\b(export(?:ed|ing)?(?: ready| as)?|render(?:ing|ed)?|\.?mp4|\.?webm|\.?gif|hyperframes|gsap|timeline|keyframes?|\d+\s*fps|frame\s*\d+|\d+\s*bpm|bar\s*\d+\s*\/\s*\d+|t\s*=\s*\d|undefined|NaN|null|\[object|\{\{|lorem ipsum|todo|fixme|placeholder|debug)\b/i;

export function analyse({ info, frames, fps, glyphs, blank, loaded, task }) {
  const n = info.length;
  // Per element: arrays over sampled frames (null when not drawn).
  const tr = Array.from({ length: n }, () => frames.map(() => null));
  frames.forEach((f, k) => { for (const e of f.els) tr[e[0]][k] = e; });
  const vis = (e) => e && e[5] > 0.05 && e[3] > 0.5 && e[4] > 0.5 && e[1] + e[3] > 0 && e[2] + e[4] > 0 && e[1] < W && e[2] < H;
  const isAnc = (a, b) => { for (let p = info[b].parent; p >= 0; p = info[p].parent) if (p === a) return true; return false; };
  const out = [];

  // ---------- polish ----------
  const tooling = new Set();
  for (const f of frames) for (const e of f.els) if (e[6] && e[5] >= 0.5 && vis(e)) { const m = e[6].match(TOOLING); if (m) tooling.add(e[6].slice(0, 60)); }
  out.push(res("polish: no tooling words on screen (export, render, MP4, fps, BPM counters, undefined…)", tooling.size === 0, [...tooling].slice(0, 4), "none", "polish"));

  // A flash: something drawn for at most two frames at 30 fps, invisible on either side.
  const flashes = [];
  for (let i = 0; i < n; i++) {
    const t = tr[i];
    for (let k = 1; k < t.length - 1; k++) {
      if (!(vis(t[k]) && t[k][5] > 0.3 && !vis(t[k - 1]))) continue;
      let j = k; while (j < t.length && vis(t[j]) && t[j][5] > 0.3) j++;
      if (j < t.length && j - k <= 2 && (t[k][6] || (t[k][3] >= 8 && t[k][4] >= 8))) {
        const p = info[i].parent;
        if (!(p >= 0 && flashes.some((x) => x.i === p && x.k === k))) flashes.push({ i, k, text: !!t[k][6] });
      }
    }
  }
  const textFlash = flashes.filter((x) => x.text).length, boxFlash = flashes.length - textFlash;
  out.push(res("polish: nothing flashes for a frame or two", textFlash === 0 && boxFlash < 3, { text: textFlash, shapes: boxFlash }, "no text flashes, < 3 shape flashes", "polish"));

  // Text on text: two fully shown texts overlapping by more than a third of the smaller, for ≥ 0.3 s.
  const need = Math.round(0.3 * fps);
  let overlapRun = 0, worstOverlap = 0, overlapPair = null;
  for (const f of frames) {
    const T = f.els.filter((e) => e[6] && e[5] >= 0.9 && vis(e) && e[7] && e[7][0] >= 10);
    let hit = null;
    for (let a = 0; a < T.length && !hit; a++)
      for (let b = a + 1; b < T.length && !hit; b++) {
        const A = T[a], B = T[b];
        if (isAnc(A[0], B[0]) || isAnc(B[0], A[0])) continue;
        const ix = Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]), iy = Math.min(A[2] + A[4], B[2] + B[4]) - Math.max(A[2], B[2]);
        if (ix > 0 && iy > 0 && ix * iy > 0.33 * Math.min(A[3] * A[4], B[3] * B[4])) hit = [A[6].slice(0, 30), B[6].slice(0, 30)];
      }
    overlapRun = hit ? overlapRun + 1 : 0;
    if (overlapRun > worstOverlap) { worstOverlap = overlapRun; overlapPair = hit; }
  }
  out.push(res("polish: no text sitting on other text", worstOverlap < need, overlapPair, "none ≥ 0.3s", "polish"));

  // Cut off: text held still (≥ 0.5 s) partly outside the frame, or overflowing a box that clips it.
  const cut = new Set(), still = Math.round(0.5 * fps);
  for (let i = 0; i < n; i++) {
    const t = tr[i];
    let run = 0;
    for (let k = 1; k < t.length; k++) {
      const e = t[k], p = t[k - 1];
      const ok = e && e[6] && e[5] >= 0.9 && p && Math.abs(e[1] - p[1]) < 0.5 && Math.abs(e[2] - p[2]) < 0.5;
      run = ok ? run + 1 : 0;
      if (run >= still && (e[1] < -1 || e[2] < -1 || e[1] + e[3] > W + 1 || e[2] + e[4] > H + 1 || (e[7] && e[7][5]))) cut.add(e[6].slice(0, 40));
    }
  }
  out.push(res("polish: no text cut off at rest (by the frame or its box)", cut.size === 0, [...cut].slice(0, 3), "none", "polish"));

  const miss = {};
  for (const g of glyphs) for (const [fam, chars] of Object.entries(g)) if (loaded.includes(fam)) miss[fam] = [...new Set((miss[fam] || "") + chars)].join("");
  out.push(res("polish: every character is in its font (no fallback boxes on a render machine)", !Object.keys(miss).length, miss, "none", "polish"));

  // Empty screen: a blank stretch ≥ 1 s between the first and last thing shown.
  const firstC = blank.findIndex((b) => !b.blank), lastC = blank.length - 1 - [...blank].reverse().findIndex((b) => !b.blank);
  let gap = 0, worstGap = 0;
  if (firstC >= 0) for (let k = firstC; k <= lastC; k++) { gap = blank[k].blank ? gap + 1 : 0; worstGap = Math.max(worstGap, gap); }
  out.push(res("polish: no empty screen in the middle (≥ 1s)", worstGap * 0.25 < 1, worstGap * 0.25, "< 1s", "polish"));

  const tiny = new Set();
  for (let i = 0; i < n; i++) {
    let run = 0;
    for (const e of tr[i]) { run = e && e[6] && e[7] && e[5] >= 0.9 && vis(e) && e[7][0] < 12 ? run + 1 : 0; if (run >= still) tiny.add(`${e[6].slice(0, 24)} (${e[7][0]}px)`); }
  }
  out.push(res("polish: no text smaller than 12px held on screen", tiny.size === 0, [...tiny].slice(0, 3), "≥ 12px", "polish"));

  // ---------- taste: Emil's rules ----------
  // Appearances and exits of top-most elements (a child that comes with its parent is the parent's).
  const settle = Math.round(0.2 * fps);
  const apps = [], exits = [];
  for (let i = 0; i < n; i++) {
    const t = tr[i];
    for (let k = 1; k < t.length; k++) {
      if (vis(t[k]) && !vis(t[k - 1])) {
        const p = info[i].parent;
        if (p >= 0 && vis(tr[p][k]) && !vis(tr[p][k - 1])) continue;
        let j = k, calm = 0;
        while (j + 1 < t.length && vis(t[j + 1]) && calm < settle) {
          const a = t[j], b = t[j + 1];
          const moving = Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]) + Math.abs(a[4] - b[4]) > 0.5 || Math.abs(a[5] - b[5]) > 0.01;
          calm = moving ? 0 : calm + 1; j++;
        }
        if (calm >= settle) apps.push({ i, k, end: j - settle, path: t.slice(k, j - settle + 1) });
      }
      if (!vis(t[k]) && vis(t[k - 1])) {
        const p = info[i].parent;
        if (p >= 0 && !vis(tr[p][k]) && vis(tr[p][k - 1])) continue;
        let s = k - 1;
        while (s - 1 >= 0 && vis(t[s - 1])) {
          const a = t[s - 1], b = t[s];
          if (Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]) + Math.abs(a[4] - b[4]) <= 0.5 && Math.abs(a[5] - b[5]) <= 0.01) break;
          s--;
        }
        exits.push({ i, k, dur: (k - s) / fps });
      }
    }
  }
  const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);
  const rule = (id, xs, why) => { const s = share(xs); out.push(res(`taste: ${id}`, s == null || s >= 0.8, s == null ? "n/a" : s, why, "taste")); return s; };

  // 1. "Don't animate from scale(0)": a uniform scale-up should start at 0.9 or more (lines that draw are not scale-ups).
  const scaled = apps.filter((a) => a.path.length > 1).map((a) => { const f = a.path[0], z = a.path[a.path.length - 1]; return [f[3] / z[3], f[4] / z[4]]; })
    .filter(([w, h]) => w < 0.98 && h < 0.98 && Math.abs(w - h) < 0.25);
  const s1 = rule("nothing grows from nothing (scale-ins start at ≥ 0.5 of size; Emil: 0.9+)", scaled.map(([w, h]) => Math.min(w, h) >= 0.5), "≥ 80% of scale-ins");

  // 2. Entering: ease-out, never ease-in. A move into place must not speed up into its resting spot.
  const entering = apps.filter((a) => a.path.length >= 6).map((a) => {
    const P = a.path, sp = P.slice(1).map((e, j) => Math.hypot(e[1] - P[j][1], e[2] - P[j][2]) + Math.abs(e[3] - P[j][3]) + Math.abs(e[4] - P[j][4]));
    const travel = sp.reduce((x, y) => x + y, 0);
    if (travel < 16) return null;
    const m = Math.max(1, Math.round(sp.length / 3)), first = sp.slice(0, m).reduce((x, y) => x + y, 0), last = sp.slice(-m).reduce((x, y) => x + y, 0);
    return last <= 1.5 * first;
  }).filter((x) => x != null);
  const s2 = rule("entrances ease out (none speed up into place)", entering, "≥ 80% of entrances");

  // 3. "Exits run about 20% faster than entrances".
  const pairs = [];
  for (const x of exits) { const a = apps.find((q) => q.i === x.i && q.k < x.k); if (a && x.dur >= 2 / fps) pairs.push(x.dur <= ((a.end - a.k + 1) / fps) * 1.1); }
  const s3 = rule("exits are no slower than entrances", pairs, "≥ 80% of elements that come and go");

  // 4. UI pieces: "UI animations should generally stay under 300ms" (allowing 400 ms for a morph on screen).
  let s4 = null;
  if (task.ui) {
    const durs = apps.filter((a) => a.path.length > 1).map((a) => (a.end - a.k + 1) / fps);
    s4 = rule("UI changes are quick (≤ 400ms; Emil: under 300ms)", durs.map((d) => d <= 0.4), "≥ 80% of changes");
  }

  // 5–8. Type: the ellipsis character, tracked-out capitals, tabular figures that change, measure ≤ 65ch.
  const texts = new Map();
  for (const f of frames) for (const e of f.els) if (e[6] && e[5] >= 0.5 && vis(e) && e[7]) { const L = texts.get(e[0]) || []; L.push(e); texts.set(e[0], L); }
  const ell = [], caps = [], tab = [], measure = [];
  for (const [, L] of texts) {
    const e = L[L.length - 1], [fs, ls, tt] = e[7];
    if (/\.\.\./.test(e[6])) ell.push(false); else if (/…/.test(e[6])) ell.push(true);
    const letters = e[6].replace(/[^A-Za-z]/g, "");
    if (letters.length >= 3 && (tt === "uppercase" || letters === letters.toUpperCase())) caps.push(ls !== "normal" && parseFloat(ls) > 0);
    const nums = [...new Set(L.map((x) => x[6]))].filter((s) => /^[\s$€£]*[\d.,:%+\-]+[\sA-Za-z%]*$/.test(s));
    if (nums.length >= 4) {
      const byLen = {}; for (const x of L) if (nums.includes(x[6])) (byLen[x[6].length] = byLen[x[6].length] || []).push(x[3]);
      tab.push(Object.values(byLen).every((ws) => Math.max(...ws) - Math.min(...ws) <= 1));
    }
    const len = e[7][6] || e[6].length;
    if (len >= 60) { const lines = Math.max(1, Math.round(e[4] / (fs * 1.35))); measure.push(len / lines <= 80); }
  }
  const s5 = rule("an ellipsis is the … character, not three dots", ell, "all");
  const s6 = rule("capital-letter labels are tracked out (letter-spacing > 0)", caps, "≥ 80%");
  const s7 = rule("numbers that change use tabular figures (no width jiggle)", tab, "all");
  const s8 = rule("paragraph lines stay near 65 characters (≤ 80)", measure, "≥ 80%");

  const scores = [s1, s2, s3, s4, s5, s6, s7, s8].filter((x) => x != null);
  const polish = out.filter((c) => c.kind === "polish");
  return {
    checks: out,
    polish: polish.filter((c) => c.pass).length / polish.length,
    taste: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    counts: { appearances: apps.length, exits: exits.length, elements: n },
  };
}
