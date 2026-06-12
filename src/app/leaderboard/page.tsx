import Image from "next/image";
import Link from "next/link";

import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

const MEDALS: Record<number, { label: string; color: string; border: string }> =
  {
    1: { label: "1ST", color: "text-gold", border: "#e3b341" },
    2: { label: "2ND", color: "text-cream", border: "#aab4c8" },
    3: { label: "3RD", color: "text-clay", border: "#a14a2b" },
  };

export default async function LeaderboardPage() {
  const [{ entries, me }, session] = await Promise.all([
    api.leaderboard.top(),
    auth(),
  ]);
  const myId = session?.user?.id;

  return (
    <div className="bg-night text-cream selection:bg-flame selection:text-night relative flex min-h-dvh flex-col overflow-hidden font-mono">
      {/* night sky */}
      <div className="stars pointer-events-none absolute top-0 left-0" />

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
        <Link href="/" className="font-pixel text-cream text-[11px] md:text-sm">
          TRACK<span className="text-flame">DUEL</span>
        </Link>
        <Link
          href="/"
          className="bevel bg-blaze font-pixel text-cream flex items-center px-3 py-2 text-[9px] transition-[filter] hover:brightness-110 md:px-4 md:text-[10px]"
        >
          ◂ BACK TO THE TRACK
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-3 pb-32 md:px-4">
        <div className="mb-6 [animation:rise_.5s_ease_both] text-center md:mb-8">
          <p className="text-dim mb-2 text-[9px] tracking-[0.4em] md:text-[11px]">
            WEEKLY STANDINGS — RESETS MONDAY
          </p>
          <h1 className="font-display text-cream text-3xl uppercase md:text-5xl">
            The Ranks
          </h1>
        </div>

        {entries.length === 0 ? (
          <div className="pixel-border bg-panel p-8 text-center [filter:drop-shadow(4px_4px_0_rgba(0,0,0,0.45))] [--pb:#2c3854]">
            <p className="font-pixel text-cream text-xs leading-relaxed">
              NO RUNNERS ON THE BOARD YET
            </p>
            <p className="text-dim mt-3 text-[9px] tracking-[0.3em]">
              SIGN IN AND PLAY — THE FIRST WIN TAKES THE LEAD
            </p>
          </div>
        ) : (
          <ol className="flex [animation:rise_.5s_.08s_ease_both] flex-col gap-3">
            {entries.map((e) => {
              const medal = MEDALS[e.rank];
              const isMe = e.userId === myId;
              return (
                <li
                  key={e.userId}
                  className={`pixel-border bg-panel relative flex items-center gap-3 [filter:drop-shadow(3px_3px_0_rgba(0,0,0,0.45))] md:gap-4 ${
                    medal ? "px-4 py-3.5 md:px-5" : "px-3 py-2.5 md:px-4"
                  }`}
                  style={{
                    ["--pb" as string]: isMe
                      ? "#e3b341"
                      : (medal?.border ?? "#2c3854"),
                  }}
                >
                  <span
                    className={`font-pixel w-9 shrink-0 ${
                      medal
                        ? `text-xs md:text-sm ${medal.color}`
                        : "text-dim text-[10px]"
                    }`}
                  >
                    {medal ? medal.label : `#${e.rank}`}
                  </span>

                  <Avatar name={e.name} image={e.image} big={!!medal} />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-display truncate uppercase ${medal ? "text-base md:text-xl" : "text-sm md:text-base"}`}
                    >
                      {e.name}
                      {isMe && (
                        <span className="text-gold font-pixel ml-2 text-[8px]">
                          YOU
                        </span>
                      )}
                    </p>
                    <p className="text-dim text-[8px] tracking-[0.25em]">
                      {e.title} · {e.playCount} DUELS · {e.accuracy}% ACC
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`font-pixel text-gold ${medal ? "text-sm md:text-lg" : "text-xs md:text-sm"}`}
                    >
                      {e.weeklyPoints}
                      <span className="text-dim ml-1 text-[8px]">PTS</span>
                    </p>
                    <p className="text-dim mt-0.5 text-[8px] tracking-[0.2em]">
                      🔥{e.bestStreak} BEST
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* your rank when outside the top 20 */}
        {me && !entries.some((e) => e.userId === myId) && (
          <div className="pixel-border bg-panel mt-5 flex items-center justify-between px-4 py-3 [filter:drop-shadow(3px_3px_0_rgba(0,0,0,0.45))] [--pb:#e3b341]">
            <span className="font-pixel text-gold text-[10px]">
              YOUR RANK: #{me.rank}
            </span>
            <span className="font-pixel text-cream text-[10px]">
              {me.weeklyPoints}
              <span className="text-dim ml-1 text-[8px]">PTS</span>
            </span>
          </div>
        )}

        {!session?.user && (
          <p className="mt-6 text-center">
            <Link
              href="/login"
              className="text-dim hover:text-cream text-[9px] tracking-[0.3em] transition-colors"
            >
              SIGN IN TO ENTER THE RANKS ▸
            </Link>
          </p>
        )}
      </main>

      <footer className="text-cream/60 relative z-10 pb-5 text-center text-[8px] tracking-[0.4em] md:pb-6 md:text-[9px]">
        TRACKDUEL — EVERY RACE HAS A WINNER
      </footer>
    </div>
  );
}

function Avatar({
  name,
  image,
  big,
}: {
  name: string;
  image: string | null;
  big: boolean;
}) {
  const size = big ? "h-10 w-10 md:h-12 md:w-12" : "h-8 w-8";
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={48}
        height={48}
        className={`${size} border-line shrink-0 border [image-rendering:pixelated]`}
      />
    );
  }
  return (
    <span
      className={`${size} border-line bg-night font-pixel text-gold flex shrink-0 items-center justify-center border ${big ? "text-sm" : "text-[10px]"}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
