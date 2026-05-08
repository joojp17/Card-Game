import type { WhiteCard } from "@cards-against-jewels/shared";
import { Check, Crown, Gem, Gavel } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type JewelCardProps = {
  text: string;
  tone?: "black" | "white" | "winner";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function JewelCard({ text, tone = "white", selected, disabled, onClick }: JewelCardProps) {
  return (
    <button
      className={cn(
        "flex min-h-44 w-full flex-col justify-between rounded-md border p-4 text-left shadow-card transition",
        tone === "black" && "border-ink bg-ink text-white",
        tone === "white" && "border-ink/10 bg-white text-ink hover:-translate-y-0.5 hover:border-emerald/50",
        tone === "winner" && "border-amber bg-amber/10 text-ink",
        selected && "border-emerald ring-2 ring-emerald/30",
        disabled && "cursor-not-allowed opacity-70",
        !disabled && onClick && "cursor-pointer"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="text-balance text-lg font-black leading-tight">{text}</span>
      <span className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-normal opacity-70">
        <span>Cards Against Jewels</span>
        {tone === "black" ? <Gavel size={18} /> : tone === "winner" ? <Crown size={18} /> : <Gem size={18} />}
      </span>
    </button>
  );
}

type PlayerRowProps = {
  name: string;
  score: number;
  isHost: boolean;
  isJudge: boolean;
  connected: boolean;
  hasSubmitted: boolean;
  canKick: boolean;
  onKick: () => void;
};

export function PlayerRow({ name, score, isHost, isJudge, connected, hasSubmitted, canKick, onKick }: PlayerRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2",
        isJudge ? "border-amber/40 bg-amber/10" : "border-ink/10 bg-white"
      )}
    >
      <div className={cn("h-2.5 w-2.5 rounded-full", connected ? "bg-emerald" : "bg-stone-300")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{name}</div>
        <div className="flex flex-wrap gap-1 text-[11px] font-semibold uppercase tracking-normal text-ink/55">
          {isHost && <span>host</span>}
          {isJudge && <span>juiz</span>}
          {hasSubmitted && <span>jogou</span>}
          {canKick && (
            <button className="font-black text-ruby underline-offset-2 hover:underline" onClick={onKick} type="button">
              kikar
            </button>
          )}
        </div>
      </div>
      <div className="rounded bg-ink px-2 py-1 text-xs font-black text-white">{score}</div>
    </div>
  );
}

export function SubmissionStack({
  cards,
  isMine,
  isWinner,
  canChoose,
  onChoose
}: {
  cards: WhiteCard[];
  isMine: boolean;
  isWinner: boolean;
  canChoose: boolean;
  onChoose: () => void;
}) {
  return (
    <div className={cn("rounded-md border bg-white p-3 shadow-card", isWinner ? "border-amber" : "border-ink/10")}>
      <div className="grid gap-2">
        {cards.length > 0 ? (
          cards.map((card) => (
            <div className="rounded bg-stone-50 p-3 text-sm font-bold leading-snug text-ink" key={card.id}>
              {card.text}
            </div>
          ))
        ) : (
          <div className="flex min-h-28 items-center justify-center rounded bg-ink p-3 text-center text-xs font-black uppercase tracking-normal text-white">
            Carta virada
          </div>
        )}
      </div>
      {isMine && <div className="mt-3 text-xs font-black uppercase tracking-normal text-emerald">sua carta</div>}
      {canChoose && (
        <Button className="mt-3 w-full" onClick={onChoose} type="button" variant="ruby">
          <Check size={16} />
          Escolher
        </Button>
      )}
      {isWinner && <div className="mt-3 text-xs font-black uppercase tracking-normal text-amber">resposta vencedora</div>}
    </div>
  );
}
