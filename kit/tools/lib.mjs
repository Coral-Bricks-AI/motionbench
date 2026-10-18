// What motionbench measures in a composition. The agent's probe and snap tools and the grader
// all use this file, so a model sees exactly what is graded (but not the pass marks).
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

export const W = 1920, H = 1080;

// Runs inside the page. Everything here reads the DOM after a seek; nothing writes to it.
const PAGE = () => {
  const cache = new Map();
  const effOpacity = (el) => {
    if (!el || el.nodeType !== 1) return 1;
    if (cache.has(el)) return cache.get(el);
    const cs = getComputedStyle(el);
    const o = cs.display === "none" ? 0 : parseFloat(cs.opacity) * effOpacity(el.parentElement);
    cache.set(el, o);
    return o;
  };
  const shown = (el) => effOpacity(el) * (getComputedStyle(el).visibility === "hidden" ? 0 : 1);
  // The part of an element's box left after clipping by the frame and by every overflow-clipping ancestor that
  // contains it (CSS: an absolutely positioned box escapes an overflow ancestor that is not, or does not
  // contain, its containing block). Returns the visible width and height.
  const onScreen = (el) => {
    const b = el.getBoundingClientRect();
    let L = Math.max(b.left, 0), T = Math.max(b.top, 0), R = Math.min(b.right, innerWidth), B = Math.min(b.bottom, innerHeight);
    const pos = (cs) => (cs.position === "absolute" ? "abs" : cs.position === "fixed" ? "fixed" : "flow");
    let mode = pos(getComputedStyle(el));
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p), tf = cs.transform !== "none";
      if (!(mode === "flow" || (mode === "abs" && (cs.position !== "static" || tf)) || (mode === "fixed" && tf))) continue;
      const c = p.getBoundingClientRect();
      if (cs.overflowX !== "visible") { L = Math.max(L, c.left); R = Math.min(R, c.right); }
      if (cs.overflowY !== "visible") { T = Math.max(T, c.top); B = Math.min(B, c.bottom); }
      mode = pos(cs);
    }
    return [Math.max(0, R - L), Math.max(0, B - T)];
  };
  const rotation = (el) => {
    if (el instanceof SVGGraphicsElement) {
      const m = el.getScreenCTM();
      return m ? (Math.atan2(m.b, m.a) * 180) / Math.PI : 0;
    }
    let m = new DOMMatrix();
    const chain = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.unshift(e);
    for (const e of chain) {
      const t = getComputedStyle(e).transform;
      if (t && t !== "none") m = m.multiply(new DOMMatrix(t));
    }
    return (Math.atan2(m.b, m.a) * 180) / Math.PI;
  };
  const visibleText = (el) => {
    let s = "", last = null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const p = n.parentElement;
      if (!p || shown(p) < 0.5) continue;
      s += n.data;
      if (n.data.trim()) last = n;
    }
    let end = null;
    if (last) {
      const i = last.data.trimEnd().length;
      const r = document.createRange();
      r.setStart(last, i - 1);
      r.setEnd(last, i);
      const b = r.getBoundingClientRect();
      end = [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 100) / 100);
    }
    return { text: s, end };
  };
  const round = (v) => Math.round(v * 100) / 100;
  window.__mb = {
    seek(t) {
      const tl = window.__timelines && window.__timelines.main;
      tl.pause();
      try {
        tl.seek(t, false);
      } catch (e) {
        // The composition's own code threw while drawing this frame: keep measuring, report it as a page error.
        (window.__mbErrors = window.__mbErrors || []).push(`at ${t}s: ${String(e).slice(0, 200)}`);
      }
    },
    roles() {
      cache.clear();
      const out = {};
      for (const el of document.querySelectorAll("[data-role]")) {
        const name = el.getAttribute("data-role");
        if (out[name]) { out[name].dup = (out[name].dup || 1) + 1; continue; }
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const vt = visibleText(el);
        const [vw, vh] = onScreen(el);
        out[name] = {
          x: round(b.left), y: round(b.top), w: round(b.width), h: round(b.height),
          o: round(shown(el) * 1000) / 1000, rot: round(rotation(el)), vw: round(vw), vh: round(vh),
          text: vt.text, end: vt.end,
          color: cs.color, bg: cs.backgroundColor, fill: cs.fill, stroke: cs.stroke,
          font: cs.fontFamily, weight: cs.fontWeight,
        };
      }
      return out;
    },
    // Every painted colour and every effect on the page at this moment.
    scan() {
      cache.clear();
      const colors = {}, effects = [], fonts = {};
      const add = (c, why) => {
        if (!c || /rgba\([^)]*,\s*0\)$/.test(c) || c === "transparent") return;
        colors[c] = colors[c] || [];
        if (colors[c].length < 8 && !colors[c].includes(why)) colors[c].push(why);
      };
      for (const el of document.querySelectorAll("body *")) {
        if (["SCRIPT", "STYLE", "TEMPLATE", "DEFS", "defs"].includes(el.tagName)) continue;
        if (shown(el) <= 0.01) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        const owner = el.closest("[data-role]");
        const tag = el.tagName.toLowerCase() + (owner ? `@${owner.getAttribute("data-role")}` : "");
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
        if (hasText) { add(cs.color, `text ${tag}`); fonts[cs.fontFamily + " " + cs.fontWeight] = tag; }
        add(cs.backgroundColor, `background ${tag}`);
        for (const side of ["Top", "Right", "Bottom", "Left"])
          if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== "none") add(cs[`border${side}Color`], `border ${tag}`);
        if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none") add(cs.outlineColor, `outline ${tag}`);
        if (el instanceof SVGElement && !(el instanceof SVGSVGElement) && el instanceof SVGGraphicsElement) {
          if (cs.fill && cs.fill !== "none" && !cs.fill.startsWith("url")) add(cs.fill, `fill ${tag}`);
          if (cs.stroke && cs.stroke !== "none" && !cs.stroke.startsWith("url")) add(cs.stroke, `stroke ${tag}`);
        }
        if (cs.boxShadow !== "none") effects.push(["box-shadow", cs.boxShadow, tag]);
        if (cs.textShadow !== "none") effects.push(["text-shadow", cs.textShadow, tag]);
        if (cs.filter !== "none") effects.push(["filter", cs.filter, tag]);
        if (cs.backdropFilter && cs.backdropFilter !== "none") effects.push(["backdrop-filter", cs.backdropFilter, tag]);
        if (cs.backgroundImage !== "none") effects.push(["background-image", cs.backgroundImage.slice(0, 200), tag]);
        if (cs.mixBlendMode !== "normal") effects.push(["mix-blend-mode", cs.mixBlendMode, tag]);
        if (cs.animationName !== "none") effects.push(["css-animation", cs.animationName, tag]);
        if (cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0)) effects.push(["css-transition", cs.transitionDuration, tag]);
      }
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, ""));
      return { colors, effects, fonts, loaded: [...new Set(loaded)] };
    },
    duration() {
      return window.__timelines.main.duration();
    },
    // Every element on the page, tagged or not, for the polish and taste checks: an id per element, its
    // parent's id and static facts (tag, own text, type settings), then compact per-frame boxes.
    autoInit(max = 700) {
      const els = [...document.querySelectorAll("body *")].filter((e) => !["SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "BR", "DEFS", "defs", "IFRAME"].includes(e.tagName));
      window.__mbAuto = els.slice(0, max);
      const idx = new Map(window.__mbAuto.map((e, i) => [e, i]));
      return window.__mbAuto.map((e) => {
        const cs = getComputedStyle(e);
        const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join("").trim();
        let p = e.parentElement; while (p && !idx.has(p)) p = p.parentElement;
        return { tag: e.tagName.toLowerCase(), parent: p ? idx.get(p) : -1, role: e.getAttribute("data-role") || null, svg: e instanceof SVGElement, text: own.slice(0, 200) };
      });
    },
    auto() {
      cache.clear();
      const out = [];
      window.__mbAuto.forEach((e, i) => {
        const b = e.getBoundingClientRect();
        const eo = shown(e);
        if (eo <= 0.01 && !(b.width || b.height)) return;
        const cs = getComputedStyle(e);
        const own = e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) ? [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join("").trim().slice(0, 120) : "";
        out.push([i, round(b.left), round(b.top), round(b.width), round(b.height), Math.round(eo * 1000) / 1000, own,
          own ? [parseFloat(cs.fontSize), cs.letterSpacing, cs.textTransform, cs.fontVariantNumeric, cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), e.scrollWidth > e.clientWidth + 1 && cs.overflow !== "visible" ? 1 : 0,
            [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join("").trim().length] : null]);
      });
      return out;
    },
    // Characters a visible text is set in that its first font cannot draw (the browser falls back, a
    // render machine may draw a box). A glyph is covered when its width does not change with the fallback.
    // Each text is measured in its own style and weight, after that face has loaded: a canvas does not wait
    // for a face it has not used yet, and would measure the fallback.
    async glyphs() {
      cache.clear();
      const c = document.createElement("canvas").getContext("2d"), missing = {}, texts = [];
      for (const e of document.querySelectorAll("body *")) {
        const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join("");
        if (!own.trim() || shown(e) < 0.5) continue;
        const cs = getComputedStyle(e), fam = cs.fontFamily.split(",")[0].trim();
        texts.push({ fam, face: `${cs.fontStyle} ${cs.fontWeight} 40px`, chars: [...new Set(own.replace(/\s/g, ""))] });
      }
      await Promise.all([...new Set(texts.map((x) => `${x.face} ${x.fam}`))].map((f) => document.fonts.load(f).catch(() => 0)));
      for (const { fam, face, chars } of texts) {
        const name = fam.replace(/["']/g, "");
        const w = (f, ch) => { c.font = `${face} ${f}`; return c.measureText(ch).width; };
        for (const ch of chars) {
          // Covered when the font changes the width against a bare fallback, under either fallback.
          const covered = Math.abs(w(`${fam}, monospace`, ch) - w("monospace", ch)) > 0.01 || Math.abs(w(`${fam}, serif`, ch) - w("serif", ch)) > 0.01;
          if (!covered) (missing[name] = missing[name] || new Set()).add(ch);
        }
      }
      return Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, [...v].join("")]));
    },
  };
};

