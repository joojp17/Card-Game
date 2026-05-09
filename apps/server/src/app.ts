import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";
import {
  chooseWinnerSchema,
  createRoomSchema,
  kickPlayerSchema,
  joinRoomSchema,
  restartGameSchema,
  submitCardsSchema,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type RoomLookupResponse,
  type ServerToClientEvents
} from "@cards-against-jewels/shared";
import { GameEngine } from "./game-engine.js";
import { GameEngineError } from "./game-error.js";
import type { CardCatalog } from "./cards/card-catalog.js";

export function buildApp(options: { game?: GameEngine; cardCatalog?: CardCatalog } = {}) {
  const app = Fastify({ logger: true });
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: {
      origin: true
    }
  });

  app.register(cors, {
    origin: true
  });

  const emitRoom = async (roomCode: string) => {
    const roomSockets = await io.in(roomCode).fetchSockets();

    for (const roomSocket of roomSockets) {
      const playerId = roomSocket.data.playerId as string | undefined;

      if (playerId) {
        roomSocket.emit("roomState", game.getPublicRoom(roomCode, playerId));
      }
    }
  };

  const game = options.game ?? new GameEngine(emitRoom, options.cardCatalog);

  app.get("/health", async () => ({ ok: true, name: "cards-against-jewels-server" }));

  app.post<{ Body: unknown; Reply: CreateRoomResponse }>("/rooms", async (request, reply) => {
    const parsed = createRoomSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      reply.code(400);
      return { code: "" };
    }

    return game.createRoom(parsed.data);
  });

  app.get<{ Params: { code: string }; Reply: RoomLookupResponse }>("/rooms/:code", async (request) =>
    game.getRoomSummary(request.params.code)
  );

  io.on("connection", (socket) => {
    const sendGameError = (error: unknown) => {
      if (error instanceof GameEngineError) {
        socket.emit("gameError", { code: error.code, message: error.message });
        return;
      }

      socket.emit("gameError", { code: "INVALID_MOVE", message: "Algo deu errado nesta jogada." });
      app.log.error(error);
    };

    const requireSocketRoom = () => {
      const roomCode = socket.data.roomCode as string | undefined;
      const playerId = socket.data.playerId as string | undefined;

      if (!roomCode || !playerId) {
        throw new GameEngineError("INVALID_MOVE", "Entre em uma sala antes de jogar.");
      }

      return { roomCode, playerId };
    };

    socket.on("joinRoom", async (payload) => {
      const parsed = joinRoomSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit("gameError", { code: "BAD_PAYLOAD", message: "Dados de entrada inválidos." });
        return;
      }

      try {
        const previousRoom = socket.data.roomCode as string | undefined;

        if (previousRoom) {
          socket.leave(previousRoom);
        }

        const result = game.joinRoom(parsed.data.roomCode, parsed.data.playerName, parsed.data.playerToken);
        socket.data.roomCode = result.room.code;
        socket.data.playerId = result.playerId;
        await socket.join(result.room.code);
        socket.emit("joinedRoom", result);
        await emitRoom(result.room.code);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("startGame", async () => {
      try {
        const { roomCode, playerId } = requireSocketRoom();
        game.startGame(roomCode, playerId);
        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("restartGame", async (payload = {}) => {
      const parsed = restartGameSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit("gameError", { code: "BAD_PAYLOAD", message: "Configura\u00e7\u00e3o inv\u00e1lida." });
        return;
      }

      try {
        const { roomCode, playerId } = requireSocketRoom();
        game.restartGame(roomCode, playerId, parsed.data.settings);
        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("submitCards", async (payload) => {
      const parsed = submitCardsSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit("gameError", { code: "BAD_PAYLOAD", message: "Carta inválida." });
        return;
      }

      try {
        const { roomCode, playerId } = requireSocketRoom();
        game.submitCards(roomCode, playerId, parsed.data.cardIds);
        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("chooseWinner", async (payload) => {
      const parsed = chooseWinnerSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit("gameError", { code: "BAD_PAYLOAD", message: "Resposta inválida." });
        return;
      }

      try {
        const { roomCode, playerId } = requireSocketRoom();
        game.chooseWinner(roomCode, playerId, parsed.data.submissionId);
        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("nextRound", async () => {
      try {
        const { roomCode, playerId } = requireSocketRoom();
        game.nextRound(roomCode, playerId);
        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("kickPlayer", async (payload) => {
      const parsed = kickPlayerSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit("gameError", { code: "BAD_PAYLOAD", message: "Jogador inválido." });
        return;
      }

      try {
        const { roomCode, playerId } = requireSocketRoom();
        const kicked = game.kickPlayer(roomCode, playerId, parsed.data.playerId);
        const roomSockets = await io.in(roomCode).fetchSockets();

        for (const roomSocket of roomSockets) {
          if (roomSocket.data.playerId === kicked.playerId) {
            roomSocket.emit("kickedFromRoom", {
              roomCode: kicked.roomCode,
              message: "Você foi removido desta sala pelo host."
            });
            roomSocket.leave(roomCode);
            roomSocket.data.roomCode = undefined;
            roomSocket.data.playerId = undefined;
          }
        }

        await emitRoom(roomCode);
      } catch (error) {
        sendGameError(error);
      }
    });

    socket.on("leaveRoom", async () => {
      const roomCode = socket.data.roomCode as string | undefined;
      const playerId = socket.data.playerId as string | undefined;

      if (!roomCode || !playerId) {
        return;
      }

      game.disconnectPlayer(roomCode, playerId);
      socket.leave(roomCode);
      socket.data.roomCode = undefined;
      socket.data.playerId = undefined;
      await emitRoom(roomCode);
    });

    socket.on("disconnect", async () => {
      const roomCode = socket.data.roomCode as string | undefined;
      const playerId = socket.data.playerId as string | undefined;

      if (!roomCode || !playerId) {
        return;
      }

      game.disconnectPlayer(roomCode, playerId);
      await emitRoom(roomCode);
    });
  });

  return { app, io, game };
}
