import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

function waitFor(socket, successEvent) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${successEvent}`));
    }, 3000);

    function cleanup() {
      clearTimeout(timeout);
      socket.off(successEvent, onSuccess);
      socket.off("room-error", onError);
      socket.off("connect_error", onConnectError);
    }

    function onSuccess(payload) {
      cleanup();
      resolve({ ok: true, payload });
    }

    function onError(payload) {
      cleanup();
      resolve({ ok: false, payload });
    }

    function onConnectError(error) {
      cleanup();
      reject(error);
    }

    socket.once(successEvent, onSuccess);
    socket.once("room-error", onError);
    socket.once("connect_error", onConnectError);
  });
}

async function createRoom() {
  const socket = io(SERVER_URL);
  await new Promise((resolve) => socket.once("connect", resolve));
  socket.emit("create-room", { nickname: "Bruno" });
  const result = await waitFor(socket, "room-created");
  socket.disconnect();
  return result.payload.roomCode;
}

async function joinRoom(roomCode, nickname) {
  const socket = io(SERVER_URL);
  await new Promise((resolve) => socket.once("connect", resolve));
  socket.emit("join-room", { roomCode, nickname });
  const result = await waitFor(socket, "room-users");
  return { socket, result };
}

const nonexistent = await joinRoom("ABCD23", "Teste");
if (nonexistent.result.ok || nonexistent.result.payload.message !== "Sala nao encontrada.") {
  throw new Error("Nonexistent room handling failed");
}
nonexistent.socket.disconnect();

const roomCode = await createRoom();
const clients = [];

for (const name of ["Bruno", "Joao", "Pedro", "Ana", "Lia", "Caio", "Bia", "Davi", "Mia", "Theo"]) {
  const joined = await joinRoom(roomCode, name);
  if (!joined.result.ok) {
    throw new Error(`${name} could not join: ${joined.result.payload.message}`);
  }
  clients.push(joined.socket);
}

const extra = await joinRoom(roomCode, "Extra");
if (extra.result.ok || extra.result.payload.message !== "Sala cheia.") {
  throw new Error("Full room handling failed");
}
extra.socket.disconnect();
clients.forEach((socket) => {
  socket.emit("leave-room");
  socket.disconnect();
});

console.log(`signaling-ok ${roomCode}`);
