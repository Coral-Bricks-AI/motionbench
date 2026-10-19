import test from 'node:test';
import assert from 'node:assert/strict';
import { narratedStat } from '../grader/narration.mjs';
import fs from 'node:fs';

const task = JSON.parse(fs.readFileSync(new URL('../tasks/_spoken-stat/task.json', import.meta.url)));
const params = task.checks.find((c) => c.type === 'narrated_stat');
const role = (text, y, h = 50) => ({text, x: 400, y, w: 900, h, o: 1, vw: 900, vh: h, textFits: true, textBounds: [400, y, 900, h]});
function fixture(fps = 60) {
  return {fps, frames: Array.from({length: 6 * fps + 1}, (_, i) => ({t: Math.round(i / fps * 10000) / 10000, roles: {
    value: role(i / fps < 2.5 ? '1,283' : '1,284', 250, 220),
    qualifier: role('requests in the test run', 520),
    source: role('Source: synthetic fixture', 620, 40),
  }}))};
}
const grade = (ctx) => narratedStat(ctx, params);
const check = (ctx, text) => grade(ctx).find((c) => c.id.includes(text));
test('reference passes every narration check at 30 and 60 fps', () => {
  for (const fps of [30, 60]) assert.equal(grade(fixture(fps)).every((c) => c.pass), true);
});
for (const [name, mutate, id] of [
  ['early landing', (c) => c.frames.forEach((f) => {if (f.t >= 2.4) f.roles.value.text = '1,284';}), 'spoken cue'],
  ['late landing', (c) => c.frames.forEach((f) => {if (f.t < 2.6) f.roles.value.text = '1,283';}), 'spoken cue'],
  ['wrong final value', (c) => c.frames.forEach((f) => {f.roles.value.text = '1,285';}), 'spoken cue'],
  ['hidden target before cue', (c) => {c.frames[0].roles.value.text = '1,284'; c.frames[0].roles.value.o = 0;}, null],
  ['one-frame hidden value', (c) => {c.frames[180].roles.value.o = 0;}, 'final value stays'],
  ['target regresses after landing', (c) => {c.frames[151].roles.value.text = '0';}, 'final value stays'],
  ['one-frame missing qualifier', (c) => {delete c.frames[180].roles.qualifier;}, 'qualifier stays'],
  ['changed qualifier', (c) => {c.frames[180].roles.qualifier.text = 'requests per second';}, 'qualifier stays'],
  ['missing source', (c) => c.frames.forEach((f) => {delete f.roles.source;}), 'source stays'],
  ['clipped source', (c) => {c.frames[180].roles.source.vw = 0;}, 'source stays'],
  ['partly clipped source', (c) => {c.frames[180].roles.source.vh = 20;}, 'source stays'],
  ['source overflows its own box', (c) => {c.frames[180].roles.source.textFits = false;}, 'source stays'],
  ['undersized source', (c) => {c.frames[180].roles.source.h = 20;}, 'source stays'],
  ['unsafe source', (c) => {c.frames[180].roles.source.x = 50;}, 'source stays'],
  ['visible text spills outside safe frame', (c) => {c.frames[180].roles.source.textBounds = [1700, 620, 500, 40];}, 'source stays'],
  ['visible text overlaps another role', (c) => {c.frames[180].roles.source.textBounds = [400, 520, 900, 40];}, 'never overlap'],
  ['translucent source', (c) => {c.frames[180].roles.source.o = 0.5;}, 'source stays'],
  ['overlapping text', (c) => {c.frames[180].roles.source.y = 520;}, 'never overlap'],
  ['empty measurement', (c) => {c.frames = [];}, 'final value stays'],
  ['truncated hold', (c) => {c.frames = c.frames.filter((f) => f.t < 5);}, 'final value stays'],
  ['missing frame in hold', (c) => {c.frames.splice(180, 1);}, 'final value stays'],
  ['missing first hold frame', (c) => {c.frames.splice(150, 1);}, 'final value stays'],
  ['missing last hold frame', (c) => {c.frames.splice(330, 1);}, 'final value stays'],
]) {
  test(name, () => {
    const ctx = fixture(); mutate(ctx);
    if (id == null) assert.equal(grade(ctx).every((c) => c.pass), true);
    else assert.equal(check(ctx, id).pass, false);
  });
}
test('two-frame landing tolerance passes; three frames fails', () => {
  for (const [shift, expected] of [[-2, true], [-3, false], [2, true], [3, false]]) {
    const ctx = fixture();
    ctx.frames.forEach((f, i) => {f.roles.value.text = i >= 150 + shift ? '1,284' : '1,283';});
    assert.equal(check(ctx, 'spoken cue').pass, expected);
    if (expected) assert.equal(grade(ctx).every((c) => c.pass), true);
  }
});
