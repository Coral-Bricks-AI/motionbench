// node tools/snap.mjs [--at 0,0.5,1 | --every 0.25] [--out snaps] [--sheet]
// Saves full-size PNG frames (snaps/t-<time>.png); --sheet also writes snaps/sheet.png, all frames on one image.
import fs from "node:fs";
import { open, times, sheet } from "./lib.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const dir = arg("--out") || "snaps";
const m = await open(".");
if (m.error) { console.log("ERROR:", m.error); process.exit(1); }
const ts = arg("--every") ? times("every:" + arg("--every"), m.duration) : times(arg("--at"), m.duration);
fs.mkdirSync(dir, { recursive: true });
const bufs = [];
for (const t of ts) {
  const b = await m.shot(t);
  bufs.push(b);
  fs.writeFileSync(`${dir}/t-${t.toFixed(3)}.png`, b);
}
if (process.argv.includes("--sheet")) fs.writeFileSync(`${dir}/sheet.png`, sheet(bufs, { cols: Math.min(4, bufs.length) }));
await m.close();
console.log(`wrote ${ts.length} frame(s) to ${dir}/` + (process.argv.includes("--sheet") ? " and sheet.png" : ""));
