"use client";

import { useEffect, useState } from "react";

const SHOT_CLOCK_MS = 7000;
const REVEAL_HOLD_MS = 2200;
const EXIT_MS = 320;

type Athlete = {
  name: string;
  country: string;
  flag: string;
  born: number;
  seasons: number;
  pb: string;
  bib: number;
  time: string;
};

type Duel = {
  event: string;
  year: number;
  stadium: string;
  wind: string;
  athletes: [Athlete, Athlete];
  winner: 0 | 1;
};

const DUELS: Duel[] = [
  {
    event: "Men's 100m · Olympic Final",
    year: 2012,
    stadium: "Olympic Stadium, London",
    wind: "+1.5 m/s",
    winner: 0,
    athletes: [
      {
        name: "Usain Bolt",
        country: "JAM",
        flag: "🇯🇲",
        born: 1986,
        seasons: 14,
        pb: "9.58",
        bib: 2163,
        time: "9.63",
      },
      {
        name: "Justin Gatlin",
        country: "USA",
        flag: "🇺🇸",
        born: 1982,
        seasons: 19,
        pb: "9.74",
        bib: 3206,
        time: "9.79",
      },
    ],
  },
  {
    event: "Women's 100m · Olympic Final",
    year: 2021,
    stadium: "National Stadium, Tokyo",
    wind: "-0.6 m/s",
    winner: 1,
    athletes: [
      {
        name: "Shelly-Ann Fraser-Pryce",
        country: "JAM",
        flag: "🇯🇲",
        born: 1986,
        seasons: 16,
        pb: "10.60",
        bib: 2722,
        time: "10.74",
      },
      {
        name: "Elaine Thompson-Herah",
        country: "JAM",
        flag: "🇯🇲",
        born: 1992,
        seasons: 12,
        pb: "10.54",
        bib: 2735,
        time: "10.61",
      },
    ],
  },
  {
    event: "Men's 200m · World Championship Final",
    year: 2022,
    stadium: "Hayward Field, Eugene",
    wind: "+0.4 m/s",
    winner: 1,
    athletes: [
      {
        name: "Erriyon Knighton",
        country: "USA",
        flag: "🇺🇸",
        born: 2004,
        seasons: 4,
        pb: "19.49",
        bib: 1098,
        time: "19.80",
      },
      {
        name: "Noah Lyles",
        country: "USA",
        flag: "🇺🇸",
        born: 1997,
        seasons: 9,
        pb: "19.31",
        bib: 1112,
        time: "19.31",
      },
    ],
  },
];

