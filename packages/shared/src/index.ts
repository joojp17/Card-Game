export * from "./cards.js";
export * from "./schemas.js";
export * from "./types.js";

export const GAME_LIMITS = {
  minPlayers: 3,
  maxPlayers: 10,
  handSize: 10,
  timerSeconds: 60,
  pointsToWin: 5
} as const;
