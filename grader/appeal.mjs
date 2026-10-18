// Appeal: what makes moving graphics enjoyable to watch, measured from the rendered frames (so canvas, SVG and
// DOM pieces are read alike). Six parts, each 0–1, from the perception and aesthetics literature:
//   alive       attention fades on a still screen (habituation): share of seconds with something changing
//   continuity  good continuation / processing fluency: change carried by things moving or reshaping, not by
//               cuts and fades
//   smooth      smooth motion is liked, abrupt motion disliked (jerk): moving regions keep their velocity
//   complexity  Berlyne's inverted U: a few independent motions at once, not one and not a swarm; noise is none
//   variety     novelty against habituation: how many kinds of motion and transition the piece uses
//   pacing      Cutting, DeLong & Nothelfer 2010: attention-matched films fluctuate as 1/f; the slope of the
//               motion-energy spectrum, best at −1
// Optical flow is block matching on a quarter-size picture, coarse to fine.

const W = 480, H = 270, B = 16, GX = W / B, GY = Math.floor(H / B);

// Every frame at `fps`, as quarter-size luminance.
export async function capture(m, duration, decode, fps = 30) {
  const cdp = await m.page.context().newCDPSession(m.page);
  const frames = [];
  const n = Math.floor(Math.min(duration, 120) * fps);
  for (let i = 0; i <= n; i++) {
    await m.seek(Math.min(i / fps, duration - 1e-6));
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 0.25 } });
    const png = decode(Buffer.from(data, "base64"));
    const Y = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = ((y * png.width + x) << 2);
      Y[y * W + x] = (png.data[k] * 77 + png.data[k + 1] * 150 + png.data[k + 2] * 29) >> 8;
    }
    frames.push(Y);
  }
  await cdp.detach();
  return frames;
}

function half(Y, w, h) {
  const w2 = w >> 1, h2 = h >> 1, o = new Uint8Array(w2 * h2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const k = 2 * y * w + 2 * x;
    o[y * w2 + x] = (Y[k] + Y[k + 1] + Y[k + w] + Y[k + w + 1]) >> 2;
  }
  return o;
}
function sad(a, b, w, h, x0, y0, s, dx, dy) {
  let t = 0;
  for (let y = y0; y < y0 + s; y++) {
    const yy = y - dy;
    if (yy < 0 || yy >= h) { t += 255 * s; continue; }
    for (let x = x0; x < x0 + s; x++) { const xx = x - dx; t += xx < 0 || xx >= w ? 255 : Math.abs(a[y * w + x] - b[yy * w + xx]); }
  }
  return t;
}

// Per frame pair: which blocks changed, which of those moved (and by how much), and which changed in place.
function flow(prev, cur, pyrPrev, pyrCur) {
  const blocks = [];
  for (let by = 0; by < GY; by++) for (let bx = 0; bx < GX; bx++) {
    const x0 = bx * B, y0 = by * B;
    let changed = 0, amount = 0;
    for (let y = y0; y < y0 + B; y++) for (let x = x0; x < x0 + B; x++) { const d = Math.abs(cur[y * W + x] - prev[y * W + x]); if (d > 12) { changed++; amount += d; } }
    if (changed < 8) continue;
    const hard = amount / changed > 48;  // an edge passing (reshape, reveal, typing), not a soft fade
    // Coarse: 1/4 of this size (each block is 4×4 there), ±8 → ±32 here (±128 px on the 1920 frame).
    const cw = W >> 2, ch = H >> 2, cx = x0 >> 2, cy = y0 >> 2;
    let best = Infinity, cvx = 0, cvy = 0;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const s = sad(pyrCur, pyrPrev, cw, ch, cx, cy, 4, dx, dy) + (Math.abs(dx) + Math.abs(dy)) * 2;
      if (s < best) { best = s; cvx = dx; cvy = dy; }
    }
    let vx = 0, vy = 0, bs = Infinity;
    for (let dy = cvy * 4 - 3; dy <= cvy * 4 + 3; dy++) for (let dx = cvx * 4 - 3; dx <= cvx * 4 + 3; dx++) {
      const s = sad(cur, prev, W, H, x0, y0, B, dx, dy);
      if (s < bs) { bs = s; vx = dx; vy = dy; }
    }
    const s0 = sad(cur, prev, W, H, x0, y0, B, 0, 0);
    const moving = (vx || vy) && bs < 0.5 * s0;
    blocks.push({ bx, by, hard, moving: !!moving, vx: moving ? vx : 0, vy: moving ? vy : 0 });
  }
  return blocks;
}

