"""Summarise results/: python3 report.py [--json results/summary.json] [--start N]

Per model: mean score over every check, craft (the motion itself) and contract (format, determinism, brand)
separately, tasks passed outright, and per-task scores averaged over attempts. Attempts below --start are
smoke tests and are left out.
"""
import argparse, glob, json, os, statistics as st

ROOT = os.path.dirname(os.path.abspath(__file__))
ORDER = ["opus", "gpt-sol", "grok", "sonnet", "glm", "deepseek", "haiku", "deepseek-plain"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json")
    ap.add_argument("--start", type=int, default=1)
    a = ap.parse_args()
    runs = {}
    for f in glob.glob(os.path.join(ROOT, "results", "*", "*", "a*", "result.json")):
        model, task, att = f.split(os.sep)[-4:-1]
        if int(att[1:]) < a.start:
            continue
        r = json.load(open(f))
        info = json.load(open(os.path.join(os.path.dirname(f), "run.json"))) if os.path.exists(os.path.join(os.path.dirname(f), "run.json")) else {}
        runs.setdefault(model, {}).setdefault(task, []).append((r, info))
    models = [m for m in ORDER if m in runs] + sorted(m for m in runs if m not in ORDER)
    tasks = sorted({t for m in runs.values() for t in m})
    summary = {"models": {}, "tasks": tasks}
    for m in models:
        rs = [r for t in runs[m].values() for r, _ in t]
        infos = [i for t in runs[m].values() for _, i in t]
        per_task = {t: round(st.mean(r["score"] for r, _ in runs[m][t]), 3) for t in runs[m]}
        principles = {}
        for r in rs:
            for c in r.get("checks", []):
                if c["kind"] == "craft":
                    principles.setdefault(c.get("principle") or "?", []).append(c["pass"])
        contract_fails = {}
        for r in rs:
            for c in r.get("checks", []):
                if c["kind"] == "contract" and not c["pass"]:
                    contract_fails[c["id"]] = contract_fails.get(c["id"], 0) + 1
        summary["models"][m] = {
            "runs": len(rs),
            "score": round(st.mean(r["score"] for r in rs), 3),
            "craft": round(st.mean(r["craft"] for r in rs), 3),
            "contract": round(st.mean(r["contract"] for r in rs), 3),
            "perfect": sum(1 for r in rs if r["score"] == 1),
            "no_output": sum(1 for r in rs if r.get("error")),
            "by_track": {tr: round(st.mean(r["score"] for r in rs if r.get("track") == tr or r["task"].startswith(tr[0] + "-")), 3) for tr in ("principles", "studio")},
            "per_task": per_task,
            "principles": {k: round(sum(v) / len(v), 3) for k, v in sorted(principles.items())},
            "contract_failures": dict(sorted(contract_fails.items(), key=lambda x: -x[1])),
            "median_minutes": round(st.median(i.get("wall_s", 0) for i in infos) / 60, 1) if infos else None,
            "median_turns": st.median(i.get("num_turns") or 0 for i in infos) if infos else None,
            # Claude Code prices every model at Claude list prices; only meaningful for the Claude models.
            "cc_cost_usd": round(sum(i.get("total_cost_usd") or 0 for i in infos), 2),
            "tokens_in_M": round(sum(((i.get("usage") or {}).get(k) or 0) for i in infos for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")) / 1e6, 1),
            "tokens_out_k": round(sum(((i.get("usage") or {}).get("output_tokens") or 0) for i in infos) / 1e3),
            "timed_out": sum(1 for i in infos if i.get("timed_out")),
        }
    w = 20
    print(f"{'':{w}}" + "".join(f"{m:>16}" for m in models))
    for k in ("runs", "score", "craft", "contract", "perfect", "no_output", "median_minutes", "median_turns", "tokens_in_M", "tokens_out_k", "cc_cost_usd", "timed_out"):
        print(f"{k:{w}}" + "".join(f"{summary['models'][m][k]!s:>16}" for m in models))
    print()
    for t in tasks:
        print(f"{t:{w}}" + "".join(f"{summary['models'][m]['per_task'].get(t, '-')!s:>16}" for m in models))
    print()
    for m in models:
        f = summary["models"][m]["contract_failures"]
        if f:
            print(f"{m} contract failures: " + "; ".join(f"{k} ×{v}" for k, v in f.items()))
    if a.json:
        json.dump(summary, open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
