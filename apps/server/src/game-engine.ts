import { randomUUID } from "node:crypto";
import {
  GAME_LIMITS,
  type BlackCard,
  type CreateRoomPayload,
  type PublicRoomState,
  type RoomPhase,
  type RoomSettings,
  type WhiteCard
} from "@cards-against-jewels/shared";
import { fallbackCardCatalog, type CardCatalog } from "./cards/card-catalog.js";
import { GameEngineError } from "./game-error.js";

type Player = {
  id: string;
  token: string;
  name: string;
  score: number;
  connected: boolean;
  isWaiting: boolean;
  hand: WhiteCard[];
};

type Submission = {
  id: string;
  playerId: string;
  cards: WhiteCard[];
};

type Room = {
  code: string;
  phase: RoomPhase;
  hostPlayerId: string | null;
  players: Player[];
  kickedTokens: Set<string>;
  settings: RoomSettings;
  blackDeck: BlackCard[];
  whiteDeck: WhiteCard[];
  roundNumber: number;
  judgeId: string | null;
  blackCard: BlackCard | null;
  submissions: Submission[];
  deadlineAt: number | null;
  timeout: ReturnType<typeof setTimeout> | null;
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
  result: {
    winnerPlayerId: string;
    winnerName: string;
    cards: WhiteCard[];
  } | null;
};

const LOBBY_IDLE_CLEANUP_MS = 30 * 60 * 1000;
const FINISHED_ROOM_CLEANUP_MS = 30 * 60 * 1000;

export type JoinResult = {
  playerId: string;
  playerToken: string;
  room: PublicRoomState;
};

export type KickResult = {
  playerId: string;
  playerToken: string;
  roomCode: string;
};

