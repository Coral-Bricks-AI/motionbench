"""A local HTTPS CONNECT proxy that tunnels only to an allowlist of hosts.

    python3 connect_proxy.py <port> <host-suffix> [<host-suffix> ...]

A sandboxed harness whose only allowed network peer is localhost (Codex inside macOS sandbox-exec) reaches
its model through this; anything outside the allowlist is refused. Nothing is decrypted or logged.
"""
import socket, sys, threading

PORT = int(sys.argv[1])
ALLOW = tuple(sys.argv[2:])


def pipe(a, b):
    try:
        while True:
            data = a.recv(65536)
            if not data:
                break
            b.sendall(data)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(c):
    try:
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = c.recv(4096)
            if not chunk:
                return c.close()
            head += chunk
        line = head.split(b"\r\n", 1)[0].decode("latin-1").split()
        if len(line) < 2 or line[0] != "CONNECT":
            c.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n"); return c.close()
        host, _, port = line[1].rpartition(":")
        if not any(host == a or host.endswith("." + a) for a in ALLOW):
            c.sendall(b"HTTP/1.1 403 Forbidden\r\n\r\n"); return c.close()
        u = socket.create_connection((host, int(port or 443)), timeout=30)
        u.settimeout(None)
        c.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        threading.Thread(target=pipe, args=(c, u), daemon=True).start()
        pipe(u, c)
    except OSError:
        c.close()


srv = socket.socket()
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", PORT))
srv.listen(64)
while True:
    conn, _ = srv.accept()
    threading.Thread(target=handle, args=(conn,), daemon=True).start()
