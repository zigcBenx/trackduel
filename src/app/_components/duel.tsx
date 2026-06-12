"use client";

import { useEffect, useId, useState } from "react";

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
    <div className="bg-pitch selection:bg-ember relative flex min-h-dvh flex-col overflow-hidden font-sans text-white selection:text-white">
      {/* stadium floodlight + track texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(255,58,36,0.16),transparent_70%)]" />
      <div className="bg-lanes pointer-events-none absolute inset-0" />
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.05]" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-10 md:py-5">
        <div className="flex items-center gap-2 md:gap-3">
          <TrackOval />
          <span className="font-display text-xl tracking-wide italic md:text-2xl">
            TRACK<span className="text-ember">DUEL</span>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono md:gap-3">
          <ScoreChip label="STREAK" value={streak > 0 ? `🔥 ${streak}` : "0"} />
          <ScoreChip label="BEST" value={String(best)} />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-3 pt-2 pb-8 md:px-4 md:pt-8 md:pb-10">
        <div className={exiting ? "[animation:fadeOut_.32s_ease_both]" : ""}>
          {/* race card */}
          <div
            key={`meta-${round}`}
            className="mb-6 [animation:rise_.5s_ease_both] text-center md:mb-10"
          >
            <p className="mb-2 font-mono text-[10px] tracking-[0.35em] text-white/40 md:mb-3 md:text-[11px]">
              ROUND {round + 1} — GUESS WHO WON
            </p>
            <h1 className="font-display text-xl tracking-wide uppercase italic md:text-4xl">
              {duel.event}
            </h1>
            <div className="mt-4 inline-flex divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur md:mt-5">
              <MetaCell label="YEAR" value={String(duel.year)} />
              <MetaCell label="STADIUM" value={duel.stadium} />
              <MetaCell label="WIND" value={duel.wind} />
            </div>
          </div>

          {/* shot clock */}
          <ShotClock msLeft={msLeft} revealed={revealed} timedOut={timedOut} />

          {/* the duel — side by side even on mobile so both athletes are always comparable */}
          <div className="relative grid grid-cols-2 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
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
          <div className="mt-10 flex min-h-24 flex-col items-center gap-4">
            {revealed ? (
              <>
                <p
                  className={`font-display [animation:rise_.4s_ease_both] px-2 text-center text-lg tracking-wide uppercase italic md:text-2xl ${
                    correct ? "text-gold" : "text-ember"
                  }`}
                >
                  {correct
                    ? "Called it."
                    : timedOut
                      ? "Too slow."
                      : "Not quite."}{" "}
                  <span className="text-white/70">
                    {champ.name.split(" ").pop()} took it in {champ.time}
                  </span>
                </p>
                <div className="flex [animation:rise_.4s_.1s_ease_both] flex-col items-center gap-2">
                  <span className="font-mono text-[9px] tracking-[0.35em] text-white/30">
                    NEXT DUEL
                  </span>
                  <div className="h-0.5 w-36 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={correct ? "bg-gold h-full" : "bg-ember h-full"}
                      style={{
                        animation: `drain ${REVEAL_HOLD_MS}ms linear both`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="animate-pulse text-center font-mono text-[10px] tracking-[0.35em] text-white/35 md:text-xs">
                WHO TOOK THE WIN? PICK AN ATHLETE
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {DUELS.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-8 rounded-full transition-colors ${
                i === round % DUELS.length
                  ? "bg-ember"
                  : i < round % DUELS.length
                    ? "bg-white/40"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </main>

      <footer className="relative z-10 pb-5 text-center font-mono text-[9px] tracking-[0.3em] text-white/25 md:pb-6 md:text-[10px] md:tracking-[0.4em]">
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
  const ember = side === 0;
  const lastName = athlete.name.split(" ").pop();

  const hoverCls = revealed
    ? ""
    : ember
      ? "active:scale-[0.97] hover:-translate-y-1 hover:border-ember/50 hover:shadow-[0_0_70px_-14px_rgba(255,58,36,0.55)]"
      : "active:scale-[0.97] hover:-translate-y-1 hover:border-volt/50 hover:shadow-[0_0_70px_-14px_rgba(43,217,255,0.5)]";

  const stateCls = revealed
    ? isWinner
      ? "border-gold/70 shadow-[0_0_90px_-18px_rgba(255,198,46,0.5)]"
      : `scale-[0.97] opacity-55 saturate-[0.4] ${isPicked ? "[animation:shake_.45s_ease]" : ""}`
    : "";

  return (
    <button
      onClick={onPick}
      disabled={revealed}
      className={`group relative w-full cursor-pointer touch-manipulation overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-left backdrop-blur transition-all duration-500 disabled:cursor-default md:rounded-2xl ${hoverCls} ${stateCls} ${
        side === 0
          ? "[animation:rise_.5s_ease_both]"
          : "[animation:rise_.5s_.08s_ease_both]"
      }`}
    >
      {/* portrait area */}
      <div className="relative flex aspect-square items-center justify-center overflow-hidden md:aspect-[5/4]">
        <div
          className={`absolute inset-0 ${
            ember
              ? "bg-[radial-gradient(80%_70%_at_50%_30%,rgba(255,58,36,0.22),transparent_70%)]"
              : "bg-[radial-gradient(80%_70%_at_50%_30%,rgba(43,217,255,0.18),transparent_70%)]"
          }`}
        />
        <div className="bg-lanes absolute inset-0 opacity-60" />

        {/* bib number watermark */}
        <span className="font-display pointer-events-none absolute -top-2 -right-1 text-[4.5rem] leading-none text-white/[0.05] italic select-none md:-top-4 md:-right-2 md:text-[8.5rem]">
          {athlete.bib}
        </span>

        {/* speed lines */}
        <div
          className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-3 transition-all duration-300 ${
            ember
              ? "right-[68%] items-end group-hover:-translate-x-2"
              : "left-[68%] items-start group-hover:translate-x-2"
          } opacity-0 group-hover:opacity-100`}
        >
          <span className="h-0.5 w-16 bg-white/20" />
          <span className="h-0.5 w-10 bg-white/15" />
          <span className="h-0.5 w-6 bg-white/10" />
        </div>

        <Runner
          flip={!ember}
          from={ember ? "#ffb199" : "#bdf3ff"}
          to={ember ? "#ff3a24" : "#2bd9ff"}
          className={`relative h-24 w-24 transition-transform duration-500 group-hover:scale-105 md:h-48 md:w-48 ${
            ember
              ? "drop-shadow-[0_0_28px_rgba(255,58,36,0.45)]"
              : "drop-shadow-[0_0_28px_rgba(43,217,255,0.4)]"
          }`}
        />

        <div className="from-pitch/80 absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />

        {revealed && isWinner && (
          <span className="bg-gold font-display absolute top-2 left-2 -rotate-6 [animation:vsPop_.5s_.15s_cubic-bezier(.2,1.4,.4,1)_both] px-2 py-0.5 text-[10px] tracking-[0.25em] text-black uppercase md:top-4 md:left-4 md:px-3 md:py-1 md:text-sm">
            Winner
          </span>
        )}
      </div>

      {/* name plate */}
      <div className="flex items-baseline gap-2 px-3 pt-2.5 pb-2 md:gap-3 md:px-5 md:pt-4 md:pb-3">
        <span className="text-base md:text-2xl">{athlete.flag}</span>
        <h2 className="font-display truncate text-sm tracking-wide uppercase italic md:text-2xl">
          {athlete.name}
        </h2>
        <span className="ml-auto hidden font-mono text-xs tracking-[0.25em] text-white/35 md:block">
          {athlete.country}
        </span>
      </div>

      {/* stat board */}
      <dl className="grid grid-cols-1 gap-px border-t border-white/10 bg-white/10 md:grid-cols-3">
        <StatCell
          label="PB"
          value={athlete.pb}
          accent={ember ? "text-ember" : "text-volt"}
        />
        <StatCell label="SEASONS" value={String(athlete.seasons)} />
        <StatCell label="BORN" value={String(athlete.born)} />
      </dl>

      {/* pick bar / finish time */}
      <div className="relative h-9 overflow-hidden border-t border-white/10 md:h-10">
        {revealed ? (
          <div
            className={`absolute inset-0 flex [animation:rise_.4s_ease_both] items-center justify-center gap-2 font-mono tabular-nums md:gap-3 ${
              isWinner ? "bg-gold font-bold text-black" : "text-white/60"
            }`}
          >
            <span className="text-[8px] tracking-[0.3em] md:text-[9px]">
              {isWinner ? "WINNER" : "FINISH"}
            </span>
            <span className="text-sm md:text-base">{athlete.time}</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 hidden items-center justify-center font-mono text-[10px] tracking-[0.35em] text-white/30 md:flex">
              TAP TO PICK
            </div>
            {/* always visible on touch screens — there is no hover to reveal it */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-y-0 max-md:translate-y-0 md:translate-y-full ${
                ember ? "bg-ember" : "bg-volt"
              }`}
            >
              <span className="font-display text-[11px] tracking-[0.2em] text-black uppercase md:text-sm">
                Pick<span className="hidden md:inline"> {lastName} to win</span>{" "}
                ▸
              </span>
            </div>
          </>
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
    <div className="mx-auto mb-5 max-w-md md:mb-8">
      <div className="flex items-baseline justify-center gap-3 font-mono">
        <span className="text-[9px] tracking-[0.35em] text-white/35">
          {timedOut ? "TIME UP" : "DECIDE IN"}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums transition-colors duration-300 md:text-3xl ${
            timedOut
              ? "text-ember"
              : revealed
                ? "text-white/40"
                : low
                  ? "text-ember"
                  : "text-white"
          } ${critical ? "animate-pulse" : ""}`}
        >
          {(msLeft / 1000).toFixed(2)}
        </span>
      </div>
      {/* drains symmetrically toward the center, like a closing photo-finish gate */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`mx-auto h-full rounded-full transition-[width,background-color] duration-100 ease-linear ${
            low || timedOut ? "bg-ember" : "bg-volt"
          } ${revealed && !timedOut ? "opacity-40" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function VsBadge() {
  // floats as a chip between the cards on mobile; sits in its own column on desktop
  return (
    <div className="flex items-center justify-center max-md:pointer-events-none max-md:absolute max-md:top-[26%] max-md:left-1/2 max-md:z-10 max-md:-translate-x-1/2 max-md:-translate-y-1/2 md:relative md:px-4">
      {/* photo-finish line */}
      <div className="absolute -inset-y-10 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent md:block" />
      <div className="font-display max-md:bg-pitch/85 relative flex [animation:vsPop_.6s_.15s_cubic-bezier(.2,1.4,.4,1)_both] items-center justify-center max-md:h-14 max-md:w-14 max-md:rounded-full max-md:border max-md:border-white/15 max-md:backdrop-blur">
        <span
          aria-hidden
          className="text-ember/60 absolute inset-0 flex items-center justify-center blur-2xl select-none"
        >
          <span className="text-2xl italic md:text-7xl">VS</span>
        </span>
        <span className="relative bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-2xl text-transparent italic md:text-7xl">
          VS
        </span>
      </div>
    </div>
  );
}

function Runner({
  flip,
  from,
  to,
  className,
}: {
  flip?: boolean;
  from: string;
  to: string;
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${flip ? "-scale-x-100" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"
      />
    </svg>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-16 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center backdrop-blur md:min-w-20 md:px-4 md:py-2">
      <div className="text-[8px] tracking-[0.3em] text-white/40 md:text-[9px]">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums md:text-base">{value}</div>
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
    <div className="flex items-center justify-between bg-[#0c0c11] px-3 py-1.5 md:block md:px-4 md:py-3 md:text-center">
      <div className="font-mono text-[8px] tracking-[0.3em] text-white/35 md:text-[9px]">
        {label}
      </div>
      <div
        className={`font-mono text-sm font-bold tabular-nums md:mt-1 md:text-lg ${accent ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 text-left md:px-5 md:py-2.5">
      <div className="font-mono text-[8px] tracking-[0.3em] text-white/35 md:text-[9px]">
        {label}
      </div>
      <div className="mt-0.5 max-w-32 truncate font-mono text-xs whitespace-nowrap md:max-w-none md:text-sm">
        {value}
      </div>
    </div>
  );
}

function TrackOval() {
  return (
    <svg viewBox="0 0 36 22" className="h-5 w-7 md:h-6 md:w-9" aria-hidden>
      <ellipse
        cx="18"
        cy="11"
        rx="16"
        ry="9"
        fill="none"
        stroke="#ff3a24"
        strokeWidth="2"
      />
      <ellipse
        cx="18"
        cy="11"
        rx="10"
        ry="4.5"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
