import Image from "next/image";
import Link from "next/link";

import { LogoMark } from "~/app/_components/logo-mark";
import { RunClaimer } from "~/app/_components/run-claimer";
import { SignOutButton } from "~/app/_components/sign-out-button";
import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();
  const user = session?.user ?? null;

  return (
    <div className="bg-night text-cream selection:bg-flame selection:text-night relative flex min-h-dvh flex-col overflow-hidden font-mono">
      <RunClaimer enabled={!!user} />

      {/* night sky */}
      <div className="stars pointer-events-none absolute top-0 left-0" />
      <PixelCloud className="top-24 left-[8%] [animation:drift_22s_ease-in-out_infinite]" />
      <PixelCloud className="top-44 right-[12%] [animation:drift_30s_4s_ease-in-out_infinite] opacity-60" />
      <PixelCloud className="top-16 left-[58%] [animation:drift_26s_2s_ease-in-out_infinite] opacity-40" />

      {/* pixel infield + track at the bottom of the scene */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#1f4022_0_12px,transparent_12px_24px)]" />
        <div className="bg-turf h-8 md:h-12" />
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#a14a2b_0_12px,transparent_12px_24px)]" />
        <div className="bg-clay relative h-20 md:h-28">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(to_top,transparent_0_22px,rgba(236,225,200,0.45)_22px,rgba(236,225,200,0.45)_26px)]" />
        </div>
      </div>

      {/* top bar: brand + auth */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-10 md:py-6">
        <div className="flex items-center gap-2 md:gap-3">
          <LogoMark className="h-4 w-6 md:h-5 md:w-7" />
          <span className="font-pixel text-cream text-[11px] md:text-sm">
            TRACK<span className="text-flame">DUEL</span>
          </span>
        </div>
        {user ? (
          <div className="border-line bg-panel flex items-center gap-2 border px-2.5 py-1.5 md:px-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "you"}
                width={20}
                height={20}
                className="h-5 w-5 [image-rendering:pixelated]"
              />
            ) : (
              <span className="font-pixel text-gold text-[10px]">
                {(user.name ?? "R").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-dim hidden text-[8px] tracking-[0.2em] md:inline">
              {(user.name ?? "RUNNER").split(" ")[0]?.toUpperCase()}
            </span>
            <SignOutButton className="text-dim hover:text-flame cursor-pointer text-[8px] tracking-[0.1em] transition-colors" />
          </div>
        ) : (
          <Link
            href="/login"
            className="bevel press bg-blaze font-pixel text-cream flex items-center px-3 py-2 text-[9px] transition-[filter] hover:brightness-110 md:px-4 md:text-[10px]"
          >
            SIGN IN ▸
          </Link>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        {/* title + one-line pitch */}
        <h1 className="font-display text-cream [animation:rise_.5s_ease_both] text-5xl leading-none md:text-7xl">
          TRACK<span className="text-flame">DUEL</span>
        </h1>
        <p className="font-pixel text-gold mt-4 [animation:rise_.5s_.05s_ease_both] text-[11px] tracking-wide md:text-sm">
          GUESS WHO WON THE RACE
        </p>

        {/* the format, shown not told */}
        <div className="mt-8 flex [animation:rise_.5s_.1s_ease_both] items-center justify-center gap-3 md:gap-5">
          <DemoCard color="#c8503c" />
          <div className="pixel-border bg-night flex h-12 w-12 items-center justify-center [filter:drop-shadow(3px_3px_0_rgba(0,0,0,0.45))] [--pb:#2c3854] md:h-16 md:w-16">
            <span className="font-pixel text-gold text-sm [text-shadow:2px_2px_0_#c8503c] md:text-xl">
              VS
            </span>
          </div>
          <DemoCard color="#4e7cd6" flip />
        </div>

        <p className="text-dim mt-7 max-w-md [animation:rise_.5s_.15s_ease_both] text-[11px] leading-relaxed tracking-[0.15em] md:text-xs">
          Two real athletes. One finish line. You get{" "}
          <span className="text-cream">7 seconds</span> to call the winner from
          their stats — then chain correct guesses into a{" "}
          <span className="text-flame">streak</span> and climb the ranks.
        </p>

        {/* primary actions */}
        <div className="mt-9 flex w-full max-w-xs [animation:rise_.5s_.2s_ease_both] flex-col gap-3">
          <Link
            href="/play"
            className="bevel press bg-blaze font-pixel text-cream w-full px-6 py-4 text-sm transition-[filter] hover:brightness-110 md:text-base"
          >
            ▶ PLAY
          </Link>
          <Link
            href="/leaderboard"
            className="border-line bg-panel press font-pixel text-cream hover:border-gold/70 flex w-full items-center justify-center gap-2 border px-6 py-3.5 text-[11px] transition-colors md:text-xs"
          >
            <PixelTrophy /> LEADERBOARD
          </Link>
        </div>

        {/* how it works */}
        <div className="mt-10 flex [animation:rise_.5s_.25s_ease_both] items-start justify-center gap-4 md:gap-8">
          <Step n="1" label="PICK A SIDE" />
          <Step n="2" label="BEAT THE CLOCK" />
          <Step n="3" label="BUILD A STREAK" />
        </div>

        {!user && (
          <p className="text-dim mt-9 [animation:rise_.5s_.3s_ease_both] text-[9px] tracking-[0.25em]">
            PLAY FREE — <span className="text-cream">SIGN IN</span> TO SAVE YOUR
            STREAK &amp; RANK
          </p>
        )}
      </main>

      <footer className="text-cream/60 relative z-10 pb-5 text-center text-[8px] tracking-[0.4em] md:pb-6 md:text-[9px]">
        TRACKDUEL — by trackwrapped.com
      </footer>
    </div>
  );
}

/** A miniature athlete card so the format reads instantly: runner + a hidden
 * result. Purely decorative. */
function DemoCard({ color, flip }: { color: string; flip?: boolean }) {
  return (
    <div className="pixel-border bg-panel relative [filter:drop-shadow(3px_3px_0_rgba(0,0,0,0.45))] [--pb:#2c3854]">
      <div className="bg-night relative flex h-24 w-24 items-center justify-center overflow-hidden md:h-32 md:w-32">
        <div className="absolute inset-x-0 bottom-0 h-1/5 bg-[#1f4022]" />
        <Runner
          flip={flip}
          color={color}
          className="relative h-12 w-12 md:h-16 md:w-16"
        />
      </div>
      <div className="border-line flex h-7 items-center justify-center border-t md:h-8">
        <span className="font-pixel text-dim text-sm md:text-base">?</span>
      </div>
    </div>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-2 md:w-24">
      <span className="border-line bg-panel font-pixel text-gold flex h-8 w-8 items-center justify-center border text-[10px]">
        {n}
      </span>
      <span className="text-dim text-[8px] leading-tight tracking-[0.2em]">
        {label}
      </span>
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
      className="h-4 w-4"
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