const pos = (b) => [b.bx * B + B / 2, b.by * B + B / 2];

export function analyse(frames, fps = 30) {
  const pyr = frames.map((Y) => half(half(Y, W, H), W >> 1, H >> 1));
  const F = [];  // per pair
  let prevMap = null;
  let movingBF = 0, activeBF = 0, linked = 0, smoothLinked = 0, coherentBF = 0, continuousBF = 0;
  for (let t = 1; t < frames.length; t++) {
    const bl = flow(frames[t - 1], frames[t], pyr[t - 1], pyr[t]);
    const map = new Map(bl.map((b) => [b.by * GX + b.bx, b]));
    const mv = bl.filter((b) => b.moving);
    // Coherence: a moving block agrees with a neighbour now, or continues a moving region from the last frame.
    for (const b of mv) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => { const n = map.get((b.by + oy) * GX + b.bx + ox); return n && n.moving && Math.abs(n.vx - b.vx) <= 1 && Math.abs(n.vy - b.vy) <= 1; });
      let cont = false;
      if (prevMap) {
        const [px, py] = pos(b), sx = Math.floor((px - b.vx) / B), sy = Math.floor((py - b.vy) / B);
        const p = prevMap.get(sy * GX + sx);
        // Abruptness is relative to speed: an ease changes speed by a fraction a frame, a jump from rest does not.
        if (p && p.moving) { linked++; const tol = Math.max(1.5, 0.35 * Math.hypot(p.vx, p.vy)), ok = Math.hypot(p.vx - b.vx, p.vy - b.vy) <= tol; if (ok) smoothLinked++; cont = ok; }
      }
      b.coherent = near || cont;
    }
    const coh = mv.filter((b) => b.coherent);
    // Independent motions: groups of touching coherent blocks moving alike.
    const seen = new Set(); let groups = 0;
    for (const b of coh) {
      const k = b.by * GX + b.bx; if (seen.has(k)) continue;
      let size = 0; const st = [b]; seen.add(k);
      while (st.length) {
        const c = st.pop(); size++;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const kk = (c.by + oy) * GX + c.bx + ox, n = map.get(kk);
          if (n && n.moving && n.coherent && !seen.has(kk) && Math.abs(n.vx - c.vx) <= 1 && Math.abs(n.vy - c.vy) <= 1) { seen.add(kk); st.push(n); }
        }
      }
      if (size >= 2) groups++;
    }
    // Kind of change in this frame.
    const inPlace = bl.length - mv.length, n = GX * GY;
    let kind = null;
    if (bl.length >= 2) {
      if (bl.length > 0.4 * n && inPlace > 0.7 * bl.length) kind = "cut";
      else if (coh.length >= 2 && coh.length >= inPlace) {
        if (groups >= 2) kind = "multi";
        else {
          const cx = coh.reduce((s, b) => s + pos(b)[0], 0) / coh.length, cy = coh.reduce((s, b) => s + pos(b)[1], 0) / coh.length;
          let div = 0, curl = 0, mag = 0;
          for (const b of coh) { const [x, y] = pos(b), rx = x - cx, ry = y - cy, r = Math.hypot(rx, ry) || 1, v = Math.hypot(b.vx, b.vy) || 1; div += (b.vx * rx + b.vy * ry) / (r * v); curl += (b.vx * ry - b.vy * rx) / (r * v); mag++; }
          kind = Math.abs(div / mag) > 0.6 ? "scale" : Math.abs(curl / mag) > 0.6 ? "rotate" : "slide";
        }
      } else kind = bl.filter((b) => !b.moving && b.hard).length >= inPlace / 2 ? "reshape" : "fade";
    }
    // Continuous change: coherent motion, or hard-edged change in place (a morph, a reveal) outside a cut.
    const reshaping = kind === "cut" ? 0 : bl.filter((b) => !b.moving && b.hard).length;
    F.push({ active: bl.length, moving: mv.length, coherent: coh.length, groups, kind, cx: bl.length ? bl.reduce((s, b) => s + b.bx, 0) / bl.length : null });
    movingBF += mv.length; activeBF += bl.length; coherentBF += coh.length; continuousBF += coh.length + reshaping;
    prevMap = map;
  }
  // In-place change that travels across the frame is a wipe or reveal; in place, a fade (or a colour change).
  const sec = Math.max(1, Math.round(fps));
  const windows = [];
  for (let s = 0; s + sec <= F.length; s += sec) {
    const w = F.slice(s, s + sec), act = w.filter((f) => f.kind);
    if (!act.length) { windows.push(null); continue; }
    const count = {};
    for (const f of act) count[f.kind] = (count[f.kind] || 0) + 1;
    let k = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    if (k === "reshape") { const xs = act.map((f) => f.cx); if (Math.max(...xs) - Math.min(...xs) > 0.15 * GX) k = "wipe"; }
    windows.push(k);
  }
  const live = windows.filter(Boolean);
  const alive = windows.length ? live.length / windows.length : 0;
  const continuity = activeBF ? continuousBF / activeBF : 0;
  const smooth = linked ? smoothLinked / linked : 0;
  const act = F.filter((f) => f.active >= 2);
  const g = act.length ? act.reduce((s, f) => s + f.groups, 0) / act.length : 0;
  const cohShare = movingBF ? coherentBF / movingBF : 0;
  const complexity = (g < 2 ? g / 2 : g <= 4 ? 1 : Math.max(0, 1 - (g - 4) / 6)) * cohShare;
  const kinds = {}; for (const k of live) kinds[k] = (kinds[k] || 0) + 1;
  const used = Object.entries(kinds).filter(([, c]) => c / live.length >= 0.05).map(([k]) => k);
  const variety = Math.min(1, Math.max(0, used.length - 1) / 3);
  const beta = slope(F.map((f) => f.coherent + 0.5 * (f.active - f.moving)), fps);
  const pacing = beta == null ? 0 : Math.max(0, 1 - Math.abs(beta - 1));
  const parts = { alive: Math.min(1, alive / 0.7), continuity: Math.min(1, continuity / 0.5), smooth: Math.min(1, smooth / 0.8), complexity, variety, pacing };
  const appeal = Object.values(parts).reduce((a, b) => a + b, 0) / 6;
  return { appeal: +appeal.toFixed(3), parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.toFixed(3)])),
    measured: { alive: +alive.toFixed(3), continuity: +continuity.toFixed(3), smooth: +smooth.toFixed(3), groups: +g.toFixed(2), coherent: +cohShare.toFixed(3), kinds, spectrum_slope: beta == null ? null : +beta.toFixed(2), seconds: +(F.length / fps).toFixed(1) } };
}

// −slope of log power against log frequency, 0.1–3 Hz, of the motion-energy series (1 = 1/f, 0 = white).
function slope(xs, fps) {
  const n = xs.length;
  if (n < 8 * fps) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (xs.every((x) => Math.abs(x - mean) < 1e-9)) return 0;
  const pts = [];
  for (let k = 1; k < n / 2; k++) {
    const f = (k * fps) / n;
    if (f < 0.1 || f > 3) continue;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)), a = (2 * Math.PI * k * i) / n; re += (xs[i] - mean) * w * Math.cos(a); im -= (xs[i] - mean) * w * Math.sin(a); }
    const p = re * re + im * im;
    if (p > 0) pts.push([Math.log(f), Math.log(p)]);
  }
  if (pts.length < 5) return null;
  // Average into log-spaced bins so the many high frequencies do not outvote the few low ones.
  const bins = new Map();
  for (const [lx, ly] of pts) { const b = Math.round(lx * 4); const v = bins.get(b) || [0, 0, 0]; v[0] += lx; v[1] += ly; v[2]++; bins.set(b, v); }
  const P = [...bins.values()].map(([a, b, c]) => [a / c, b / c]);
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length;
  const num = P.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0), den = P.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  return den ? -num / den : null;
}
