"""Grade the oracle and naive solutions: python3 selftest/run.py [oracle|naive] [task ...]
The oracle must score 1.0 on every task; each naive one must lose craft checks but keep the contract."""
import json, os, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
from workspace import make_workspace

kinds = [a for a in sys.argv[1:] if a in ("oracle", "naive")] or ["oracle", "naive"]
only = [a for a in sys.argv[1:] if a not in ("oracle", "naive")]
def one(kind, tid):
    ws = make_workspace(tid, tempfile.mkdtemp(prefix=f"mb-{kind}-{tid}-"))
    shutil.copy(os.path.join(HERE, kind, tid, "index.html"), os.path.join(ws, "index.html"))
    out = os.path.join(HERE, "out", kind, tid)
    p = subprocess.run(["node", os.path.join(ROOT, "grader", "grade.mjs"), ws, os.path.join(ROOT, "tasks", tid), "--out", out], capture_output=True, text=True)
    shutil.rmtree(ws, ignore_errors=True)
    if p.returncode: return kind, tid, None, p.stderr[-800:]
    return kind, tid, json.load(open(os.path.join(out, "result.json"))), None
jobs = [(k, t) for k in kinds for t in sorted(os.listdir(os.path.join(HERE, k))) if not only or t in only]
with ThreadPoolExecutor(6) as ex:
    for kind, tid, r, err in ex.map(lambda a: one(*a), jobs):
        if err: print(f"{kind:6} {tid:20} CRASH {err}"); continue
        bad = [c for c in r["checks"] if not c["pass"]]
        print(f"{kind:6} {tid:20} {r['score']:.3f}  craft {r['craft']:.2f}  contract {r['contract']:.2f}  ({r['seconds']:.0f}s)")
        for c in bad: print(f"        ✗ [{c['kind']}] {c['id']}  got={json.dumps(c['got'])[:160]}")
