#!/usr/bin/env node
// From WSL, a URL for WebODM's native Windows build, which listens only on Windows' own 127.0.0.1, out of WSL's
// reach (NAT networking). It listens on localhost in WSL and, for each connection, starts WebODM's own python.exe
// through WSL interop to pipe it to WebODM's port. Nothing is installed or changed on Windows, and it runs only while
// this does. Stop it with Ctrl+C, or by its PID.
//
//   node dev/windows-relay.js            # http://localhost:8007
//   TW_WIN_PORT=8007 TW_WIN_TARGET=29800 TW_WIN_PYTHON=/mnt/c/WebODM/resources/app/apps/python314/python.exe
"use strict";

const net = require("net");
const {spawn} = require("child_process");

const PORT = Number(process.env.TW_WIN_PORT || 8007);
const TARGET = Number(process.env.TW_WIN_TARGET || 29800);
const PYTHON = process.env.TW_WIN_PYTHON || "/mnt/c/WebODM/resources/app/apps/python314/python.exe";

// On Windows: a byte pipe between this process's stdin/stdout and WebODM's port
const BRIDGE = `
import msvcrt, os, socket, threading
for fd in (0, 1): msvcrt.setmode(fd, os.O_BINARY)
s = socket.create_connection(("127.0.0.1", ${TARGET}))
def up():
    while True:
        b = os.read(0, 65536)
        if not b: break
        s.sendall(b)
    try: s.shutdown(socket.SHUT_WR)
    except OSError: pass
threading.Thread(target=up, daemon=True).start()
while True:
    b = s.recv(65536)
    if not b: break
    while b:
        n = os.write(1, b)
        b = b[n:]
`;

const server = net.createServer((socket) => {
    // Started from a Windows folder, so Windows doesn't warn about a UNC working directory
    const child = spawn(PYTHON, ["-u", "-c", BRIDGE], {cwd: "/mnt/c", stdio: ["pipe", "pipe", process.env.TW_WIN_DEBUG ? "inherit" : "ignore"]});
    socket.pipe(child.stdin);
    child.stdout.pipe(socket);
    child.stdin.on("error", () => socket.destroy());
    socket.on("error", () => child.kill());
    socket.on("close", () => child.kill());
    child.on("exit", () => socket.end());
    child.on("error", (e) => {
        console.error(`Cannot start ${PYTHON}: ${e.message}`);
        socket.destroy();
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`http://localhost:${PORT} -> Windows 127.0.0.1:${TARGET} (pid ${process.pid})`);
});
