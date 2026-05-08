import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import type { ClientToServerEvents, PublicRoomState, ServerToClientEvents } from "@cards-against-jewels/shared";
import { buildApp } from "../src/app.js";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: ReturnType<typeof buildApp>["app"];
let baseUrl: string;

beforeEach(async () => {
  ({ app } = buildApp());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();

  if (!address || typeof address === "string") {
    throw new Error("Missing test server address");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await app.close();
});

describe("socket flow", () => {
  it("joins a room and emits personalized state", async () => {
    const createRoomResponse = await app.inject({ method: "POST", url: "/rooms" });
    const { code } = createRoomResponse.json<{ code: string }>();
    const client = createSocket();

    const joined = waitFor<Parameters<ServerToClientEvents["joinedRoom"]>[0]>(client, "joinedRoom");
    client.emit("joinRoom", { roomCode: code, playerName: "Sapphire" });
    const payload = await joined;

    expect(payload.room.code).toBe(code);
    expect(payload.room.me?.name).toBe("Sapphire");
    expect(payload.playerToken).toBeTruthy();

    client.close();
  });
});

function createSocket(): ClientSocket {
  return createClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true
  });
}

function waitFor<T>(socket: ClientSocket, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: PublicRoomState | T) => resolve(payload as T));
  });
}
