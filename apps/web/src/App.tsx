import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Clock, Copy, Gem, LogIn, Play, Plus, Settings, ShieldAlert, Trophy, Users } from "lucide-react";
import { initializeDiscordSdk } from "./lib/discord";
import { playSound, unlockAudio } from "./lib/audio";
import { Button } from "./components/ui/button";
import { JewelCard, PlayerRow, SubmissionStack } from "./components/card";
import { cn } from "./lib/utils";
import { useGameStore } from "./store/game-store";

export function App() {
  const {
    adultAccepted,
    clearError,
    clearKickedMessage,
    createRoom,
    error,
    joinRoom,
    kickedMessage,
    playerName,
    room,
    roomCode,
    setAdultAccepted,
    setPlayerName,
    setRoomCode
  } = useGameStore();
  const [isCreating, setIsCreating] = useState(false);
  const [roomSize, setRoomSize] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [pointsToWin, setPointsToWin] = useState(5);
  const [screen, setScreen] = useState<"home" | "config">("home");

  useEffect(() => {
    initializeDiscordSdk().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!room) {
      setScreen("home");
    }
  }, [room]);

  const joinDisabled = !adultAccepted || !playerName.trim() || !roomCode.trim();
  const canOpenConfig = adultAccepted && playerName.trim();

  async function handleCreateRoom() {
    unlockAudio();
    setIsCreating(true);
    clearError();

    try {
      const code = await createRoom({
        maxPlayers: clamp(roomSize, 3, 10),
        timerSeconds: clamp(timerSeconds, 30, 120),
        pointsToWin: clamp(pointsToWin, 5, 30)
      });

      if (playerName.trim()) {
        joinRoom(code, playerName.trim());
      }
    } catch (caught) {
      console.error(caught);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.16),transparent_32rem),linear-gradient(135deg,#f7f2ea,#e8f3ee_46%,#fff7ed)] text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md text-white">
              <img src="/logo.png" alt="Cards Against Jewels" />
            </div>
            <div>
              <h1 className="text-xl font-black leading-none sm:text-2xl">Cards Against Jewels</h1>
              <p className="mt-1 text-sm font-semibold text-ink/60">Sala privada, respostas indecentes, julgamento soberano.</p>
            </div>
          </div>
          {room && <RoomBadge code={room.code} />}
        </header>

        {error && (
          <button
            className="mt-4 rounded-md border border-ruby/20 bg-ruby/10 px-4 py-3 text-left text-sm font-semibold text-ruby"
            onClick={clearError}
            type="button"
          >
            {error}
          </button>
        )}

        {kickedMessage && (
          <InfoModal
            actionLabel="Entendi"
            onClose={clearKickedMessage}
            text="Você voltou para a tela inicial e não poderá reconectar nessa sala pelo mesmo navegador."
            title="Você foi kikado"
          />
        )}

        {!room && screen === "home" && (
          <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.55fr)]">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-black uppercase tracking-normal text-ink/60">
                <ShieldAlert size={16} />
                18+
              </div>
              <h2 className="max-w-2xl text-balance text-5xl font-black leading-[0.94] sm:text-7xl">
                Joias falsas. Julgamentos reais.
              </h2>
              <p className="mt-5 max-w-xl text-lg font-semibold leading-relaxed text-ink/70">
                Crie uma sala, chame o grupo e deixe cada rodada decidir quem tem a resposta mais errada pelo motivo mais certo.
              </p>
            </div>

            <form
              className="rounded-md border border-ink/10 bg-white p-5 shadow-card"
              onSubmit={(event) => {
                event.preventDefault();
                if (!joinDisabled) {
                  unlockAudio();
                  joinRoom(roomCode, playerName.trim());
                }
              }}
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-black">Seu nome</span>
                  <input
                    className="mt-2 h-12 w-full rounded-md border border-ink/15 px-3 text-base font-semibold outline-none ring-emerald/30 transition focus:border-emerald focus:ring-4"
                    maxLength={24}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Ex.: Rubi do caos"
                    value={playerName}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black">Código da sala</span>
                  <input
                    className="mt-2 h-12 w-full rounded-md border border-ink/15 px-3 text-base font-black uppercase tracking-normal outline-none ring-emerald/30 transition focus:border-emerald focus:ring-4"
                    maxLength={12}
                    onChange={(event) => setRoomCode(event.target.value)}
                    placeholder="JEWEL"
                    value={roomCode}
                  />
                </label>

                <label className="flex items-start gap-3 rounded-md border border-amber/30 bg-amber/10 p-3 text-sm font-semibold leading-snug text-ink/75">
                  <input
                    checked={adultAccepted}
                    className="mt-1 h-4 w-4 accent-ink"
                    onChange={(event) => setAdultAccepted(event.target.checked)}
                    type="checkbox"
                  />
                  Eu confirmo que esta sala é para adultos e pode ter humor pesado.
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button disabled={joinDisabled} type="submit">
                  <LogIn size={18} />
                  Entrar
                </Button>
                <Button disabled={!canOpenConfig} onClick={() => setScreen("config")} type="button" variant="ruby">
                  <Settings size={18} />
                  Criar lobby
                </Button>
              </div>
            </form>
          </section>
        )}

        {!room && screen === "config" && (
          <section className="grid flex-1 items-center py-8">
            <form
              className="mx-auto w-full max-w-2xl rounded-md border border-ink/10 bg-white p-5 shadow-card"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateRoom();
              }}
            >
              <button
                className="mb-4 inline-flex items-center gap-2 text-sm font-black text-ink/65 hover:text-ink"
                onClick={() => setScreen("home")}
                type="button"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
              <h2 className="text-2xl font-black">Configurar lobby</h2>
              <p className="mt-1 text-sm font-semibold text-ink/65">
                Essas regras ficam travadas para a sala que você vai criar.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <NumberField label="Tamanho" max={10} min={3} onChange={setRoomSize} value={roomSize} />
                <NumberField label="Timer" max={120} min={30} onChange={setTimerSeconds} suffix="s" value={timerSeconds} />
                <NumberField label="Pontuação" max={30} min={5} onChange={setPointsToWin} value={pointsToWin} />
              </div>

              <Button className="mt-6 w-full" disabled={isCreating} type="submit" variant="ruby">
                <Plus size={18} />
                Criar lobby
              </Button>
            </form>
          </section>
        )}

        {room && <GameRoom />}
      </div>
    </main>
  );
}

function RoomBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-black transition",
        copied ? "border-emerald/30 bg-emerald/10 text-emerald" : "border-ink/10 bg-white text-ink"
      )}
      onClick={() => {
        void navigator.clipboard?.writeText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      type="button"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Copiado" : code}
    </button>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  suffix,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-normal text-ink/55">{label}</span>
      <div className="mt-1 flex h-11 items-center rounded-md border border-ink/15 bg-white px-2 focus-within:border-emerald focus-within:ring-4 focus-within:ring-emerald/30">
        <input
          className="min-w-0 flex-1 bg-transparent text-base font-black outline-none"
          max={max}
          min={min}
          onBlur={(event) => onChange(clamp(Number(event.target.value), min, max))}
          onChange={(event) => onChange(Number(event.target.value))}
          type="number"
          value={value}
        />
        {suffix && <span className="text-sm font-black text-ink/45">{suffix}</span>}
      </div>
      <span className="mt-1 block text-[11px] font-semibold text-ink/45">
        {min}-{max}
      </span>
    </label>
  );
}

function RoundTimer({
  deadlineAt,
  deadlineRemainingMs,
  phase,
  skippedReason,
  syncKey
}: {
  deadlineAt: number | null;
  deadlineRemainingMs: number | null;
  phase: string;
  skippedReason?: string | null;
  syncKey: string;
}) {
  const [clientNow, setClientNow] = useState(Date.now());
  const [timerSync, setTimerSync] = useState(() => ({ clientNow: Date.now(), remainingMs: deadlineRemainingMs }));
  const lastTickRef = useRef<number | null>(null);
  const remainingMs = timerSync.remainingMs === null ? null : Math.max(0, timerSync.remainingMs - (clientNow - timerSync.clientNow));
  const secondsLeft = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const isActive = phase === "submitting" || phase === "judging" || phase === "round_result";
  const isRoundResult = phase === "round_result";
  const label = isRoundResult ? "Pr\u00f3xima rodada em " : "Tempo: ";

  useEffect(() => {
    if (deadlineRemainingMs === null || !isActive) {
      return;
    }

    const interval = window.setInterval(() => setClientNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadlineRemainingMs, isActive]);

  useEffect(() => {
    const now = Date.now();
    setClientNow(now);
    setTimerSync({ clientNow: now, remainingMs: deadlineRemainingMs });
  }, [deadlineAt, deadlineRemainingMs, phase, syncKey]);

  useEffect(() => {
    if (!isActive || isRoundResult || secondsLeft === null || secondsLeft <= 0 || secondsLeft > 5) {
      return;
    }

    if (lastTickRef.current !== secondsLeft) {
      playSound("tick");
      lastTickRef.current = secondsLeft;
    }
  }, [isActive, isRoundResult, secondsLeft]);

  useEffect(() => {
    lastTickRef.current = null;
  }, [syncKey]);

  if (!isActive || secondsLeft === null) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-black",
        !isRoundResult && secondsLeft <= 5 ? "border-ruby/30 bg-ruby/10 text-ruby" : "border-ink/10 bg-stone-50 text-ink/70"
      )}
    >
      <Clock size={16} />
      <span>
        {skippedReason && <>{skippedReason} </>}
        {label}
        {secondsLeft}s
      </span>
    </div>
  );
}

