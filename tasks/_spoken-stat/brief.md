# Land a qualified statistic on narration

Make a six-second statistic insert for a narrated technical video. The supplied
cue sheet is synthetic ground truth; no audio file, transcription or factual
research is required.

| Time | Narration |
|---|---|
| 0.50 s | "In this test run, we handled..." |
| 2.50 s | "...one thousand two hundred eighty-four requests." |
| 5.50 s | End of the statistic's reading window. |

Show a hero counter (`data-role="value"`) starting at zero. Begin counting at
0.50 s, make a fast start and slow finish, and first display **1,284** exactly
at the 2.50 s cue. Keep the number whole, use thousands separators and tabular
JetBrains Mono digits, and make it at least 120 px tall.

Two separate text elements qualify the number:

- `data-role="qualifier"`: **requests in the test run**, at least 40 px tall.
- `data-role="source"`: **Source: synthetic fixture**, at least 32 px tall.

From 2.50 s through 5.50 s, keep the final number and both text elements fully
opaque, fully unclipped and inside title-safe, with no overlapping boxes. Keep
the exact wording. The qualifier restricts the claim; the source is part of the
insert, not an optional credit. Hold the counter's final value to the end.

Use the supplied brand and deterministic timeline contract. Choose the entrance
and exit motion. The insert should read clearly alongside narration.
