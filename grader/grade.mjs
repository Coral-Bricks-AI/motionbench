// node grader/grade.mjs <workspace> <task-dir> [--out <dir>]
// Measures the composition in <workspace>/index.html frame by frame and runs the task's checks.
// Writes <out>/result.json, <out>/measure.json and <out>/sheet.png; prints the score.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { run, rgb } from "./checks.mjs";
import { analyse } from "./polish.mjs";
import * as appeal from "./appeal.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "kit");
const { open, sheet, shrink } = await import(pathToFileURL(path.join(KIT, "tools", "lib.mjs")).href);
const { PNG } = createRequire(path.join(KIT, "package.json"))("pngjs");

const [ws, taskDir] = process.argv.slice(2);
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : path.join(ws, ".grade");
fs.mkdirSync(out, { recursive: true });
const task = JSON.parse(fs.readFileSync(path.join(taskDir, "task.json"), "utf8"));
const fps = task.fps || 60;
const started = Date.now();

// What the source does, read as text: things that make a frame depend on more than time.
function readSources(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["assets", "tools", "node_modules", "snaps", "skills", ".grade", ".claude"].includes(e.name) || e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html?|js|mjs|css)$/.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  return files.map((f) => [path.relative(dir, f), fs.readFileSync(f, "utf8")]);
}
const IMPURE = [
  [/Date\.now\s*\(|new Date\s*\(/, "clock"], [/Math\.random\s*\(/, "Math.random"], [/performance\.now\s*\(/, "performance.now"],
  [/requestAnimationFrame\s*\(/, "requestAnimationFrame"], [/setInterval\s*\(|setTimeout\s*\(/, "timers"],
  [/repeat\s*:\s*-1/, "repeat:-1"], [/@keyframes/, "CSS @keyframes"], [/\banimation\s*:\s*(?!none)[a-z0-9]/i, "CSS animation"],
  [/(^|[;{\s"'])transition\s*:\s*(?!none|all 0s)[a-z0-9]/im, "CSS transition"],
];
const sources = fs.existsSync(ws) ? readSources(ws) : [];
const allSrc = sources.map(([, s]) => s).join("\n");
const impure = [];
for (const [rx, what] of IMPURE) for (const [f, s] of sources) if (rx.test(s) && !impure.includes(`${what} in ${f}`)) impure.push(`${what} in ${f}`);
const staticInfo = { impure, logo: /logo-icon\.svg/.test(allSrc) || allSrc.includes("M172.63,516.24") };

const assets = {};
if (fs.existsSync(path.join(taskDir, "tokens.json"))) assets.tokens = JSON.parse(fs.readFileSync(path.join(taskDir, "tokens.json"), "utf8"));

function fail(reason) {
  const result = { task: task.id, score: 0, contract: 0, craft: 0, polish: 0, taste: 0, appeal: task.track === "long" || task.track === "free" ? 0 : null, error: reason, checks: [], seconds: (Date.now() - started) / 1000 };
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(result, null, 1));
  console.log(`${task.id}: 0.000 (${reason})`);
  process.exit(0);
}

const m = await open(ws);
if (m.error) fail(m.error);

// 1. Every frame, in order: what each role is doing. A piece with a length range is measured to its own end.
if (task.duration_range) task.duration = Math.max(1, Math.min(m.duration || 0, task.duration_range[1]));
const n = Math.round(task.duration * fps);
const frames = [];
for (let i = 0; i <= n; i++) {
  const t = Math.min(i / fps, task.duration - 1e-6);
  frames.push({ t: Math.round((i / fps) * 10000) / 10000, roles: await m.roles(t) });
}
// 2. Colours and effects on screen, four times a second.
const scans = [];
for (let t = 0; t <= task.duration + 1e-9; t += 0.25) scans.push(await m.scan(Math.min(t, task.duration - 1e-6)));
const coralOwners = [];
for (const s of scans)
  for (const [c, whys] of Object.entries(s.colors)) {
    const v = rgb(c);
    if (!v) continue;
    const coral = v.c[0] > 150 && v.c[0] - v.c[2] > 60 && v.c[1] < 140; // the coral ramp's saturated end
    if (coral) for (const w of whys) { const owner = w.split("@")[1] || "(none)"; if (!coralOwners.includes(owner)) coralOwners.push(owner); }
  }

// 2b. Every element on the page at 30 fps, characters each font cannot draw, and blank frames: for the
// polish and taste checks, which look at the whole piece rather than the tagged roles.
const autoInfo = await m.autoInit();
const autoFrames = [];
for (let i = 0; i <= n; i += 2) autoFrames.push({ t: i / fps, els: await m.auto(Math.min(i / fps, task.duration - 1e-6)) });
const glyphs = [];
for (let t = 0.5; t < task.duration; t += 2) glyphs.push(await m.glyphs(t));
const blank = [];
for (let t = 0; t <= task.duration - 1e-6; t += 0.25) {
  const png = shrink(PNG.sync.read(await m.shot(t)), 0.125), d = png.data, counts = new Map();
  for (let k = 0; k < d.length; k += 4) { const key = (d[k] >> 3) << 10 | (d[k + 1] >> 3) << 5 | (d[k + 2] >> 3); counts.set(key, (counts.get(key) || 0) + 1); }
  const mode = Math.max(...counts.values());
  blank.push({ t, blank: 1 - mode / (d.length / 4) < 0.002 });
}

// 3. Pixels, for the checks that can only be seen.
const px = {};
const dec = (buf) => PNG.sync.read(buf);
const at = (png, x, y) => { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexc = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const P = task.pixels || {};
if (P.curtain && P.curtain.role) {
  // Where the curtain is: around the moment the next scene's line first shows.
  const i = frames.findIndex((f) => { const r = f.roles[P.curtain.role]; return r && r.o > 0.5 && r.y < 1080 && r.y + r.h > 0; });
  if (i >= 0) {
    const tv = frames[i].t;
    P.curtain.from = Math.max(0, tv - 1.2); P.curtain.to = Math.min(task.duration - 1e-6, tv + 1.0);
    const png0 = dec(await m.shot(P.curtain.from));
    P.curtain.a = "#" + at(png0, 12, 12).map((v) => v.toString(16).padStart(2, "0")).join("");
  } else P.curtain = null;
}
if (P.curtain) {
  const A = hexc(P.curtain.a), B = hexc(P.curtain.b);
  const AB = B.map((v, i) => v - A[i]), ab2 = AB.reduce((s, v) => s + v * v, 0);
  const stat = (png) => {
    let rowsB = [], mixed = 0, total = 0;
    for (let y = 0; y < png.height; y += 4) {
      let nb = 0, nn = 0;
      for (let x = 0; x < png.width; x += 8) {
        const c = at(png, x, y);
        if (dist(c, B) <= 24) nb++;
        const tproj = c.reduce((s, v, i) => s + (v - A[i]) * AB[i], 0) / ab2;
        const perp = dist(c, A.map((v, i) => v + tproj * AB[i]));
        if (tproj > 0.12 && tproj < 0.88 && perp < 12) mixed++;
        nn++; total++;
      }
      rowsB.push(nb / nn > 0.5);
    }
    const k = rowsB.filter(Boolean).length;
    const bottom = rowsB.slice(rowsB.length - k);
    return { cov: k / rowsB.length, bottomUp: bottom.filter((x) => !x).length <= 3, mixed: mixed / total };
  };
  const list = [];
  const t0 = P.curtain.from, t1 = P.curtain.to;
  const base = [stat(dec(await m.shot(Math.max(0, t0 - 0.05)))).mixed, stat(dec(await m.shot(Math.min(task.duration - 1e-6, t1)))).mixed];
  for (let t = t0; t <= t1 + 1e-9; t += 1 / fps) {
    const s = stat(dec(await m.shot(t)));
    list.push({ t: Math.round(t * 1000) / 1000, ...s, mixed: Math.max(0, s.mixed - Math.max(...base)) });
  }
  px.curtain = list;
}
if (P.mask) {
  const S = hexc(P.mask.surface);
  const boxes = P.mask.lines.map((r) => frames[frames.length - 1].roles[r]).filter(Boolean).map((b) => [b.x - 12, b.y - 8, b.x + b.w + 12, b.y + b.h + 0.3 * b.h]);
  const list = [];
  for (let t = P.mask.from; t <= P.mask.to + 1e-9; t += 1 / fps) {
    const png = dec(await m.shot(t));
    let outside = 0;
    for (let y = 0; y < png.height; y += 2)
      for (let x = 0; x < png.width; x += 2) {
        if (dist(at(png, x, y), S) <= 60) continue;
        if (!boxes.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) outside += 4;
      }
    list.push({ t, outside });
  }
  px.mask = list;
}
if (P.surface) {
  const C = hexc(P.surface.colour);
  px.surface = [];
  for (const t of P.surface.t) {
    const png = dec(await m.shot(t));
    for (const [x, y] of P.surface.points) { const c = at(png, x, y); px.surface.push({ t, ok: dist(c, C) <= 6, got: "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") }); }
  }
}
if (P.coral_mark) {
  const b = frames[frames.length - 1].roles[P.coral_mark.role];
  if (b) {
    const png = dec(await m.shot(task.duration - 1e-6));
    let hit = 0, all = 0;
    for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(1080, b.y + b.h); y += 2)
      for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(1920, b.x + b.w); x += 2) { all++; if (dist(at(png, x, y), hexc("#D44027")) <= 12) hit++; }
    px.coral_mark = all ? hit / all : 0;
  }
}

if (P.beats) {
  // Something on screen moves at every beat: pixels change across ±3 frames around it.
  px.beats = [];
  const period = 60 / P.beats.bpm;
  for (let tb = period; tb < task.duration - period / 2; tb += period) {
    const a = shrink(dec(await m.shot(Math.max(0, tb - 3 / fps))), 0.5), b = shrink(dec(await m.shot(Math.min(task.duration - 1e-6, tb + 3 / fps))), 0.5);
    let ch = 0;
    for (let k = 0; k < a.data.length; k += 4) if (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]) > 24) ch++;
    px.beats.push({ t: Math.round(tb * 1000) / 1000, changed: ch / (a.data.length / 4), moving: ch / (a.data.length / 4) > 0.0001 });
  }
}
if (P.loop) {
  const a = shrink(dec(await m.shot(0)), 0.5), b = shrink(dec(await m.shot(task.duration - 1e-6)), 0.5);
  let ch = 0;
  for (let k = 0; k < a.data.length; k += 4) if (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]) > 24) ch++;
  px.loop = ch / (a.data.length / 4);
}

// 4. Determinism: the same times seeked in order, out of order, and straight after a fresh load.
const dts = Array.from({ length: 8 }, (_, i) => Math.round(((i + 0.5) * task.duration * 1000) / 8) / 1000);
const small = async (mm, t) => shrink(dec(await mm.shot(t)), 0.5); // 2×2 averages
const inOrder = [];
for (const t of dts) inOrder.push(await small(m, t));
const order = [5, 2, 7, 0, 3, 6, 1, 4];
let worst = 0;
// Share of pixels (at half size) with no close match within one half-size pixel in the other frame.
// The browser rasters text and rescaled images a little differently depending on whether an element sits
// on its own compositor layer, which depends on seek history; a moved, missing or recoloured thing still shows.
const diff = (a, b) => {
  const W = a.width, H = a.height, d = (i, j) => Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]);
  let n = 0;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (d(i, i) <= 60) continue;
      let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) if (d(i, ((y + dy) * W + x + dx) * 4) <= 60) ok = true;
      if (!ok) n++;
    }
  return n / (W * H);
};
for (const k of order) worst = Math.max(worst, diff(inOrder[k], await small(m, dts[k])));
// The measured roles must match too, to the hundredth of a pixel (the browser's raster cache can blur a
// rescaled image slightly between passes; the roles cannot drift).
const roleDrift = [];
const same = (a, b) => JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort()) &&
  Object.keys(a).every((k) => ["x", "y", "w", "h", "o", "rot"].every((q) => Math.abs(a[k][q] - b[k][q]) <= 0.02) && a[k].text === b[k].text);
