"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LogoMark } from "~/app/_components/logo-mark";
import { gameAudio } from "~/lib/audio";
import { multiplierFor, RUN_LIVES } from "~/lib/scoring";
import { api, type RouterOutputs } from "~/trpc/react";

const SHOT_CLOCK_MS = 7000;
const REVEAL_HOLD_MS = 2200;
const EXIT_MS = 320;
const BATCH_SIZE = 10;

type DuelView = RouterOutputs["duel"]["getBatch"][number];
type PublicAthlete = DuelView["athleteA"];
type RevealResult = RouterOutputs["duel"]["reveal"];

type SessionUser = { name: string; image: string | null };

export function DuelGame({ user }: { user: SessionUser | null }) {
  const [round, setRound] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [result, setResult] = useState<RevealResult | null>(null);
  const [revealFailed, setRevealFailed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [msLeft, setMsLeft] = useState(SHOT_CLOCK_MS);
  const [streak, setStreak] = useState(0);
  const [hiScore, setHiScore] = useState(0);
  // transient reveal effects; `seq` re-keys elements so animations replay
  const [fx, setFx] = useState<{
    seq: number;
    points: number;
    correct: boolean;
    comboTier: number | null; // multiplier just unlocked (1.5/2/3), else null
  } | null>(null);
  const fxSeq = useRef(0);
  const restartGuard = useRef(false); // prevents double PLAY AGAIN
  const [muted, setMuted] = useState(false);
  // run = one game; ends at 0 lives, then a high-score summary
  const [runId, setRunId] = useState<string | null>(null);
  const [lives, setLives] = useState(RUN_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [run, setRun] = useState({ duels: 0, points: 0, bestStreak: 0 });
  const [endData, setEndData] = useState<{ score: number; newHigh: boolean }>({
    score: 0,
    newHigh: false,
  });

  // run id is generated client-side so it can't cause an SSR hydration mismatch
  useEffect(() => {
    if (!runId) setRunId(crypto.randomUUID());
  }, [runId]);

  // ambient music: start on the first user gesture (autoplay policy), stop on
  // unmount. The mute toggle reflects the persisted preference.
  useEffect(() => {
    gameAudio.initFromStorage();
    setMuted(gameAudio.muted);
    const start = () => gameAudio.startAmbient();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      gameAudio.stopAmbient();
    };
  }, []);

  // crowd roar when a run ends
  useEffect(() => {
    if (gameOver) gameAudio.cheer();
  }, [gameOver]);

  const batchQuery = api.duel.getBatch.useQuery(
    { count: BATCH_SIZE, runId: runId ?? undefined },
    { staleTime: Infinity, refetchOnWindowFocus: false, enabled: !!runId },
  );
  const { refetch: refetchBatch } = batchQuery;

  // all-time high score for the HI display (logged-in only)
  const meQuery = api.duel.me.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const { refetch: refetchMe } = meQuery;
  const me = meQuery.data;
  useEffect(() => {
    if (me) setHiScore(me.highScore);
  }, [me]);

  const reveal = api.duel.reveal.useMutation({
    onSuccess: (res) => {
      setRevealFailed(false);
      setResult(res);

      const nextStreak = res.streak ?? (res.correct ? streak + 1 : 0);
      const tierBefore = multiplierFor(streak);
      const tierAfter = multiplierFor(nextStreak);
      setStreak(nextStreak);

      setRun((r) => ({
        duels: r.duels + 1,
        points: r.points + res.points,
        bestStreak: Math.max(r.bestStreak, nextStreak),
      }));
      // server is authoritative on lives when logged in; else decrement locally
      if (res.lives !== null) setLives(res.lives);
      else if (!res.correct) setLives((l) => Math.max(0, l - 1));

      fxSeq.current += 1;
      setFx({
        seq: fxSeq.current,
        points: res.points,
        correct: res.correct,
        comboTier: tierAfter > tierBefore ? tierAfter : null,
      });
    },
    onError: () => setRevealFailed(true),
  });
  const { mutate: revealMutate } = reveal;

  const batch = batchQuery.data;
  const duel = batch?.[round];
  const locked = picked !== null || timedOut; // shot clock stops here
  const revealed = result !== null; // winner/times known (server answered)
  const correct = result?.correct ?? false;
  const champ = result
    ? result.winnerSide === 0
      ? duel?.athleteA
      : duel?.athleteB
    : undefined;

  // shot clock
  useEffect(() => {
    if (!duel || locked) return;
    const end = Date.now() + SHOT_CLOCK_MS;
    setMsLeft(SHOT_CLOCK_MS);
    const duelId = duel.id;
    const tick = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      setMsLeft(left);
      if (left === 0) {
        clearInterval(tick);
        setTimedOut(true);
        revealMutate({ duelId, pick: null, runId: runId ?? undefined });
      }
    }, 50);
    return () => clearInterval(tick);
  }, [duel, locked, revealMutate, runId]);

  function pick(side: 0 | 1) {
    if (!duel || locked) return;
    setPicked(side);
    revealMutate({ duelId: duel.id, pick: side, runId: runId ?? undefined });
  }

  function retryReveal() {
    if (!duel) return;
    setRevealFailed(false);
    revealMutate({ duelId: duel.id, pick: picked, runId: runId ?? undefined });
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
      // out of lives → end the run on the high-score summary
      if (lives <= 0) {
        const score = Math.max(0, run.points);
        setEndData({ score, newHigh: score > hiScore && score > 0 });
        setHiScore((h) => Math.max(h, score));
        setExiting(false);
        restartGuard.current = false; // arm PLAY AGAIN for this game-over
        setGameOver(true);
        if (user) void refetchMe();
        return;
      }
      setPicked(null);
      setTimedOut(false);
      setResult(null);
      setFx(null);
      setExiting(false);
      setRoundsPlayed((n) => n + 1);
      const next = round + 1;
      if (!batch || next >= batch.length) {
        setLoadingNext(true);
        void refetchBatch().then(() => {
          setRound(0);
          setLoadingNext(false);
        });
      } else {
        setRound(next);
      }
    }, EXIT_MS);
    return () => clearTimeout(swap);
  }, [
    exiting,
    lives,
    run,
    hiScore,
    user,
    round,
    batch,
    refetchBatch,
    refetchMe,
  ]);

  function startNewRun() {
    if (restartGuard.current) return; // swallow double-clicks
    restartGuard.current = true;
    setGameOver(false);
    setLives(RUN_LIVES);
    setRun({ duels: 0, points: 0, bestStreak: 0 });
    setStreak(0);
    setPicked(null);
    setTimedOut(false);
    setResult(null);
    setFx(null);
    setExiting(false);
    setRoundsPlayed(0);
    setRound(0);
    setRunId(crypto.randomUUID()); // new run id → getBatch refetches a fresh pool
  }

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

      {/* full-bleed tint flash on a correct guess (brighter on a combo) */}
      {fx?.correct && (
        <div
          key={`flash-${fx.seq}`}
          className={`pointer-events-none absolute inset-0 z-30 [animation:screenFlash_.5s_ease-out_both] ${
            fx.comboTier ? "bg-gold/25" : "bg-gold/10"
          }`}
        />
      )}

      <header className="relative z-10 flex flex-col items-center gap-3 px-3 py-3 md:gap-4 md:py-5">
        {/* brand on top */}
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <LogoMark />
          <span className="font-pixel text-cream text-sm md:text-lg">
            TRACK<span className="text-flame">DUEL</span>
          </span>
        </Link>

        {/* HUD */}
        <div className="flex items-center justify-center gap-1.5 md:gap-3">
          <Lives lives={lives} />
          <ScoreChip
            label="SCORE"
            value={String(Math.max(0, run.points))}
            punch
          />
          <ScoreChip
            label="STREAK"
            punch
            accent={multiplierFor(streak) > 1 ? "text-gold" : undefined}
            value={
              streak > 0
                ? `🔥${streak}${multiplierFor(streak) > 1 ? ` ×${multiplierFor(streak)}` : ""}`
                : "0"
            }
          />
          {user && (
            <ScoreChip
              label="HI"
              value={String(hiScore)}
              accent="text-gold"
              className="max-md:hidden"
            />
          )}
          <button
            onClick={() => {
              const next = !muted;
              gameAudio.setMuted(next);
              setMuted(next);
              if (!next) gameAudio.startAmbient(); // unmuting counts as a gesture
            }}
            title={muted ? "Unmute" : "Mute"}
            className="border-line bg-panel press hover:border-gold/70 flex shrink-0 items-center self-stretch border px-2 transition-colors md:px-3"
          >
            <PixelSpeaker muted={muted} />
          </button>
          <Link
            href="/leaderboard"
            title="Leaderboard"
            className="border-line bg-panel press hover:border-gold/70 flex shrink-0 items-center self-stretch border px-2 transition-colors md:px-3"
          >
            <PixelTrophy />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-3 pt-2 pb-8 md:px-4 md:pt-6 md:pb-10">
        {batchQuery.isPending || loadingNext ? (
          <StatusScreen text="LOADING DUELS…" pulse />
        ) : batchQuery.isError ? (
          <StatusScreen
            text="CONNECTION LOST"
            actionLabel="RETRY ▸"
            onAction={() => void refetchBatch()}
          />
        ) : !duel ? (
          <StatusScreen
            text="NO DUELS IN THE VAULT"
            sub="SEED THE DATABASE: npm run db:seed"
          />
        ) : (
          <>
            <div
              className={exiting ? "[animation:fadeOut_.32s_ease_both]" : ""}
            >
              {/* race card */}
              <div
                key={`meta-${duel.id}`}
                className="mb-5 [animation:rise_.5s_ease_both] text-center md:mb-8"
              >
                <p className="text-dim mb-2 text-[9px] tracking-[0.4em] md:mb-3 md:text-[11px]">
                  ROUND {roundsPlayed + 1} — GUESS WHO WON
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
              <ShotClock
                msLeft={msLeft}
                locked={locked}
                revealed={revealed}
                timedOut={timedOut}
              />

              {/* the duel — side by side even on mobile so both athletes are always comparable */}
              <div className="relative grid grid-cols-2 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6">
                <AthleteCard
                  key={`a0-${duel.id}`}
                  athlete={duel.athleteA}
                  side={0}
                  locked={locked}
                  revealed={revealed}
                  isWinner={result?.winnerSide === 0}
                  isPicked={picked === 0}
                  time={result?.times[0]}
                  onPick={() => pick(0)}
                />
                <VsBadge key={`vs-${duel.id}`} />
                <AthleteCard
                  key={`a1-${duel.id}`}
                  athlete={duel.athleteB}
                  side={1}
                  locked={locked}
                  revealed={revealed}
                  isWinner={result?.winnerSide === 1}
                  isPicked={picked === 1}
                  time={result?.times[1]}
                  onPick={() => pick(1)}
                />

                {/* floating score that leaps off the result */}
                {fx && (fx.points !== 0 || !fx.correct) && (
                  <span
                    key={`score-${fx.seq}`}
                    className={`font-pixel pointer-events-none absolute top-[34%] left-1/2 z-20 [animation:floatScore_1.2s_ease-out_both] text-2xl [text-shadow:2px_2px_0_#2b1d16] md:text-4xl ${
                      fx.correct ? "text-gold" : "text-flame"
                    }`}
                  >
                    {fx.points > 0
                      ? `+${fx.points}`
                      : fx.points < 0
                        ? fx.points
                        : "MISS"}
                  </span>
                )}

                {/* combo banner when a multiplier tier unlocks */}
                {fx?.comboTier && (
                  <span
                    key={`combo-${fx.seq}`}
                    className="font-pixel text-gold pointer-events-none absolute top-0 left-1/2 z-20 [animation:comboPop_1.5s_ease-out_both] text-sm whitespace-nowrap [text-shadow:2px_2px_0_#c8503c] md:text-xl"
                  >
                    🔥 ×{fx.comboTier} COMBO!
                  </span>
                )}
              </div>

              {/* verdict */}
              <div className="mt-8 flex min-h-24 flex-col items-center gap-4 md:mt-10">
                {revealFailed ? (
                  <>
                    <p className="font-pixel text-flame text-center text-sm md:text-lg">
                      CONNECTION LOST
                    </p>
                    <button
                      onClick={retryReveal}
                      disabled={reveal.isPending}
                      className="bevel press bg-blaze font-pixel text-cream cursor-pointer px-4 py-2 text-[10px] hover:brightness-110 md:text-xs"
                    >
                      {reveal.isPending ? "…" : "RETRY ▸"}
                    </button>
                  </>
                ) : revealed && result ? (
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
                      {result.points !== 0 &&
                        ` ${result.points > 0 ? `+${result.points}` : result.points}`}
                      <span className="text-dim mt-2 block font-mono text-[10px] tracking-[0.2em] md:text-xs">
                        {result.repeat && "RERUN, NO POINTS — "}
                        {champ?.name.split(" ").pop()?.toUpperCase()} TOOK IT IN{" "}
                        {result.times[result.winnerSide]}
                      </span>
                    </p>
                    <div className="flex [animation:rise_.4s_.1s_ease_both] flex-col items-center gap-1.5">
                      <span
                        className={`text-[8px] tracking-[0.4em] ${lives <= 0 ? "text-flame" : "text-dim"}`}
                      >
                        {lives <= 0 ? "RUN OVER" : "NEXT DUEL"}
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
                ) : locked ? (
                  <p className="text-dim animate-pulse text-center text-[9px] tracking-[0.35em] md:text-xs">
                    PHOTO FINISH…
                  </p>
                ) : (
                  <p className="text-dim animate-pulse text-center text-[9px] tracking-[0.35em] md:text-xs">
                    WHO TOOK THE WIN? PICK AN ATHLETE
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              {batch?.map((b, i) => (
                <span
                  key={b.id}
                  className={`h-2 w-2 transition-colors ${
                    i === round ? "bg-flame" : i < round ? "bg-gold" : "bg-line"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {gameOver && (
        <GameOver
          score={endData.score}
          hiScore={hiScore}
          newHigh={endData.newHigh}
          run={run}
          loggedIn={!!user}
          runId={runId}
          onPlayAgain={startNewRun}
        />
      )}

      <footer className="text-cream/60 relative z-10 pb-4 text-center text-[8px] tracking-[0.4em] md:pb-6 md:text-[9px]">
        TRACKDUEL — trackwrapped product
      </footer>
    </div>
  );
}

function Lives({ lives }: { lives: number }) {
  return (
    <div
      className="border-line bg-panel flex shrink-0 items-center gap-0.5 self-stretch border px-2 md:gap-1 md:px-3"
      title={`${lives} lives left`}
    >
      {Array.from({ length: RUN_LIVES }).map((_, i) => (
        <PixelHeart key={i} full={i < lives} />
      ))}
    </div>
  );
}

function PixelHeart({ full }: { full: boolean }) {
  return (
    <svg
      viewBox="0 0 8 7"
      className={`h-3 w-3 md:h-3.5 md:w-3.5 ${full ? "" : "opacity-30"}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g fill={full ? "#c8503c" : "#2c3854"}>
        <rect x="1" y="1" width="2" height="1" />
        <rect x="5" y="1" width="2" height="1" />
        <rect x="0" y="2" width="8" height="2" />
        <rect x="1" y="4" width="6" height="1" />
        <rect x="2" y="5" width="4" height="1" />
        <rect x="3" y="6" width="2" height="1" />
      </g>
    </svg>
  );
}

function GameOver({
  score,
  hiScore,
  newHigh,
  run,
  loggedIn,
  runId,
  onPlayAgain,
}: {
  score: number;
  hiScore: number;
  newHigh: boolean;
  run: { duels: number; points: number; bestStreak: number };
  loggedIn: boolean;
  runId: string | null;
  onPlayAgain: () => void;
}) {
  return (
    <div className="bg-night/85 absolute inset-0 z-40 flex [animation:rise_.3s_ease_both] items-center justify-center px-4 backdrop-blur-sm">
      {newHigh && <PixelFireworks />}
      <div className="pixel-border bg-panel relative z-10 w-full max-w-sm p-6 text-center [filter:drop-shadow(5px_6px_0_rgba(0,0,0,0.5))] [--pb:#2c3854] md:p-8">
        <p className="text-dim text-[9px] tracking-[0.4em]">GAME OVER</p>

        {newHigh ? (
          <h2 className="font-display text-gold mt-2 [animation:vsPop_.4s_.1s_steps(4,end)_both] text-3xl uppercase md:text-4xl">
            New High Score!
          </h2>
        ) : (
          <h2 className="font-display text-cream mt-2 text-3xl uppercase md:text-4xl">
            Final Score
          </h2>
        )}

        <p
          className={`font-pixel mt-4 text-5xl md:text-6xl ${newHigh ? "text-gold" : "text-cream"}`}
        >
          {score}
        </p>
        {loggedIn && (
          <p className="text-dim mt-2 text-[9px] tracking-[0.3em]">
            HIGH SCORE {hiScore}
          </p>
        )}

        <dl className="divide-line border-line mt-6 grid grid-cols-2 divide-x border">
          <RunStat label="DUELS" value={String(run.duels)} />
          <RunStat
            label="BEST STREAK"
            value={`🔥${run.bestStreak}`}
            accent="text-gold"
          />
        </dl>

        {/* loss-aversion sign-up for anonymous players */}
        {!loggedIn && score > 0 && (
          <div className="border-flame/60 bg-flame/10 mt-6 [animation:rise_.4s_.15s_ease_both] border border-dashed p-4">
            <p className="font-pixel text-flame text-[10px] leading-relaxed">
              DON&apos;T LOSE YOUR {score}!
            </p>
            <p className="text-dim mt-2 text-[9px] leading-relaxed tracking-[0.15em]">
              This score vanishes when you leave. Create a free account to lock
              it in and enter the rankings.
            </p>
            <Link
              href="/login?new=1"
              onClick={() => {
                // remembered across the auth redirect; claimed once signed in
                if (runId) localStorage.setItem("td_claim_run", runId);
              }}
              className="bevel press bg-gold font-pixel text-night mt-3 flex w-full items-center justify-center px-4 py-3 text-[10px] transition-[filter] hover:brightness-105"
            >
              ★ SAVE MY SCORE
            </Link>
          </div>
        )}

        <button
          onClick={onPlayAgain}
          className="bevel press bg-blaze font-pixel text-cream mt-4 w-full px-6 py-4 text-sm transition-[filter] hover:brightness-110 md:text-base"
        >
          ▶ PLAY AGAIN
        </button>

        <div className="mt-4 flex items-center justify-center gap-5">
          <Link
            href="/leaderboard"
            className="text-dim hover:text-cream text-[9px] tracking-[0.25em] transition-colors"
          >
            🏆 LEADERBOARD
          </Link>
          <Link
            href="/"
            className="text-dim hover:text-cream text-[9px] tracking-[0.25em] transition-colors"
          >
            ◂ MENU
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Pixel fireworks that frame the game-over panel on a new personal record.
 * Bursts loop with staggered delays; the panel sits above (z-10) so they
 * frame it rather than cover the text. */
function PixelFireworks() {
  const bursts = [
    { x: "14%", y: "16%", color: "#e3b341", delay: 0 },
    { x: "84%", y: "13%", color: "#c8503c", delay: 0.45 },
    { x: "50%", y: "8%", color: "#ece1c8", delay: 0.9 },
    { x: "22%", y: "84%", color: "#4e7cd6", delay: 1.3 },
    { x: "80%", y: "82%", color: "#e3b341", delay: 1.7 },
  ];
  const PARTICLES = 12;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {bursts.map((b, bi) => (
        <div key={bi} className="absolute" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: PARTICLES }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / PARTICLES;
            const radius = 24 + (i % 3) * 7;
            return (
              <span
                key={i}
                className="absolute h-1 w-1 md:h-1.5 md:w-1.5"
                style={{
                  backgroundColor: b.color,
                  ["--dx" as string]: `${Math.round(Math.cos(angle) * radius)}px`,
                  ["--dy" as string]: `${Math.round(Math.sin(angle) * radius)}px`,
                  animation: `fireworkParticle 2s ${b.delay}s ease-out infinite`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RunStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-night px-2 py-3">
      <div className="text-dim text-[7px] tracking-[0.25em] md:text-[8px]">
        {label}
      </div>
      <div
        className={`font-pixel mt-1.5 text-xs md:text-sm ${accent ?? "text-cream"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusScreen({
  text,
  sub,
  pulse,
  actionLabel,
  onAction,
}: {
  text: string;
  sub?: string;
  pulse?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <p
        className={`font-pixel text-cream text-center text-xs md:text-sm ${pulse ? "animate-pulse" : ""}`}
      >
        {text}
      </p>
      {sub && (
        <p className="text-dim text-center text-[9px] tracking-[0.3em]">
          {sub}
        </p>
      )}
      {onAction && (
        <button
          onClick={onAction}
          className="bevel press bg-blaze font-pixel text-cream cursor-pointer px-4 py-2 text-[10px] hover:brightness-110 md:text-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function AthleteCard({
  athlete,
  side,
  locked,
  revealed,
  isWinner,
  isPicked,
  time,
  onPick,
}: {
  athlete: PublicAthlete;
  side: 0 | 1;
  locked: boolean;
  revealed: boolean;
  isWinner: boolean;
  isPicked: boolean;
  time?: string;
  onPick: () => void;
}) {
  const red = side === 0;
  const lastName = athlete.name.split(" ").pop()?.toUpperCase();

  const hoverCls = locked
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
      disabled={locked}
      className={`group pixel-border bg-panel relative w-full cursor-pointer touch-manipulation text-left [filter:drop-shadow(4px_4px_0_rgba(0,0,0,0.45))] transition-all duration-150 [--pb:#2c3854] disabled:cursor-default ${hoverCls} ${stateCls} ${
        side === 0
          ? "[animation:rise_.5s_ease_both]"
          : "[animation:rise_.5s_.08s_ease_both]"
      }`}
    >
      {/* winner blowout flash */}
      {revealed && isWinner && (
        <div className="bg-cream pointer-events-none absolute inset-0 z-20 [animation:flashWin_.45s_ease-out_both]" />
      )}

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

        <AthletePortrait athlete={athlete} red={red} />

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
            <span className="font-pixel text-[9px] md:text-xs">{time}</span>
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
  locked,
  revealed,
  timedOut,
}: {
  msLeft: number;
  locked: boolean;
  revealed: boolean;
  timedOut: boolean;
}) {
  const pct = (msLeft / SHOT_CLOCK_MS) * 100;
  const low = msLeft < 3000;
  const critical = msLeft < 1500 && !locked;

  return (
    <div className="mx-auto mb-5 w-fit md:mb-8">
      <div className="border-line bg-panel flex items-center gap-3 border px-4 py-2 md:gap-4 md:px-5 md:py-2.5">
        <span className="text-dim text-[8px] tracking-[0.3em] md:text-[9px]">
          {timedOut ? "TIME UP" : "TIME"}
        </span>
        <span
          className={`font-pixel text-sm tabular-nums transition-colors duration-300 md:text-lg ${
            timedOut || (low && !locked)
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

/** Real headshot from the World Athletics CDN, rendered small and upscaled
 * with pixelated sampling so photos read as 8-bit mugshots. Falls back to
 * the runner sprite when an athlete has no photo. */
function AthletePortrait({
  athlete,
  red,
}: {
  athlete: PublicAthlete;
  red: boolean;
}) {
  const [failed, setFailed] = useState(false);

  const glow = red
    ? "drop-shadow-[0_0_10px_rgba(200,80,60,0.4)]"
    : "drop-shadow-[0_0_10px_rgba(78,124,214,0.4)]";

  if (!athlete.waId || failed) {
    return (
      <Runner
        flip={!red}
        color={red ? "#c8503c" : "#4e7cd6"}
        className={`relative h-16 w-16 transition-transform duration-300 group-hover:scale-110 md:h-28 md:w-28 ${glow}`}
      />
    );
  }

  return (
    <div
      className={`relative h-20 w-20 overflow-hidden border-2 transition-transform duration-300 group-hover:scale-105 md:h-36 md:w-36 ${glow} ${
        red ? "border-flame/60" : "border-royal/60"
      }`}
    >
      <Image
        src={`https://media.aws.iaaf.org/athletes/${athlete.waId}.jpg`}
        alt={athlete.name}
        width={72}
        height={72}
        className="h-full w-full object-cover [image-rendering:pixelated]"
        onError={() => setFailed(true)}
      />
      {/* night tint so photos sit in the palette */}
      <div className="bg-night/20 pointer-events-none absolute inset-0 mix-blend-multiply" />
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

function PixelTrophy() {
  return (
    <svg
      viewBox="0 0 8 8"
      className="h-4 w-4 md:h-5 md:w-5"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="1" y="0" width="6" height="1" fill="#e3b341" />
      <rect x="0" y="1" width="1" height="2" fill="#e3b341" />
      <rect x="7" y="1" width="1" height="2" fill="#e3b341" />
      <rect x="2" y="1" width="4" height="2" fill="#e3b341" />
      <rect x="3" y="3" width="2" height="2" fill="#e3b341" />
      <rect x="2" y="5" width="4" height="1" fill="#e3b341" />
      <rect x="1" y="6" width="6" height="1" fill="#e3b341" />
    </svg>
  );
}

function PixelSpeaker({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 8 8"
      className="h-4 w-4 md:h-5 md:w-5"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* speaker body */}
      <g fill={muted ? "#8b94aa" : "#ece1c8"}>
        <rect x="0" y="3" width="2" height="2" />
        <rect x="2" y="2" width="1" height="4" />
        <rect x="3" y="1" width="1" height="6" />
      </g>
      {muted ? (
        // mute cross
        <g fill="#c8503c">
          <rect x="5" y="2" width="1" height="1" />
          <rect x="6" y="3" width="1" height="1" />
          <rect x="7" y="4" width="1" height="1" />
          <rect x="6" y="5" width="1" height="1" />
          <rect x="5" y="6" width="1" height="1" />
          <rect x="7" y="2" width="1" height="1" />
          <rect x="5" y="4" width="1" height="1" />
          <rect x="7" y="6" width="1" height="1" />
        </g>
      ) : (
        // sound waves
        <g fill="#e3b341">
          <rect x="5" y="3" width="1" height="2" />
          <rect x="6" y="2" width="1" height="4" />
          <rect x="7" y="1" width="1" height="6" />
        </g>
      )}
    </svg>
  );
}

function ScoreChip({
  label,
  value,
  className,
  punch,
  accent,
}: {
  label: string;
  value: string;
  className?: string;
  /** replay a snap animation whenever `value` changes */
  punch?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={`border-line bg-panel min-w-0 shrink-0 border px-2 py-1 text-center md:min-w-20 md:px-4 md:py-2 ${className ?? ""}`}
    >
      <div className="text-dim text-[7px] tracking-[0.2em] md:text-[8px] md:tracking-[0.3em]">
        {label}
      </div>
      <div
        // re-key on value change so the punch animation replays
        key={punch ? value : undefined}
        className={`font-pixel mt-1 text-[10px] md:text-xs ${accent ?? "text-cream"} ${
          punch ? "[animation:punch_.3s_ease-out]" : ""
        }`}
      >
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