function GameRoom() {
  const { chooseWinner, kickPlayer, leaveRoom, restartGame, room, startGame, submitCard } = useGameStore();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [restartSettingsOpen, setRestartSettingsOpen] = useState(false);
  const [restartRoomSize, setRestartRoomSize] = useState(10);
  const [restartTimerSeconds, setRestartTimerSeconds] = useState(60);
  const [restartPointsToWin, setRestartPointsToWin] = useState(5);
  const previousRoundRef = useRef<number | null>(null);
  const previousJudgeRef = useRef<string | null>(null);
  const previousResultRef = useRef<string | null>(null);
  const previousGameOverRef = useRef<string | null>(null);
  const me = room?.me;
  const judge = room?.players.find((player) => player.isJudge);
  const submitted = room?.players.find((player) => player.id === me?.playerId)?.hasSubmitted ?? false;
  const activePlayerCount = room?.players.filter((player) => !player.isWaiting && player.connected).length ?? 0;
  const canStart = room?.phase === "lobby" && Boolean(me?.isHost) && activePlayerCount >= room.settings.minPlayers;
  const canSubmit = room?.phase === "submitting" && !me?.isJudge && !me?.isWaiting && !submitted;
  const canJudge = room?.phase === "judging" && Boolean(me?.isJudge) && !me?.isWaiting;

  useEffect(() => {
    if (!room) {
      return;
    }

    setRestartRoomSize(room.settings.maxPlayers);
    setRestartTimerSeconds(room.settings.timerSeconds);
    setRestartPointsToWin(room.settings.pointsToWin);
  }, [room?.settings.maxPlayers, room?.settings.pointsToWin, room?.settings.timerSeconds]);

  useEffect(() => {
    setSelectedCardIds([]);
  }, [room?.round?.number]);

  useEffect(() => {
    if (!room?.round || !me) {
      return;
    }

    const roundNumber = room.round.number;
    const judgeId = room.round.judgeId;
    const resultKey = room.round.result ? `${roundNumber}:${room.round.result.winnerPlayerId}` : null;

    if (room.phase === "submitting" && previousRoundRef.current !== roundNumber) {
      playSound("newRound");
    }

    if (room.phase === "submitting" && me.playerId === judgeId && previousJudgeRef.current !== `${roundNumber}:${judgeId}`) {
      playSound("judge");
    }

    if (resultKey && previousResultRef.current !== resultKey) {
      playSound("win");
    }

    previousRoundRef.current = roundNumber;
    previousJudgeRef.current = `${roundNumber}:${judgeId}`;
    previousResultRef.current = resultKey;
  }, [me, room]);

  useEffect(() => {
    if (!room || room.phase !== "game_over") {
      previousGameOverRef.current = null;
      setGameOverModalOpen(false);
      setRestartSettingsOpen(false);
      return;
    }

    if (previousGameOverRef.current !== room.code) {
      previousGameOverRef.current = room.code;
      setGameOverModalOpen(true);
      playSound("gameOver");
    }
  }, [room]);

  if (!room || !me) {
    return null;
  }

  const sortedPlayers = [...room.players].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  const activePlayers = sortedPlayers.filter((player) => !player.isWaiting);
  const waitingPlayers = sortedPlayers.filter((player) => player.isWaiting);
  const showSubmissions = Boolean(room.round && room.round.submissions.length > 0);
  const requiredCards = room.round?.blackCard.pick ?? 1;
  const winner = winnerName(room.players);

  return (
    <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Button
          className="w-full justify-start"
          onClick={() => setLeaveModalOpen(true)}
          type="button"
          variant="pearl"
        >
          <ArrowLeft size={18} />
          Sair da sala
        </Button>

        <div className="rounded-md border border-ink/10 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-normal text-ink/60">Jogadores</h2>
            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-1 text-xs font-black">
              <Users size={14} />
              {room.players.length}/{room.settings.maxPlayers}
            </span>
          </div>
          <div className="space-y-2">
            {activePlayers.map((player) => (
              <PlayerRow
                canKick={me.isHost && player.id !== me.playerId}
                connected={player.connected}
                isHost={player.isHost}
                isJudge={player.isJudge}
                isWaiting={player.isWaiting}
                key={player.id}
                name={player.name}
                onKick={() => kickPlayer(player.id)}
                score={player.score}
              />
            ))}
          </div>
          {waitingPlayers.length > 0 && (
            <div className="mt-4 border-t border-ink/10 pt-3">
              <h3 className="mb-2 text-xs font-black uppercase tracking-normal text-ink/45">Fila de espera</h3>
              <div className="space-y-2">
                {waitingPlayers.map((player) => (
                  <PlayerRow
                    canKick={me.isHost && player.id !== me.playerId}
                    connected={player.connected}
                    isHost={player.isHost}
                    isJudge={false}
                    isWaiting={player.isWaiting}
                    key={player.id}
                    name={player.name}
                    onKick={() => kickPlayer(player.id)}
                    score={player.score}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-ink/10 bg-white p-4 shadow-card">
          <h2 className="text-sm font-black uppercase tracking-normal text-ink/60">Partida</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Rodada" value={String(room.round?.number ?? 0)} />
            <Stat label="Meta" value={`${room.settings.pointsToWin} pts`} />
            <Stat label="Juiz" value={judge?.name ?? "-"} />
            <Stat label="Tempo" value={`${room.settings.timerSeconds}s`} />
          </dl>
        </div>
      </aside>

      <div className="space-y-5">
        {room.phase === "lobby" && (
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Lobby aberto</h2>
                <p className="mt-1 text-sm font-semibold text-ink/65">
                  Chame pelo código da sala. A partida começa com pelo menos {room.settings.minPlayers} jogadores.
                </p>
              </div>
              <Button
                disabled={!canStart}
                onClick={() => {
                  unlockAudio();
                  startGame();
                }}
                type="button"
                variant="ruby"
              >
                <Play size={18} />
                Iniciar
              </Button>
            </div>
          </Panel>
        )}

        {room.round && room.phase !== "lobby" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
            <JewelCard text={room.round.blackCard.text} tone="black" />
            <Panel>
              <RoundStatus phase={room.phase} isJudge={me.isJudge} judgeName={judge?.name ?? "Juiz"} submitted={submitted} />
              <RoundTimer
                deadlineAt={room.deadlineAt}
                deadlineRemainingMs={room.deadlineRemainingMs}
                phase={room.phase}
                skippedReason={room.round.skippedReason}
                syncKey={`${room.phase}:${room.round.number}:${room.deadlineAt ?? "none"}`}
              />
            </Panel>
          </div>
        )}

        {me.isWaiting && room.phase !== "lobby" && room.phase !== "game_over" && (
          <Panel className="border-emerald/30 bg-emerald/10">
            <h2 className="text-xl font-black">Você está na fila de espera</h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">
              Você entrou com a rodada em andamento e participa automaticamente na próxima rodada.
            </p>
          </Panel>
        )}

        {showSubmissions && room.round && (
          <Panel>
            <h2 className="mb-4 text-xl font-black">
              {room.phase === "submitting" ? "Cartas jogadas" : room.phase === "judging" ? "Respostas anônimas" : "Resultado"}
            </h2>
            {room.round.result && (
              <p className="mb-4 text-sm font-semibold text-ink/65">{room.round.result.winnerName} levou a rodada.</p>
            )}
            {room.round.skippedReason && <p className="mb-4 text-sm font-semibold text-ink/65">{room.round.skippedReason}</p>}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {room.round.submissions.map((submission) => (
                <SubmissionStack
                  canChoose={canJudge}
                  cards={submission.cards}
                  isMine={submission.isMine}
                  isWinner={submission.isWinner}
                  key={submission.id}
                  onChoose={() => {
                    unlockAudio();
                    chooseWinner(submission.id);
                  }}
                />
              ))}
            </div>
          </Panel>
        )}

        {room.phase === "submitting" && !me.isWaiting && (
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Sua mão</h2>
              <Button
                disabled={!canSubmit || selectedCardIds.length !== requiredCards}
                onClick={() => {
                  unlockAudio();
                  if (selectedCardIds.length === requiredCards) {
                    submitCard(selectedCardIds);
                  }
                }}
                type="button"
                variant="ruby"
              >
                <Check size={18} />
                Jogar {requiredCards > 1 ? `${requiredCards} cartas` : "carta"}
              </Button>
            </div>
            {requiredCards > 1 && (
              <p className="mb-4 text-sm font-semibold text-ink/65">
                Esta rodada pede {requiredCards} cartas. Selecione {requiredCards} respostas em ordem.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {room.hand.map((card) => (
                <JewelCard
                  disabled={!canSubmit}
                  key={card.id}
                  onClick={() => setSelectedCardIds((current) => toggleSelectedCard(current, card.id, requiredCards))}
                  selected={selectedCardIds.includes(card.id)}
                  text={card.text}
                />
              ))}
            </div>
          </Panel>
        )}        
      </div>
      {leaveModalOpen && (
        <ConfirmModal
          confirmLabel="Sair da sala"
          onCancel={() => setLeaveModalOpen(false)}
          onConfirm={() => {
            setLeaveModalOpen(false);
            leaveRoom();
          }}
          text="Você volta para a tela principal. Se a partida já começou, sua conexão fica marcada como ausente até você entrar novamente."
          title="Sair desta sala?"
        />
      )}
      {gameOverModalOpen && (
        <GameOverModal
          isHost={me.isHost}
          onClose={() => {
            setGameOverModalOpen(false);
            setRestartSettingsOpen(false);
          }}
          onConfig={() => setRestartSettingsOpen(true)}
          onCancelConfig={() => setRestartSettingsOpen(false)}
          onPlayAgain={() => {
            unlockAudio();
            if (me.isHost) {
              restartGame();
            }
            setGameOverModalOpen(false);
            setRestartSettingsOpen(false);
          }}
          onSubmitSettings={() => {
            unlockAudio();
            restartGame({
              maxPlayers: clamp(restartRoomSize, 3, 10),
              timerSeconds: clamp(restartTimerSeconds, 30, 120),
              pointsToWin: clamp(restartPointsToWin, 5, 30)
            });
            setGameOverModalOpen(false);
            setRestartSettingsOpen(false);
          }}
          pointsToWin={restartPointsToWin}
          roomSize={restartRoomSize}
          settingsOpen={restartSettingsOpen}
          setPointsToWin={setRestartPointsToWin}
          setRoomSize={setRestartRoomSize}
          setTimerSeconds={setRestartTimerSeconds}
          timerSeconds={restartTimerSeconds}
          winner={winner}
        />
      )}
    </section>
  );
}

function ConfirmModal({
  confirmLabel,
  onCancel,
  onConfirm,
  text,
  title
}: {
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  text: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md rounded-md border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="text-xl font-black" id="confirm-title">
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/65">{text}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button onClick={onCancel} type="button" variant="pearl">
            Cancelar
          </Button>
          <Button onClick={onConfirm} type="button" variant="ruby">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GameOverModal({
  isHost,
  onClose,
  onConfig,
  onCancelConfig,
  onPlayAgain,
  onSubmitSettings,
  pointsToWin,
  roomSize,
  settingsOpen,
  setPointsToWin,
  setRoomSize,
  setTimerSeconds,
  timerSeconds,
  winner
}: {
  isHost: boolean;
  onClose: () => void;
  onConfig: () => void;
  onCancelConfig: () => void;
  onPlayAgain: () => void;
  onSubmitSettings: () => void;
  pointsToWin: number;
  roomSize: number;
  settingsOpen: boolean;
  setPointsToWin: (value: number) => void;
  setRoomSize: (value: number) => void;
  setTimerSeconds: (value: number) => void;
  timerSeconds: number;
  winner: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="w-full max-w-md rounded-md border border-amber/40 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-amber/10 text-amber">
            <Trophy size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black" id="game-over-title">
              Fim de jogo
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">{winner} venceu a partida.</p>
          </div>
        </div>

        {settingsOpen && isHost && (
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <NumberField label="Tamanho" max={10} min={3} onChange={setRoomSize} value={roomSize} />
            <NumberField label="Timer" max={120} min={30} onChange={setTimerSeconds} suffix="s" value={timerSeconds} />
            <NumberField label="Pontua\u00e7\u00e3o" max={30} min={5} onChange={setPointsToWin} value={pointsToWin} />
          </div>
        )}

        {isHost ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {settingsOpen ? (
              <>
                <Button onClick={onCancelConfig} type="button" variant="pearl">
                  <ArrowLeft size={18} />
                  Voltar
                </Button>
                <Button onClick={onSubmitSettings} type="button" variant="ruby">
                  <Play size={18} />
                  Iniciar
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onPlayAgain} type="button" variant="ruby">
                  <Play size={18} />
                  Jogar novamente
                </Button>
                <Button onClick={onConfig} type="button" variant="pearl">
                  <Settings size={18} />
                  Configurações
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button className="w-full" onClick={onClose} type="button" variant="ruby">
            <Check size={18} />
            Jogar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

function InfoModal({
  actionLabel,
  onClose,
  text,
  title
}: {
  actionLabel: string;
  onClose: () => void;
  text: string;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div className="w-full max-w-md rounded-md border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="text-xl font-black" id="info-title">
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/65">{text}</p>
        <Button className="mt-5 w-full" onClick={onClose} type="button" variant="ruby">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-md border border-ink/10 bg-white/95 p-4 shadow-card", className)}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-2">
      <dt className="text-[11px] font-black uppercase tracking-normal text-ink/45">{label}</dt>
      <dd className="mt-1 truncate text-sm font-black">{value}</dd>
    </div>
  );
}

function RoundStatus({
  phase,
  isJudge,
  judgeName,
  submitted
}: {
  phase: string;
  isJudge: boolean;
  judgeName: string;
  submitted: boolean;
}) {
  const copy = useMemo(() => {
    if (phase === "submitting" && isJudge) return "Você é o juiz. Aguarde as respostas anônimas.";
    if (phase === "submitting" && submitted) return "Carta enviada. As outras ficam viradas até o julgamento.";
    if (phase === "submitting") return "Escolha uma carta da sua mão.";
    if (phase === "judging" && isJudge) return "Escolha a resposta que merece a joia da vergonha.";
    if (phase === "judging") return `${judgeName} está julgando as respostas.`;
    if (phase === "round_result") return "Resultado da rodada.";
    return "A partida terminou.";
  }, [isJudge, judgeName, phase, submitted]);

  return <p className="text-lg font-black leading-snug text-ink">{copy}</p>;
}

function winnerName(players: { name: string; score: number }[]) {
  return [...players].sort((left, right) => right.score - left.score)[0]?.name ?? "Ninguém";
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function toggleSelectedCard(current: string[], cardId: string, limit: number) {
  if (current.includes(cardId)) {
    return current.filter((selectedId) => selectedId !== cardId);
  }

  if (current.length >= limit) {
    return [...current.slice(1), cardId];
  }

  return [...current, cardId];
}