for (const k of order) {
  const i = Math.round(dts[k] * fps);
  const again = await m.roles(Math.min(i / fps, task.duration - 1e-6));
  if (!same(frames[i].roles, again)) roleDrift.push(dts[k]);
}
const shotBufs = [];
for (const t of task.shots || [0, task.duration / 2, task.duration - 1e-6]) shotBufs.push(await m.shot(Math.min(t, task.duration - 1e-6)));
// Appeal, on the pieces with creative room (the long briefs and the free piece), over the whole timeline.
const app = task.track === "long" || task.track === "free" ? appeal.analyse(await appeal.capture(m, m.duration, (b) => PNG.sync.read(b))) : null;
const duration = m.duration, log = m.log;
await m.close();
for (const k of [6, 1]) {
  const fresh = await open(ws);
  if (!fresh.error) {
    worst = Math.max(worst, diff(inOrder[k], await small(fresh, dts[k])));
    const i = Math.round(dts[k] * fps);
    if (!same(frames[i].roles, await fresh.roles(Math.min(i / fps, task.duration - 1e-6)))) roleDrift.push(dts[k] + " (fresh load)");
    await fresh.close();
  }
}
fs.writeFileSync(path.join(out, "sheet.png"), sheet(shotBufs, { cols: Math.min(4, shotBufs.length) }));

