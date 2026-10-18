// node tools/probe.mjs [--at 0,0.5,1 | --every 0.1] [--roles a,b] [--json]
// Prints what is measured for every data-role element at the given times, plus page errors,
// blocked network requests, the timeline's duration, and the colours, effects and fonts on screen.
import { open, times } from "./lib.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const json = process.argv.includes("--json");
const m = await open(".");
if (m.error) { console.log("ERROR:", m.error); console.log(m.log); process.exit(1); }
const ts = arg("--every") ? times("every:" + arg("--every"), m.duration) : times(arg("--at"), m.duration);
const only = arg("--roles") ? arg("--roles").split(",") : null;
const out = { duration: m.duration, frames: [] };
for (const t of ts) {
  const r = await m.roles(t);
  if (only) for (const k of Object.keys(r)) if (!only.includes(k)) delete r[k];
  out.frames.push({ t, roles: r });
}
out.scan = await m.scan(ts[ts.length - 1]);
out.errors = m.log.errors;
out.network = m.log.network;
await m.close();
if (json) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`duration ${out.duration}s  errors ${out.errors.length}  blocked requests ${out.network.length}`);
for (const e of out.errors) console.log("  error:", e);
for (const u of out.network) console.log("  blocked:", u);
for (const f of out.frames) {
  console.log(`t=${f.t}`);
  for (const [k, v] of Object.entries(f.roles)) {
    const text = v.text.trim() ? `  text=${JSON.stringify(v.text.length > 40 ? v.text.slice(0, 18) + "…" + v.text.slice(-18) : v.text)} (${v.text.length})` : "";
    console.log(`  ${k.padEnd(12)} x=${v.x} y=${v.y} w=${v.w} h=${v.h} o=${v.o} rot=${v.rot}${text}${v.dup ? `  WARNING: ${v.dup} elements share this role` : ""}`);
  }
}
console.log(`at t=${ts[ts.length - 1]}: colours`, Object.keys(out.scan.colors).join(" "));
console.log("  fonts in use:", Object.keys(out.scan.fonts).join(" | "), " loaded:", out.scan.loaded.join(", "));
if (out.scan.effects.length) console.log("  effects:", out.scan.effects.map((e) => e.join(" ")).join(" | "));
