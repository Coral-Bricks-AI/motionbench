"""A local pass-through to the CoralBricks gateway that turns Claude Code's reasoning request into one the
gateway honours.

    python3 thinking_proxy.py <port> [<budget>] [<upstream>]

For CoralBricks it also moves images out of tool_result blocks into the same user turn (the gateway
refuses them inside); with a fifth argument "plain" it leaves the thinking request alone.
With upstream https://api.x.ai it instead folds Claude Code's mid-conversation system-role messages into
the neighbouring user turn (xAI rejects that role). With another upstream it is a plain streaming forwarder.

Claude Code asks every model for `thinking: {"type": "adaptive"}` with `output_config.effort`. On the
CoralBricks Messages API (2026-10-18) DeepSeek V4.1 Flash ignores both and does not reason; it reasons
when asked with `thinking: {"type": "enabled", "budget_tokens": N}`. This proxy rewrites the first form
into the second and streams the reply back untouched. Headers (including the key) pass through; nothing
is logged except the count of rewritten requests.
"""
import http.server, json, sys, urllib.request

UPSTREAM = sys.argv[3] if len(sys.argv) > 3 else "https://inference.coralbricks.ai"
FLAGS = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else set()
PLAIN = "plain" in FLAGS      # leave Claude Code's thinking request as it is
NOIMAGE = "noimage" in FLAGS  # a text-only model: images become a note saying so
BUDGET = int(sys.argv[2]) if len(sys.argv) > 2 else 24576
rewritten = 0


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"  # the end of the reply is the end of the connection, so streams pass through

    def do_GET(self):
        self.forward(b"", "GET")

    def do_POST(self):
        global rewritten
        body = self.rfile.read(int(self.headers.get("content-length", 0)))
        try:
            d = json.loads(body)
            if "x.ai" in UPSTREAM:
                # xAI accepts only user/assistant turns; Claude Code also sends some instructions as a
                # system-role message mid-conversation. Fold each into the neighbouring user turn, keeping it.
                msgs = []
                for m in d.get("messages", []):
                    if m.get("role") == "system":
                        blocks = m["content"] if isinstance(m["content"], list) else [{"type": "text", "text": m["content"]}]
                        if msgs and msgs[-1]["role"] == "user":
                            prev = msgs[-1]
                            prev["content"] = (prev["content"] if isinstance(prev["content"], list) else [{"type": "text", "text": prev["content"]}]) + blocks
                        else:
                            msgs.append({"role": "user", "content": blocks})
                    elif m.get("role") == "user" and msgs and msgs[-1]["role"] == "user" and msgs[-1].get("_folded"):
                        msgs[-1]["content"] += m["content"] if isinstance(m["content"], list) else [{"type": "text", "text": m["content"]}]
                    else:
                        msgs.append(m)
                d["messages"] = [{k: v for k, v in m.items() if k != "_folded"} for m in msgs]
                body = json.dumps(d).encode()
            else:
                # The CoralBricks Messages API (2026-10-18) refuses images inside a tool_result ("text blocks
                # only"); it takes the same image as a block right after it in the same user turn.
                for m in d.get("messages", []):
                    if m.get("role") != "user" or not isinstance(m.get("content"), list):
                        continue
                    out, moved = [], []
                    for b in m["content"]:
                        if b.get("type") == "tool_result" and isinstance(b.get("content"), list) and any(c.get("type") == "image" for c in b["content"]):
                            imgs = [c for c in b["content"] if c.get("type") == "image"]
                            rest = [c for c in b["content"] if c.get("type") != "image"]
                            rest.append({"type": "text", "text": f"[{len(imgs)} image(s) from this result attached below]"})
                            out.append({**b, "content": rest})
                            moved += imgs
                        else:
                            out.append(b)
                    if NOIMAGE:
                        out = [{"type": "text", "text": "[an image was here; this model cannot see images, so it was left out]"} if b.get("type") == "image" else b for b in out]
                        moved = [{"type": "text", "text": "[an image was here; this model cannot see images, so it was left out]"} for _ in moved]
                    m["content"] = out + moved
                body = json.dumps(d).encode()
            if "x.ai" not in UPSTREAM and not PLAIN and isinstance(d.get("thinking"), dict) and d["thinking"].get("type") == "adaptive":
                d["thinking"] = {"type": "enabled", "budget_tokens": min(BUDGET, max(1024, int(d.get("max_tokens", 32000)) - 2048))}
                body = json.dumps(d).encode()
                rewritten += 1
        except ValueError:
            pass
        self.forward(body, "POST")

    def forward(self, body, method):
        hdr = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "content-length", "accept-encoding", "connection")}
        req = urllib.request.Request(UPSTREAM + self.path, data=body if method == "POST" else None, headers=hdr, method=method)
        try:
            r = urllib.request.urlopen(req, timeout=600)
        except urllib.error.HTTPError as e:
            r = e
        self.send_response(r.status if hasattr(r, "status") else r.code)
        for k, v in r.headers.items():
            if k.lower() not in ("transfer-encoding", "content-length", "connection", "content-encoding"):
                self.send_header(k, v)
        self.end_headers()
        while True:
            chunk = r.read1(65536) if hasattr(r, "read1") else r.read(65536)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