export class GameEngine {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly onRoomChanged?: (roomCode: string) => void | Promise<void>,
    private readonly cardCatalog: CardCatalog = fallbackCardCatalog
  ) {}

  createRoom(settings: Partial<CreateRoomPayload> = {}): { code: string } {
    let code = makeRoomCode();

    while (this.rooms.has(code)) {
      code = makeRoomCode();
    }

    this.rooms.set(code, {
      code,
      phase: "lobby",
      hostPlayerId: null,
      players: [],
      kickedTokens: new Set(),
      settings: {
        minPlayers: GAME_LIMITS.minPlayers,
        maxPlayers: settings.maxPlayers ?? GAME_LIMITS.maxPlayers,
        handSize: GAME_LIMITS.handSize,
        pointsToWin: settings.pointsToWin ?? GAME_LIMITS.pointsToWin,
        timerSeconds: settings.timerSeconds ?? GAME_LIMITS.timerSeconds
      },
      blackDeck: [],
      whiteDeck: [],
      roundNumber: 0,
      judgeId: null,
      blackCard: null,
      submissions: [],
      deadlineAt: null,
      timeout: null,
      cleanupTimeout: null,
      result: null
    });

    this.scheduleRoomCleanup(this.requireRoom(code), LOBBY_IDLE_CLEANUP_MS);

    return { code };
  }

  getRoomSummary(code: string) {
    const room = this.rooms.get(normalizeCode(code));

    if (!room) {
      return { code: normalizeCode(code), exists: false as const };
    }

    return {
      code: room.code,
      exists: true as const,
      phase: room.phase,
      playerCount: room.players.length
    };
  }

  joinRoom(code: string, playerName: string, playerToken?: string): JoinResult {
    const room = this.requireRoom(code);
    const name = playerName.trim();
    const returningPlayer = playerToken ? room.players.find((player) => player.token === playerToken) : null;

    if (playerToken && room.kickedTokens.has(playerToken)) {
      throw new GameEngineError("ROOM_LOCKED", "Você foi removido desta sala.");
    }

    if (returningPlayer) {
      this.clearRoomCleanup(room);
      returningPlayer.name = name;
      returningPlayer.connected = true;

      return {
        playerId: returningPlayer.id,
        playerToken: returningPlayer.token,
        room: this.getPublicRoom(room.code, returningPlayer.id)
      };
    }

    if (room.phase === "game_over") {
      throw new GameEngineError("ROOM_LOCKED", "Esta partida já terminou.");
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new GameEngineError("ROOM_FULL", "A sala está cheia.");
    }

    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name,
      score: 0,
      connected: true,
      isWaiting: room.phase !== "lobby",
      hand: []
    };

    room.players.push(player);
    this.clearRoomCleanup(room);

    if (!room.hostPlayerId) {
      room.hostPlayerId = player.id;
    }

    return {
      playerId: player.id,
      playerToken: player.token,
      room: this.getPublicRoom(room.code, player.id)
    };
  }

  disconnectPlayer(code: string, playerId: string): void {
    const room = this.rooms.get(normalizeCode(code));
    const player = room?.players.find((candidate) => candidate.id === playerId);

    if (!room || !player) {
      return;
    }

    player.connected = false;
    this.advanceSubmittingIfReady(room);

    if (room.phase === "lobby" && room.players.every((candidate) => !candidate.connected)) {
      this.scheduleRoomCleanup(room, LOBBY_IDLE_CLEANUP_MS);
    }
  }

  startGame(code: string, actorId: string): void {
    const room = this.requireRoom(code);

    this.requireHost(room, actorId);

    if (room.phase !== "lobby") {
      throw new GameEngineError("INVALID_MOVE", "A partida já começou.");
    }

    if (room.players.filter((player) => player.connected && !player.isWaiting).length < room.settings.minPlayers) {
      throw new GameEngineError("NOT_ENOUGH_PLAYERS", `A sala precisa de pelo menos ${room.settings.minPlayers} jogadores.`);
    }

    room.blackDeck = shuffle([...this.cardCatalog.blackCards]);
    room.whiteDeck = shuffle([...this.cardCatalog.whiteCards]);
    room.roundNumber = 1;
    room.result = null;
    room.submissions = [];
    room.players.forEach((player) => {
      player.score = 0;
      player.isWaiting = false;
      player.hand = [];
      this.drawToHand(room, player);
    });
    room.judgeId = room.players.find((player) => player.connected && !player.isWaiting)?.id ?? null;
    room.blackCard = this.drawBlack(room);
    room.phase = "submitting";
    this.schedulePhaseTimeout(room);
  }

  submitCards(code: string, actorId: string, cardIds: string[]): void {
    const room = this.requireRoom(code);
    const player = this.requirePlayer(room, actorId);

    if (room.phase !== "submitting" || !room.blackCard) {
      throw new GameEngineError("INVALID_MOVE", "Não é hora de jogar cartas.");
    }

    if (player.isWaiting) {
      throw new GameEngineError("INVALID_MOVE", "Você entra na próxima rodada.");
    }

    if (room.judgeId === actorId) {
      throw new GameEngineError("NOT_YOUR_TURN", "O juiz não joga carta nesta rodada.");
    }

    if (room.submissions.some((submission) => submission.playerId === actorId)) {
      throw new GameEngineError("INVALID_MOVE", "Você já jogou nesta rodada.");
    }

    if (cardIds.length !== room.blackCard.pick) {
      throw new GameEngineError("INVALID_MOVE", `Esta rodada pede ${room.blackCard.pick} carta.`);
    }

    const cards = cardIds.map((cardId) => {
      const card = player.hand.find((candidate) => candidate.id === cardId);

      if (!card) {
        throw new GameEngineError("INVALID_MOVE", "Carta inválida para sua mão.");
      }

      return card;
    });

    player.hand = player.hand.filter((card) => !cardIds.includes(card.id));
    room.submissions.push({
      id: randomUUID(),
      playerId: actorId,
      cards
    });

    this.advanceSubmittingIfReady(room);
  }

  chooseWinner(code: string, actorId: string, submissionId: string): void {
    const room = this.requireRoom(code);

    if (room.phase !== "judging") {
      throw new GameEngineError("INVALID_MOVE", "Ainda não é hora de escolher a resposta vencedora.");
    }

    if (room.judgeId !== actorId) {
      throw new GameEngineError("NOT_JUDGE", "Só o juiz da rodada pode escolher.");
    }

    const submission = room.submissions.find((candidate) => candidate.id === submissionId);

    if (!submission) {
      throw new GameEngineError("INVALID_MOVE", "Resposta não encontrada.");
    }

    const winner = this.requirePlayer(room, submission.playerId);
    winner.score += 1;
    room.result = {
      winnerPlayerId: winner.id,
      winnerName: winner.name,
      cards: submission.cards
    };
    if (winner.score >= room.settings.pointsToWin) {
      this.finishGame(room);
    } else {
      room.phase = "round_result";
      this.schedulePhaseTimeout(room);
    }
  }

  nextRound(code: string, actorId: string): void {
    const room = this.requireRoom(code);

    if (room.phase !== "round_result") {
      throw new GameEngineError("INVALID_MOVE", "A rodada atual ainda não terminou.");
    }

    if (room.hostPlayerId !== actorId && room.judgeId !== actorId) {
      throw new GameEngineError("INVALID_MOVE", "Só o host ou juiz pode avançar a rodada.");
    }

    this.startNextRound(room);
  }

  kickPlayer(code: string, actorId: string, targetPlayerId: string): KickResult {
    const room = this.requireRoom(code);

    this.requireHost(room, actorId);

    if (actorId === targetPlayerId) {
      throw new GameEngineError("INVALID_MOVE", "O host não pode remover a si mesmo.");
    }

    const target = this.requirePlayer(room, targetPlayerId);
    const kicked: KickResult = {
      playerId: target.id,
      playerToken: target.token,
      roomCode: room.code
    };

    room.kickedTokens.add(target.token);
    room.players = room.players.filter((player) => player.id !== target.id);
    room.submissions = room.submissions.filter((submission) => submission.playerId !== target.id);

    if (this.getActivePlayerCount(room) < room.settings.minPlayers && room.phase !== "lobby") {
      this.finishGame(room);
      return kicked;
    }

    if (room.judgeId === target.id && room.phase !== "lobby") {
      this.startNextRound(room);
      return kicked;
    }

    this.advanceSubmittingIfReady(room);
    return kicked;
  }

  getPublicRoom(code: string, viewerPlayerId: string): PublicRoomState {
    const room = this.requireRoom(code);
    const viewer = room.players.find((player) => player.id === viewerPlayerId) ?? null;
    const revealSubmissions = room.phase === "judging" || room.phase === "round_result" || room.phase === "game_over";
    const serverNow = Date.now();

    return {
      code: room.code,
      phase: room.phase,
      settings: room.settings,
      deadlineAt: room.deadlineAt,
      serverNow,
      deadlineRemainingMs: room.deadlineAt ? Math.max(0, room.deadlineAt - serverNow) : null,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        isHost: room.hostPlayerId === player.id,
        isJudge: room.judgeId === player.id,
        isWaiting: player.isWaiting,
        connected: player.connected,
        handCount: player.hand.length,
        hasSubmitted: room.submissions.some((submission) => submission.playerId === player.id)
      })),
      round:
        room.blackCard && room.judgeId
          ? {
              number: room.roundNumber,
              judgeId: room.judgeId,
              blackCard: room.blackCard,
              submissions: room.submissions.map((submission) => ({
                id: submission.id,
                cards: revealSubmissions || submission.playerId === viewerPlayerId ? submission.cards : [],
                isMine: submission.playerId === viewerPlayerId,
                isWinner: room.result?.winnerPlayerId === submission.playerId
              })),
              result: room.result
            }
          : null,
      hand: viewer && !viewer.isWaiting ? viewer.hand : [],
      me: viewer
        ? {
            playerId: viewer.id,
            name: viewer.name,
            isHost: room.hostPlayerId === viewer.id,
            isJudge: room.judgeId === viewer.id,
            isWaiting: viewer.isWaiting
          }
        : null
    };
  }

  private requireRoom(code: string): Room {
    const room = this.rooms.get(normalizeCode(code));

    if (!room) {
      throw new GameEngineError("ROOM_NOT_FOUND", "Sala não encontrada.");
    }

    return room;
  }

  private requirePlayer(room: Room, playerId: string): Player {
    const player = room.players.find((candidate) => candidate.id === playerId);

    if (!player) {
      throw new GameEngineError("INVALID_MOVE", "Jogador não encontrado.");
    }

    return player;
  }

  private requireHost(room: Room, actorId: string): void {
    if (room.hostPlayerId !== actorId) {
      throw new GameEngineError("NOT_HOST", "Só o host pode fazer isso.");
    }
  }

  private advanceSubmittingIfReady(room: Room): void {
    if (room.phase !== "submitting") {
      return;
    }

    const expectedSubmitters = room.players.filter((player) => player.connected && !player.isWaiting && player.id !== room.judgeId);
    const submittedPlayerIds = new Set(room.submissions.map((submission) => submission.playerId));

    if (expectedSubmitters.length > 0 && expectedSubmitters.every((player) => submittedPlayerIds.has(player.id))) {
      room.phase = "judging";
      this.schedulePhaseTimeout(room);
    }
  }

  private startNextRound(room: Room): void {
    room.players.forEach((player) => {
      if (player.connected && player.isWaiting) {
        player.isWaiting = false;
      }
    });

    if (room.players.filter((player) => player.connected && !player.isWaiting).length < room.settings.minPlayers) {
      this.finishGame(room);
      return;
    }

    room.players.forEach((player) => this.drawToHand(room, player));
    room.submissions = [];
    room.result = null;
    room.roundNumber += 1;
    room.judgeId = this.getNextJudgeId(room);
    room.blackCard = this.drawBlack(room);
    room.phase = "submitting";
    this.schedulePhaseTimeout(room);
  }

  private handlePhaseTimeout(roomCode: string, expectedDeadlineAt: number): void {
    const room = this.rooms.get(roomCode);

    if (!room || !room.deadlineAt || room.deadlineAt !== expectedDeadlineAt) {
      return;
    }

    const remainingMs = room.deadlineAt - Date.now();

    if (remainingMs > 0) {
      this.setPhaseTimeout(room, remainingMs, expectedDeadlineAt);
      return;
    }

    if (room.phase === "submitting") {
      if (room.submissions.length > 0) {
        room.phase = "judging";
        this.schedulePhaseTimeout(room);
      } else {
        this.startNextRound(room);
      }
    } else if (room.phase === "judging") {
      const submission = room.submissions[Math.floor(Math.random() * room.submissions.length)];

      if (submission && room.judgeId) {
        this.chooseWinner(room.code, room.judgeId, submission.id);
      }
    } else if (room.phase === "round_result") {
      this.startNextRound(room);
    }

    void this.onRoomChanged?.(room.code);
  }

  private schedulePhaseTimeout(room: Room): void {
    this.clearPhaseTimeout(room);

    if (room.phase !== "submitting" && room.phase !== "judging" && room.phase !== "round_result") {
      return;
    }

    const timeoutMs = room.phase === "round_result" ? 5000 : room.settings.timerSeconds * 1000;
    room.deadlineAt = Date.now() + timeoutMs;
    this.setPhaseTimeout(room, timeoutMs, room.deadlineAt);
  }

  private setPhaseTimeout(room: Room, timeoutMs: number, expectedDeadlineAt: number): void {
    room.timeout = setTimeout(() => this.handlePhaseTimeout(room.code, expectedDeadlineAt), Math.max(10, timeoutMs + 25));
    room.timeout.unref?.();
  }

  private clearPhaseTimeout(room: Room): void {
    if (room.timeout) {
      clearTimeout(room.timeout);
    }

    room.timeout = null;
    room.deadlineAt = null;
  }

  private finishGame(room: Room): void {
    room.phase = "game_over";
    this.clearPhaseTimeout(room);
    this.scheduleRoomCleanup(room, FINISHED_ROOM_CLEANUP_MS);
  }

  private scheduleRoomCleanup(room: Room, timeoutMs: number): void {
    this.clearRoomCleanup(room);

    room.cleanupTimeout = setTimeout(() => {
      this.clearPhaseTimeout(room);
      this.rooms.delete(room.code);
    }, timeoutMs);
    room.cleanupTimeout.unref?.();
  }

  private clearRoomCleanup(room: Room): void {
    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
    }

    room.cleanupTimeout = null;
  }

  private getNextJudgeId(room: Room): string {
    const fallback = room.players.find((player) => player.connected && !player.isWaiting);

    if (!fallback) {
      throw new GameEngineError("NOT_ENOUGH_PLAYERS", "Não há jogadores conectados.");
    }

    const currentIndex = room.players.findIndex((player) => player.id === room.judgeId);

    for (let offset = 1; offset <= room.players.length; offset += 1) {
      const candidate = room.players[(currentIndex + offset + room.players.length) % room.players.length];

      if (candidate.connected && !candidate.isWaiting) {
        return candidate.id;
      }
    }

    return fallback.id;
  }

  private getActivePlayerCount(room: Room): number {
    return room.players.filter((player) => player.connected && !player.isWaiting).length;
  }

  private drawToHand(room: Room, player: Player): void {
    while (player.hand.length < room.settings.handSize) {
      if (room.whiteDeck.length === 0) {
        room.whiteDeck = shuffle([...this.cardCatalog.whiteCards]);
      }

      const card = room.whiteDeck.pop();

      if (!card) {
        return;
      }

      player.hand.push(card);
    }
  }

  private drawBlack(room: Room): BlackCard {
    if (room.blackDeck.length === 0) {
      room.blackDeck = shuffle([...this.cardCatalog.blackCards]);
    }

    const card = room.blackDeck.pop();

    if (!card) {
      throw new GameEngineError("INVALID_MOVE", "Deck de cartas pretas vazio.");
    }

    return card;
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 5; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
