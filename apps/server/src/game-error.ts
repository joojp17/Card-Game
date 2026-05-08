import type { GameErrorCode } from "@cards-against-jewels/shared";

export class GameEngineError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string
  ) {
    super(message);
  }
}
