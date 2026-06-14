import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "~/app/_components/auth-panel";
import { LogoMark } from "~/app/_components/logo-mark";
import { auth } from "~/server/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const startRegister = (await searchParams).new !== undefined;

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

      <header className="relative z-10 flex flex-col items-center gap-3 px-4 py-6 md:py-8">
        <Link
          href="/"
          className="font-pixel text-cream flex flex-col items-center gap-3 text-sm md:text-base"
        >
          <span>
            TRACK<span className="text-flame">DUEL</span>
          </span>
          <LogoMark className="h-7 w-11 md:h-8 md:w-12" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-24">
        <AuthPanel startRegister={startRegister} />
        <Link
          href="/"
          className="text-dim hover:text-cream mt-6 text-center text-[9px] tracking-[0.3em] transition-colors"
        >
          ◂ BACK TO THE TRACK
        </Link>
      </main>
    </div>
  );
}
