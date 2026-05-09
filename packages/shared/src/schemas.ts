import { z } from "zod";

export const createRoomSchema = z.object({
  maxPlayers: z.coerce.number().int().min(3).max(10).default(10),
  timerSeconds: z.coerce.number().int().min(30).max(120).default(60),
  pointsToWin: z.coerce.number().int().min(5).max(30).default(5)
});

export const restartGameSchema = z.object({
  settings: createRoomSchema.optional()
});

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().min(3).max(12),
  playerName: z.string().trim().min(1).max(24),
  playerToken: z.string().min(10).optional()
});

export const submitCardsSchema = z.object({
  cardIds: z.array(z.string().min(1)).min(1).max(3)
});

export const chooseWinnerSchema = z.object({
  submissionId: z.string().min(1)
});

export const kickPlayerSchema = z.object({
  playerId: z.string().min(1)
});
