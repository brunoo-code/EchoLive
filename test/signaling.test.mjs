import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function waitFor(socket, events) {
  return new Promise((resolve, reject) => {
    const handlers = new Map();
    const timeout = setTimeout(() => {
      clean();
      reject(new Error(`No response for ${events.join(", ")}`));
    }, 3000);
    function clean() {
      clearTimeout(timeout);
      for (const [event, handler] of handlers) socket.off(event, handler);
    }
    for (const event of events) {
      const handler = (payload) => {
        clean();
        resolve({ event, payload });
      };
      handlers.set(event, handler);
      socket.once(event, handler);
    }
  });
}

test("guest rooms reject unknown rooms and enforce capacity; peers receive chat", { timeout: 20000 }, async (t) => {
  const port = await availablePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["src/index.js"], {
    cwd: fileURLToPath(new URL("../server/", import.meta.url)),
    env: { ...process.env, PORT: String(port), DATABASE_URL: "", MAX_PARTICIPANTS_PER_ROOM: "2" },
    stdio: "ignore",
  });
  const sockets = [];
  t.after(() => {
    for (const socket of sockets) socket.disconnect();
    server.kill();
  });
  let healthy = false;
  for (let attempt = 0; attempt < 60 && server.exitCode === null; attempt++) {
    const response = await fetch(`${url}/health`).catch(() => null);
    if (response?.ok) {
      healthy = true;
      break;
    }
    await delay(100);
  }
  assert.ok(healthy, "test server started");

  async function connect() {
    const socket = io(url, { autoConnect: false, reconnection: false });
    sockets.push(socket);
    const ready = waitFor(socket, ["connect", "connect_error"]);
    socket.connect();
    assert.equal((await ready).event, "connect");
    return socket;
  }

  const ana = await connect();
  const bruno = await connect();
  const visitor = await connect();
  const missing = waitFor(visitor, ["room-error"]);
  visitor.emit("join-room", { roomCode: "MISSING", nickname: "Visitante" });
  assert.match((await missing).payload.message, /nao encontrada/i);

  const created = waitFor(ana, ["room-created", "room-error"]);
  ana.emit("create-room", { roomCode: "DEMOTEST", roomName: "Sala de teste" });
  const room = await created;
  assert.equal(room.event, "room-created");
  const { roomCode } = room.payload;
  for (const [socket, nickname] of [[ana, "Ana"], [bruno, "Bruno"]]) {
    const joined = waitFor(socket, ["room-users", "room-error"]);
    socket.emit("join-room", { roomCode, nickname });
    assert.equal((await joined).event, "room-users");
  }

  const full = waitFor(visitor, ["room-error"]);
  visitor.emit("join-room", { roomCode, nickname: "Visitante" });
  assert.match((await full).payload.message, /sala cheia/i);

  const delivered = waitFor(bruno, ["message-created"]);
  ana.emit("send-message", { channelId: "general", content: "Teste de chat em tempo real" });
  assert.equal((await delivered).payload.content, "Teste de chat em tempo real");
});
