"""Re-grade saved runs from their index.html with the current checks: python3 regrade.py [task ...]
Any change to a check is applied to every run alike this way."""
import glob, json, os, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from workspace import make_workspace

only = sys.argv[1:]
def one(d):
    model, task, att = d.split(os.sep)[-3:]
    if only and task not in only: return None
    ws = make_workspace(task, tempfile.mkdtemp(prefix="mb-regrade-"))
    html = os.path.join(d, "index.html")
    if os.path.exists(html): shutil.copy(html, ws)
    subprocess.run(["node", os.path.join(ROOT, "grader", "grade.mjs"), ws, os.path.join(ROOT, "tasks", task), "--out", d], capture_output=True, text=True)
    shutil.rmtree(ws, ignore_errors=True)
    m = os.path.join(d, "measure.json")
    if os.path.exists(m): os.remove(m)
    r = json.load(open(os.path.join(d, "result.json")))
    return f"{model:14} {task:20} {att}  {r['score']:.3f}"
dirs = sorted(d for d in glob.glob(os.path.join(ROOT, "results", "*", "*", "a*")) if os.path.exists(os.path.join(d, "run.json")))
with ThreadPoolExecutor(6) as ex:
    for line in ex.map(one, dirs):
        if line: print(line, flush=True)
