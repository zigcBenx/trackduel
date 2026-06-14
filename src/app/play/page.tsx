import { DuelGame } from "~/app/_components/duel";
import { auth } from "~/server/auth";

export default async function PlayPage() {
  const session = await auth();

  return (
    <DuelGame
      user={
        session?.user
          ? {
              name: session.user.name ?? "RUNNER",
              image: session.user.image ?? null,
            }
          : null
      }
    />
  );
}