export async function open(dir, { headless = true } = {}) {
  const root = path.resolve(dir);
  // Grayscale text antialiasing and sRGB everywhere: Chrome switches LCD antialiasing on and off with
  // compositor layers, which would make the same frame differ by seek history.
  const browser = await chromium.launch({ headless, args: ["--disable-lcd-text", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const log = { errors: [], network: [] };
  page.on("console", (m) => { if (m.type() === "error") log.errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => log.errors.push(String(e).slice(0, 300)));
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    if (u.startsWith("file://") && decodeURIComponent(new URL(u).pathname).startsWith(root + "/")) return r.continue();
    log.network.push(u.slice(0, 200));
    return r.abort();
  });
  const index = path.join(root, "index.html");
  if (!fs.existsSync(index)) { await browser.close(); return { error: "no index.html", log }; }
  try {
    await page.goto("file://" + index, { waitUntil: "load", timeout: 20000 });
    await page.evaluate(() => document.fonts.ready.then(() => 0));
    await page.waitForFunction(() => window.__timelines && window.__timelines.main && typeof window.__timelines.main.seek === "function", null, { timeout: 5000 });
  } catch (e) {
    await browser.close();
    return { error: "window.__timelines.main was not registered: " + String(e.message || e).split("\n")[0], log };
  }
  await page.evaluate(PAGE);
  const duration = await page.evaluate(() => window.__mb.duration());
  return {
    page, log, duration,
    async seek(t) { await page.evaluate((t) => window.__mb.seek(t), t); },
    async roles(t) { return page.evaluate((t) => { window.__mb.seek(t); return window.__mb.roles(); }, t); },
    async scan(t) { return page.evaluate((t) => { window.__mb.seek(t); return window.__mb.scan(); }, t); },
    async autoInit() { return page.evaluate(() => window.__mb.autoInit()); },
    async auto(t) { return page.evaluate((t) => { window.__mb.seek(t); return window.__mb.auto(); }, t); },
    async glyphs(t) { return page.evaluate((t) => { window.__mb.seek(t); return window.__mb.glyphs(); }, t); },
    async shot(t, { scale = 1 } = {}) {
      await page.evaluate((t) => window.__mb.seek(t), t);
      const buf = await page.screenshot({ type: "png" });
      return scale === 1 ? buf : PNG.sync.write(shrink(PNG.sync.read(buf), scale));
    },
    async close() {
      try { for (const e of (await page.evaluate(() => window.__mbErrors || [])).slice(0, 5)) log.errors.push(e); } catch {}
      await browser.close();
    },
  };
}

export function shrink(png, scale) {
  const f = Math.round(1 / scale);
  const out = new PNG({ width: Math.floor(png.width / f), height: Math.floor(png.height / f) });
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const acc = [0, 0, 0, 0];
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const i = ((y * f + dy) * png.width + (x * f + dx)) * 4;
          for (let c = 0; c < 4; c++) acc[c] += png.data[i + c];
        }
      const o = (y * out.width + x) * 4;
      for (let c = 0; c < 4; c++) out.data[o + c] = Math.round(acc[c] / (f * f));
    }
  return out;
}

// Contact sheet: frames side by side, `cols` per row, each shrunk by `scale`.
export function sheet(buffers, { cols = 4, scale = 0.25 } = {}) {
  const tiles = buffers.map((b) => shrink(PNG.sync.read(b), scale));
  const tw = tiles[0].width, th = tiles[0].height, gap = 4;
  const rows = Math.ceil(tiles.length / cols);
  const out = new PNG({ width: cols * tw + (cols + 1) * gap, height: rows * th + (rows + 1) * gap });
  out.data.fill(128);
  tiles.forEach((t, i) => {
    const ox = gap + (i % cols) * (tw + gap), oy = gap + Math.floor(i / cols) * (th + gap);
    for (let y = 0; y < th; y++) t.data.copy(out.data, ((oy + y) * out.width + ox) * 4, y * tw * 4, (y + 1) * tw * 4);
  });
  return PNG.sync.write(out);
}

export function times(spec, duration) {
  if (!spec) return [0, duration / 4, duration / 2, (3 * duration) / 4, duration];
  if (spec.startsWith("every:")) {
    const step = parseFloat(spec.slice(6)), out = [];
    for (let t = 0; t <= duration + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
    return out;
  }
  return spec.split(",").map(Number);
}