export function DuelGame() {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [msLeft, setMsLeft] = useState(SHOT_CLOCK_MS);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const duel = DUELS[round % DUELS.length]!;
  const revealed = picked !== null || timedOut;
  const correct = picked !== null && picked === duel.winner;
  const champ = duel.athletes[duel.winner];

  useEffect(() => {
    if (revealed) return;
    const end = Date.now() + SHOT_CLOCK_MS;
    setMsLeft(SHOT_CLOCK_MS);
    const tick = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      setMsLeft(left);
      if (left === 0) {
        clearInterval(tick);
        setTimedOut(true);
        setStreak(0);
      }
    }, 50);
    return () => clearInterval(tick);
  }, [round, revealed]);

  function pick(side: number) {
    if (revealed) return;
    setPicked(side);
    if (side === duel.winner) {
      const next = streak + 1;
      setStreak(next);
      setBest((b) => Math.max(b, next));
    } else {
      setStreak(0);
    }
  }

  // hold the verdict on screen, then animate the stage out and swap rounds
  useEffect(() => {
    if (!revealed) return;
    const hold = setTimeout(() => setExiting(true), REVEAL_HOLD_MS);
    return () => clearTimeout(hold);
  }, [revealed]);

  useEffect(() => {
    if (!exiting) return;
    const swap = setTimeout(() => {
      setPicked(null);
      setTimedOut(false);
      setExiting(false);
      setRound((r) => r + 1);
    }, EXIT_MS);
    return () => clearTimeout(swap);
  }, [exiting]);

  return (
    <div className="bg-night text-cream selection:bg-flame selection:text-night relative flex min-h-dvh flex-col overflow-hidden font-mono">
      {/* night sky */}
      <div className="stars pointer-events-none absolute top-0 left-0" />
      <PixelCloud className="top-24 left-[8%] [animation:drift_22s_ease-in-out_infinite]" />
      <PixelCloud className="top-44 right-[12%] [animation:drift_30s_4s_ease-in-out_infinite] opacity-60" />
      <PixelCloud className="top-10 left-[55%] [animation:drift_26s_2s_ease-in-out_infinite] opacity-40" />

      {/* pixel infield + track at the bottom of the scene */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#1f4022_0_12px,transparent_12px_24px)]" />
        <div className="bg-turf h-8 md:h-12" />
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#a14a2b_0_12px,transparent_12px_24px)]" />
        <div className="bg-clay relative h-20 md:h-28">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(to_top,transparent_0_22px,rgba(236,225,200,0.45)_22px,rgba(236,225,200,0.45)_26px)]" />
        </div>
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-10 md:py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <PixelFlame />
          <span className="font-pixel text-cream text-[11px] md:text-sm">
            TRACK<span className="text-flame">DUEL</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <ScoreChip label="STREAK" value={streak > 0 ? `🔥${streak}` : "0"} />
          <ScoreChip label="BEST" value={String(best)} />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-3 pt-2 pb-8 md:px-4 md:pt-6 md:pb-10">
        <div className={exiting ? "[animation:fadeOut_.32s_ease_both]" : ""}>
          {/* race card */}
          <div
            key={`meta-${round}`}
            className="mb-5 [animation:rise_.5s_ease_both] text-center md:mb-8"
          >
            <p className="text-dim mb-2 text-[9px] tracking-[0.4em] md:mb-3 md:text-[11px]">
              ROUND {round + 1} — GUESS WHO WON
            </p>
            <h1 className="font-display text-cream text-xl uppercase md:text-5xl">
              {duel.event}
            </h1>
            <div className="divide-line border-line bg-panel/80 mt-4 inline-flex divide-x border backdrop-blur md:mt-5">
              <MetaCell label="YEAR" value={String(duel.year)} />
              <MetaCell label="STADIUM" value={duel.stadium} />
              <MetaCell label="WIND" value={duel.wind} />
            </div>
          </div>

          {/* shot clock */}
          <ShotClock msLeft={msLeft} revealed={revealed} timedOut={timedOut} />

          {/* the duel — side by side even on mobile so both athletes are always comparable */}
          <div className="relative grid grid-cols-2 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6">
            <AthleteCard
              key={`a0-${round}`}
              athlete={duel.athletes[0]}
              side={0}
              revealed={revealed}
              isWinner={duel.winner === 0}
              isPicked={picked === 0}
              onPick={() => pick(0)}
            />
            <VsBadge key={`vs-${round}`} />
            <AthleteCard
              key={`a1-${round}`}
              athlete={duel.athletes[1]}
              side={1}
              revealed={revealed}
              isWinner={duel.winner === 1}
              isPicked={picked === 1}
              onPick={() => pick(1)}
            />
          </div>

          {/* verdict */}
          <div className="mt-8 flex min-h-24 flex-col items-center gap-4 md:mt-10">
            {revealed ? (
              <>
                <p
                  className={`font-pixel [animation:rise_.4s_ease_both] px-2 text-center text-sm leading-relaxed md:text-2xl ${
                    correct ? "text-gold" : "text-flame"
                  }`}
                >
                  {correct
                    ? "CALLED IT!"
                    : timedOut
                      ? "TOO SLOW!"
                      : "NOT QUITE!"}
                  <span className="text-dim mt-2 block font-mono text-[10px] tracking-[0.2em] md:text-xs">
                    {champ.name.split(" ").pop()?.toUpperCase()} TOOK IT IN{" "}
                    {champ.time}
                  </span>
                </p>
                <div className="flex [animation:rise_.4s_.1s_ease_both] flex-col items-center gap-1.5">
                  <span className="text-dim text-[8px] tracking-[0.4em]">
                    NEXT DUEL
                  </span>
                  <div className="border-line bg-night h-2.5 w-40 border">
                    <div
                      className={
                        correct
                          ? "h-full bg-[repeating-linear-gradient(90deg,#e3b341_0_6px,transparent_6px_9px)]"
                          : "h-full bg-[repeating-linear-gradient(90deg,#c8503c_0_6px,transparent_6px_9px)]"
                      }
                      style={{
                        animation: `drain ${REVEAL_HOLD_MS}ms linear both`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-dim animate-pulse text-center text-[9px] tracking-[0.35em] md:text-xs">
                WHO TOOK THE WIN? PICK AN ATHLETE
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {DUELS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 transition-colors ${
                i === round % DUELS.length
                  ? "bg-flame"
                  : i < round % DUELS.length
                    ? "bg-gold"
                    : "bg-line"
              }`}
            />
          ))}
        </div>
      </main>

      <footer className="text-cream/60 relative z-10 pb-5 text-center text-[8px] tracking-[0.4em] md:pb-6 md:text-[9px]">
        TRACKDUEL — EVERY RACE HAS A WINNER
      </footer>
    </div>
  );
}

function AthleteCard({
  athlete,
  side,
  revealed,
  isWinner,
  isPicked,
  onPick,
}: {
  athlete: Athlete;
  side: 0 | 1;
  revealed: boolean;
  isWinner: boolean;
  isPicked: boolean;
  onPick: () => void;
}) {
  const red = side === 0;
  const lastName = athlete.name.split(" ").pop()?.toUpperCase();

  const hoverCls = revealed
    ? ""
    : "hover:[--pb:#56648a] hover:-translate-y-0.5 active:translate-y-0.5";

  const stateCls = revealed
    ? isWinner
      ? "[--pb:#e3b341]"
      : `scale-[0.98] opacity-60 grayscale-[0.5] ${isPicked ? "[animation:shake_.45s_ease]" : ""}`
    : "";

  return (
    <button
      onClick={onPick}
      disabled={revealed}
      className={`group pixel-border bg-panel relative w-full cursor-pointer touch-manipulation text-left [filter:drop-shadow(4px_4px_0_rgba(0,0,0,0.45))] transition-all duration-150 [--pb:#2c3854] disabled:cursor-default ${hoverCls} ${stateCls} ${
        side === 0
          ? "[animation:rise_.5s_ease_both]"
          : "[animation:rise_.5s_.08s_ease_both]"
      }`}
    >
      {/* portrait: tiny night scene */}
      <div className="bg-night relative flex aspect-square items-center justify-center overflow-hidden md:aspect-[5/4]">
        <span className="bg-cream/40 absolute top-4 left-5 h-1 w-1" />
        <span className="bg-cream/25 absolute top-10 right-8 h-1 w-1" />
        <span className="bg-cream/30 absolute top-6 right-16 h-1 w-1" />

        {/* infield strip */}
        <div className="absolute inset-x-0 bottom-0 h-1/6 bg-[#1f4022]" />
        <div className="absolute inset-x-0 bottom-[16.6%] h-2 bg-[repeating-linear-gradient(90deg,#1f4022_0_8px,transparent_8px_16px)]" />

        <span className="font-pixel text-dim absolute top-2 right-2 text-[8px] md:top-3 md:right-3 md:text-[10px]">
          #{athlete.bib}
        </span>

        <Runner
          flip={!red}
          color={red ? "#c8503c" : "#4e7cd6"}
          className={`relative h-16 w-16 transition-transform duration-300 group-hover:scale-110 md:h-28 md:w-28 ${
            red
              ? "drop-shadow-[0_0_10px_rgba(200,80,60,0.4)]"
              : "drop-shadow-[0_0_10px_rgba(78,124,214,0.4)]"
          }`}
        />

        {revealed && isWinner && (
          <span className="bevel bg-gold font-pixel text-night absolute top-2 left-2 [animation:vsPop_.3s_.15s_steps(3,end)_both] px-1.5 py-1 text-[7px] md:top-3 md:left-3 md:px-2 md:text-[10px]">
            WINNER
          </span>
        )}
      </div>

      {/* name plate */}
      <div className="border-line flex items-center gap-2 border-t px-3 py-2 md:gap-3 md:px-5 md:py-3">
        <span className="text-sm md:text-xl">{athlete.flag}</span>
        <h2 className="font-display text-cream truncate text-xs uppercase md:text-xl">
          {athlete.name}
        </h2>
        <span className="text-dim ml-auto hidden text-[10px] tracking-[0.25em] md:block">
          {athlete.country}
        </span>
      </div>

      {/* stat board */}
      <dl className="divide-line border-line grid grid-cols-1 divide-y border-t md:grid-cols-3 md:divide-x md:divide-y-0">
        <StatCell
          label="PB"
          value={athlete.pb}
          accent={red ? "text-flame" : "text-royal"}
        />
        <StatCell label="SEASONS" value={String(athlete.seasons)} />
        <StatCell label="BORN" value={String(athlete.born)} />
      </dl>

      {/* pick bar / finish time */}
      <div className="border-line relative h-9 overflow-hidden border-t md:h-11">
        {revealed ? (
          <div
            className={`absolute inset-0 flex [animation:rise_.4s_ease_both] items-center justify-center gap-2 md:gap-3 ${
              isWinner ? "bevel bg-gold text-night" : "bg-night text-dim"
            }`}
          >
            <span className="text-[8px] tracking-[0.3em]">
              {isWinner ? "WINNER" : "FINISH"}
            </span>
            <span className="font-pixel text-[9px] md:text-xs">
              {athlete.time}
            </span>
          </div>
        ) : (
          <div
            className={`bevel absolute inset-0 flex items-center justify-center transition-[filter] duration-150 group-hover:brightness-110 ${
              red ? "bg-blaze" : "bg-[#3a5fa8]"
            }`}
          >
            <span className="font-pixel text-cream text-[9px] md:text-[11px]">
              PICK<span className="hidden md:inline"> {lastName}</span> ▸
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function ShotClock({
  msLeft,
  revealed,
  timedOut,
}: {
  msLeft: number;
  revealed: boolean;
  timedOut: boolean;
}) {
  const pct = (msLeft / SHOT_CLOCK_MS) * 100;
  const low = msLeft < 3000;
  const critical = msLeft < 1500 && !revealed;

  return (
    <div className="mx-auto mb-5 w-fit md:mb-8">
      <div className="border-line bg-panel flex items-center gap-3 border px-4 py-2 md:gap-4 md:px-5 md:py-2.5">
        <span className="text-dim text-[8px] tracking-[0.3em] md:text-[9px]">
          {timedOut ? "TIME UP" : "TIME"}
        </span>
        <span
          className={`font-pixel text-sm tabular-nums transition-colors duration-300 md:text-lg ${
            timedOut || (low && !revealed)
              ? "text-flame"
              : revealed
                ? "text-dim"
                : "text-cream"
          } ${critical ? "animate-pulse" : ""}`}
        >
          {(msLeft / 1000).toFixed(2)}
        </span>
        {/* segmented LED-style fuse */}
        <div className="border-line bg-night h-3 w-24 border md:w-40">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${
              low || timedOut
                ? "bg-[repeating-linear-gradient(90deg,#c8503c_0_6px,transparent_6px_9px)]"
                : "bg-[repeating-linear-gradient(90deg,#e3b341_0_6px,transparent_6px_9px)]"
            } ${revealed && !timedOut ? "opacity-40" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function VsBadge() {
  // floats between the cards on mobile; own column on desktop
  return (
    <div className="flex items-center justify-center max-md:pointer-events-none max-md:absolute max-md:top-[26%] max-md:left-1/2 max-md:z-10 max-md:-translate-x-1/2 max-md:-translate-y-1/2 md:relative md:px-2">
      <div className="pixel-border bg-night relative flex h-14 w-14 [animation:vsPop_.35s_steps(4,end)_both] items-center justify-center [filter:drop-shadow(3px_3px_0_rgba(0,0,0,0.45))] [--pb:#2c3854] md:h-24 md:w-24">
        <span className="font-pixel text-gold text-sm [text-shadow:2px_2px_0_#c8503c] md:text-2xl">
          VS
        </span>
      </div>
    </div>
  );
}

function Runner({
  flip,
  color,
  className,
}: {
  flip?: boolean;
  color: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${flip ? "-scale-x-100" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <path
        fill={color}
        d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"
      />
    </svg>
  );
}

function PixelCloud({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute ${className ?? ""}`}
      aria-hidden
    >
      <div className="h-3 w-10 translate-x-3 bg-[#1a2438]" />
      <div className="h-3 w-16 bg-[#1a2438]" />
    </div>
  );
}

function PixelFlame() {
  return (
    <svg
      viewBox="0 0 8 8"
      className="h-4 w-4 md:h-5 md:w-5"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="3" y="0" width="2" height="2" fill="#e3b341" />
      <rect x="2" y="2" width="4" height="2" fill="#c8503c" />
      <rect x="1" y="4" width="6" height="3" fill="#c8503c" />
      <rect x="3" y="4" width="2" height="2" fill="#e3b341" />
    </svg>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line bg-panel min-w-16 border px-3 py-1.5 text-center md:min-w-20 md:px-4 md:py-2">
      <div className="text-dim text-[7px] tracking-[0.3em] md:text-[8px]">
        {label}
      </div>
      <div className="font-pixel text-cream mt-1 text-[10px] md:text-xs">
        {value}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 md:block md:px-4 md:py-2 md:text-center">
      <div className="text-dim text-[8px] tracking-[0.3em] md:text-[9px]">
        {label}
      </div>
      <div
        className={`font-pixel text-[10px] md:mt-1.5 md:text-sm ${accent ?? "text-cream"}`}
      >
        {value}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 text-left md:px-5 md:py-2">
      <div className="text-dim text-[8px] tracking-[0.3em] md:text-[9px]">
        {label}
      </div>
      <div className="text-cream mt-0.5 max-w-32 truncate text-[11px] font-bold whitespace-nowrap md:max-w-none md:text-sm">
        {value}
      </div>
    </div>
  );
}
