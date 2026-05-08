export type RoomPhase = "lobby" | "submitting" | "judging" | "round_result" | "game_over";

export type BlackCard = {
  id: string;
  text: string;
  pick: number;
};

export type WhiteCard = {
  id: string;
  text: string;
};

export type PlayerPublic = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isJudge: boolean;
  isWaiting: boolean;
  connected: boolean;
  handCount: number;
  hasSubmitted: boolean;
};

export type SubmissionPublic = {
  id: string;
  cards: WhiteCard[];
  isMine: boolean;
  isWinner: boolean;
};

export type RoundResultPublic = {
  winnerPlayerId: string;
  winnerName: string;
  cards: WhiteCard[];
};

export type RoundPublic = {
  number: number;
  judgeId: string;
  blackCard: BlackCard;
  submissions: SubmissionPublic[];
  result: RoundResultPublic | null;
};

export type RoomSettings = {
  minPlayers: number;
  maxPlayers: number;
  handSize: number;
  pointsToWin: number;
  timerSeconds: number;
};

export type PublicRoomState = {
  code: string;
  phase: RoomPhase;
  players: PlayerPublic[];
  settings: RoomSettings;
  deadlineAt: number | null;
  serverNow: number;
  deadlineRemainingMs: number | null;
  round: RoundPublic | null;
  hand: WhiteCard[];
  me: {
    playerId: string;
    name: string;
    isHost: boolean;
    isJudge: boolean;
    isWaiting: boolean;
  } | null;
};

export type CreateRoomResponse = {
  code: string;
};

export type CreateRoomPayload = {
  maxPlayers: number;
  timerSeconds: number;
  pointsToWin: number;
};

export type RoomLookupResponse = {
  code: string;
  exists: boolean;
  phase?: RoomPhase;
  playerCount?: number;
};

export type JoinRoomAck = {
  playerId: string;
  playerToken: string;
  room: PublicRoomState;
};

export type GameErrorCode =
  | "BAD_PAYLOAD"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_LOCKED"
  | "NOT_HOST"
  | "NOT_JUDGE"
  | "NOT_YOUR_TURN"
  | "INVALID_MOVE"
  | "NOT_ENOUGH_PLAYERS";

export type GameError = {
  code: GameErrorCode;
  message: string;
};

export type ClientToServerEvents = {
  joinRoom: (payload: { roomCode: string; playerName: string; playerToken?: string }) => void;
  startGame: () => void;
  submitCards: (payload: { cardIds: string[] }) => void;
  chooseWinner: (payload: { submissionId: string }) => void;
  nextRound: () => void;
  kickPlayer: (payload: { playerId: string }) => void;
  leaveRoom: () => void;
};

export type ServerToClientEvents = {
  joinedRoom: (payload: JoinRoomAck) => void;
  roomState: (payload: PublicRoomState) => void;
  gameError: (payload: GameError) => void;
  kickedFromRoom: (payload: { roomCode: string; message: string }) => void;
};