const ctx = { frames, scans, fps, duration, log, static: staticInfo, assets, pixels: px, coralOwners, determinism: { ok: worst <= 0.005 && !roleDrift.length, worst: { pixels: worst, roles: roleDrift.slice(0, 3) } } };
const checks = run(ctx, task);
const loadedFonts = [...new Set(scans.flatMap((s) => s.loaded))];
const pol = analyse({ info: autoInfo, frames: autoFrames, fps: fps / 2, glyphs, blank, loaded: loadedFonts, task });
for (const c of pol.checks) checks.push(c);
// The score and its parts count the task's own checks; polish and taste are reported beside it.
const share = (k) => { const c = checks.filter((x) => (k ? x.kind === k : x.kind === "contract" || x.kind === "craft")); return c.length ? c.filter((x) => x.pass).length / c.length : 0; };
const result = {
  task: task.id, track: task.track, score: share(), contract: share("contract"), craft: share("craft"),
  polish: pol.polish, taste: pol.taste, motion_counts: pol.counts,
  appeal: app ? app.appeal : null, appeal_parts: app ? app.parts : null, appeal_measured: app ? app.measured : null,
  passed: checks.filter((c) => c.pass && (c.kind === "contract" || c.kind === "craft")).length, total: checks.filter((c) => c.kind === "contract" || c.kind === "craft").length,
  checks, seconds: (Date.now() - started) / 1000,
};
fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(out, "measure.json"), JSON.stringify({ frames, scans, pixels: px }));
console.log(`${task.id}: ${result.score.toFixed(3)} (${result.passed}/${result.total}; craft ${result.craft.toFixed(2)}, contract ${result.contract.toFixed(2)}; polish ${pol.polish.toFixed(2)}, taste ${pol.taste == null ? "n/a" : pol.taste.toFixed(2)}${app ? `, appeal ${app.appeal.toFixed(2)}` : ""})`);
if (process.argv.includes("--verbose")) for (const c of checks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.id}  got=${JSON.stringify(c.got)}`);
