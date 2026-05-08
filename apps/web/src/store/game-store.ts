import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, CreateRoomPayload, PublicRoomState, ServerToClientEvents } from "@cards-against-jewels/shared";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type GameStore = {
  socket: GameSocket | null;
  connected: boolean;
  room: PublicRoomState | null;
  roomCode: string;
  playerName: string;
  error: string | null;
  kickedMessage: string | null;
  adultAccepted: boolean;
  createRoom: (settings: CreateRoomPayload) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => void;
  startGame: () => void;
  submitCard: (cardIds: string[]) => void;
  chooseWinner: (submissionId: string) => void;
  nextRound: () => void;
  kickPlayer: (playerId: string) => void;
  leaveRoom: () => void;
  setAdultAccepted: (accepted: boolean) => void;
  setRoomCode: (roomCode: string) => void;
  setPlayerName: (playerName: string) => void;
  clearError: () => void;
  clearKickedMessage: () => void;
};

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3333";

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  connected: false,
  room: null,
  roomCode: "",
  playerName: localStorage.getItem("caj:lastName") ?? "",
  error: null,
  kickedMessage: null,
  adultAccepted: localStorage.getItem("caj:adultAccepted") === "true",

  createRoom: async (settings) => {
    const response = await fetch(`${serverUrl}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error("Não foi possível criar a sala.");
    }

    const payload = (await response.json()) as { code: string };
    set({ roomCode: payload.code });
    return payload.code;
  },

  joinRoom: (roomCode, playerName) => {
    const socket = ensureSocket(get, set);
    const code = roomCode.trim().toUpperCase();

    localStorage.setItem("caj:lastName", playerName);
    set({ roomCode: code, playerName, error: null });
    socket.emit("joinRoom", {
      roomCode: code,
      playerName,
      playerToken: localStorage.getItem(tokenKey(code)) ?? undefined
    });
  },

  startGame: () => get().socket?.emit("startGame"),
  submitCard: (cardIds) => get().socket?.emit("submitCards", { cardIds }),
  chooseWinner: (submissionId) => get().socket?.emit("chooseWinner", { submissionId }),
  nextRound: () => get().socket?.emit("nextRound"),
  kickPlayer: (playerId) => get().socket?.emit("kickPlayer", { playerId }),
  leaveRoom: () => {
    get().socket?.emit("leaveRoom");
    set({ room: null, roomCode: "", error: null });
  },
  setAdultAccepted: (accepted) => {
    localStorage.setItem("caj:adultAccepted", String(accepted));
    set({ adultAccepted: accepted });
  },
  setRoomCode: (roomCode) => set({ roomCode: roomCode.toUpperCase() }),
  setPlayerName: (playerName) => set({ playerName }),
  clearError: () => set({ error: null }),
  clearKickedMessage: () => set({ kickedMessage: null })
}));

function ensureSocket(get: () => GameStore, set: (state: Partial<GameStore>) => void): GameSocket {
  const existing = get().socket;

  if (existing) {
    return existing;
  }

  const socket: GameSocket = io(serverUrl, {
    transports: ["websocket"],
    autoConnect: true
  });

  socket.on("connect", () => set({ connected: true }));
  socket.on("disconnect", () => set({ connected: false }));
  socket.on("joinedRoom", ({ playerToken, room }) => {
    localStorage.setItem(tokenKey(room.code), playerToken);
    set({ room, roomCode: room.code, error: null });
  });
  socket.on("roomState", (room) => set({ room }));
  socket.on("gameError", (error) => set({ error: error.message }));
  socket.on("kickedFromRoom", ({ message }) => {
    set({ kickedMessage: message, room: null, roomCode: "", error: null });
  });

  set({ socket });
  return socket;
}

function tokenKey(roomCode: string): string {
  return `caj:${roomCode}:token`;
}
