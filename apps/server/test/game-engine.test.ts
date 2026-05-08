import { afterEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "../src/game-engine.js";

function joinPlayers(game: GameEngine, code: string, count: number) {
  return Array.from({ length: count }, (_, index) => game.joinRoom(code, `Player ${index + 1}`));
}

describe("GameEngine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates rooms with custom settings", () => {
    const game = new GameEngine();
    const { code } = game.createRoom({ maxPlayers: 6, timerSeconds: 45, pointsToWin: 12 });
    const [host] = joinPlayers(game, code, 3);
    const state = game.getPublicRoom(code, host.playerId);

    expect(state.settings.maxPlayers).toBe(6);
    expect(state.settings.timerSeconds).toBe(45);
    expect(state.settings.pointsToWin).toBe(12);
  });

  it("runs a complete round with judge selection and score", () => {
    const game = new GameEngine();
    const { code } = game.createRoom();
    const players = joinPlayers(game, code, 3);

    game.startGame(code, players[0].playerId);

    let state = game.getPublicRoom(code, players[1].playerId);
    expect(state.phase).toBe("submitting");
    expect(state.me?.isJudge).toBe(false);

    game.submitCards(code, players[1].playerId, [state.hand[0].id]);
    state = game.getPublicRoom(code, players[2].playerId);
    game.submitCards(code, players[2].playerId, [state.hand[0].id]);

    const judgeState = game.getPublicRoom(code, players[0].playerId);
    expect(judgeState.phase).toBe("judging");
    expect(judgeState.round?.submissions).toHaveLength(2);
    expect(judgeState.round?.submissions[0].cards).toHaveLength(1);

    game.chooseWinner(code, players[0].playerId, judgeState.round!.submissions[0].id);
    const resultState = game.getPublicRoom(code, players[0].playerId);

    expect(resultState.phase).toBe("round_result");
    expect(resultState.round?.result?.winnerName).toBeTruthy();
    expect(resultState.players.some((player) => player.score === 1)).toBe(true);
  });

  it("shows only the viewer submission while other submitted cards stay face down", () => {
    const game = new GameEngine();
    const { code } = game.createRoom();
    const players = joinPlayers(game, code, 3);

    game.startGame(code, players[0].playerId);
    const playerTwoState = game.getPublicRoom(code, players[1].playerId);
    game.submitCards(code, players[1].playerId, [playerTwoState.hand[0].id]);

    const ownView = game.getPublicRoom(code, players[1].playerId);
    const otherView = game.getPublicRoom(code, players[2].playerId);

    expect(ownView.round?.submissions[0].isMine).toBe(true);
    expect(ownView.round?.submissions[0].cards).toHaveLength(1);
    expect(otherView.round?.submissions[0].isMine).toBe(false);
    expect(otherView.round?.submissions[0].cards).toHaveLength(0);
  });

  it("automatically starts the next round five seconds after a round result", () => {
    vi.useFakeTimers();
    const game = new GameEngine();
    const { code } = game.createRoom();
    const players = joinPlayers(game, code, 3);

    game.startGame(code, players[0].playerId);
    let state = game.getPublicRoom(code, players[1].playerId);
    game.submitCards(code, players[1].playerId, [state.hand[0].id]);
    state = game.getPublicRoom(code, players[2].playerId);
    game.submitCards(code, players[2].playerId, [state.hand[0].id]);

    const judgeState = game.getPublicRoom(code, players[0].playerId);
    game.chooseWinner(code, players[0].playerId, judgeState.round!.submissions[0].id);

    expect(game.getPublicRoom(code, players[0].playerId).phase).toBe("round_result");

    vi.advanceTimersByTime(5000);

    const nextState = game.getPublicRoom(code, players[0].playerId);
    expect(nextState.phase).toBe("submitting");
    expect(nextState.round?.number).toBe(2);
  });

  it("rejects starting a game without enough connected players", () => {
    const game = new GameEngine();
    const { code } = game.createRoom();
    const [host] = joinPlayers(game, code, 2);

    expect(() => game.startGame(code, host.playerId)).toThrow(/pelo menos 3 jogadores/);
  });

  it("allows reconnecting with a player token", () => {
    const game = new GameEngine();
    const { code } = game.createRoom();
    const player = game.joinRoom(code, "Ruby");

    game.disconnectPlayer(code, player.playerId);

    const rejoined = game.joinRoom(code, "Ruby Again", player.playerToken);

    expect(rejoined.playerId).toBe(player.playerId);
    expect(rejoined.room.me?.name).toBe("Ruby Again");
    expect(rejoined.room.players[0].connected).toBe(true);
  });
});
