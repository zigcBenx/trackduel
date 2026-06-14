"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { api } from "~/trpc/react";

/** After sign-up/sign-in, attach the anonymous run the player chose to save
 * (stashed in localStorage on the game-over screen) to their account, then
 * send them to the leaderboard to see it. Renders nothing. */
export function RunClaimer({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const claim = api.duel.claimRun.useMutation();
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current) return;
    const runId = localStorage.getItem("td_claim_run");
    if (!runId) return;
    done.current = true;
    localStorage.removeItem("td_claim_run");
    claim.mutate(
      { runId },
      {
        onSuccess: (res) => {
          if (res.claimed > 0) router.push("/leaderboard");
        },
      },
    );
  }, [enabled, claim, router]);

  return null;
}
