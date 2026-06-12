import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { duels, type DuelAthlete } from "~/server/db/schema";

/** Client-safe athlete view: the finish time would give away the winner. */
function publicAthlete(athlete: DuelAthlete): Omit<DuelAthlete, "time"> {
  const { time, ...rest } = athlete;
  void time;
  return rest;
}

export const duelRouter = createTRPCRouter({
  /** A random set of duels — without winnerSide and without finish times. */
  getBatch: publicProcedure
    .input(
      z
        .object({ count: z.number().int().min(1).max(20).default(10) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const count = input?.count ?? 10;
      // ORDER BY random() is fine at MVP pool sizes (hundreds of rows)
      const rows = await ctx.db
        .select()
        .from(duels)
        .orderBy(sql`random()`)
        .limit(count);

      return rows.map((d) => ({
        id: d.id,
        event: d.event,
        year: d.year,
        stadium: d.stadium,
        wind: d.wind,
        athleteA: publicAthlete(d.athleteA),
        athleteB: publicAthlete(d.athleteB),
      }));
    }),

  /** Resolve a duel after the user picked (or timed out: pick = null). */
  reveal: publicProcedure
    .input(
      z.object({
        duelId: z.number().int().positive(),
        pick: z.union([z.literal(0), z.literal(1)]).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const duel = await ctx.db.query.duels.findFirst({
        where: eq(duels.id, input.duelId),
      });
      if (!duel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Duel not found" });
      }
      // (next round: record the play here for scoring/leaderboard)
      return {
        correct: input.pick !== null && input.pick === duel.winnerSide,
        winnerSide: duel.winnerSide as 0 | 1,
        times: [duel.athleteA.time, duel.athleteB.time] as [string, string],
      };
    }),
});
