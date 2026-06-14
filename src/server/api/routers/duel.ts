import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import { multiplierFor, pointsFor, RUN_LIVES, titleFor } from "~/lib/scoring";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { duels, plays, type DuelAthlete } from "~/server/db/schema";

/** Client-safe athlete view: the finish time would give away the winner. */
function publicAthlete(athlete: DuelAthlete): Omit<DuelAthlete, "time"> {
  const { time, ...rest } = athlete;
  void time;
  return rest;
}

export const duelRouter = createTRPCRouter({
  /** A random set of duels — without winnerSide and without finish times.
   * Within a run, duels already seen this run are excluded (no repeats);
   * duels recycle freely across runs. */
  getBatch: publicProcedure
    .input(
      z
        .object({
          count: z.number().int().min(1).max(20).default(10),
          runId: z.string().max(64).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const count = input?.count ?? 10;
      const userId = ctx.session?.user?.id;
      const runId = input?.runId;

      const seenInRun =
        userId && runId
          ? ctx.db
              .select({ id: plays.duelId })
              .from(plays)
              .where(and(eq(plays.userId, userId), eq(plays.runId, runId)))
          : null;

      // ORDER BY random() is fine at MVP pool sizes (hundreds of rows)
      let rows = await ctx.db
        .select()
        .from(duels)
        .where(seenInRun ? notInArray(duels.id, seenInRun) : undefined)
        .orderBy(sql`random()`)
        .limit(count);

      if (rows.length === 0) {
        // run has exhausted the pool — recycle
        rows = await ctx.db
          .select()
          .from(duels)
          .orderBy(sql`random()`)
          .limit(count);
      }

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

  /** Resolve a duel after the user picked (or timed out: pick = null).
   * For logged-in players with a runId, scoring/streak/lives are computed and
   * enforced server-side within that run. Anonymous players get stateless base
   * scoring (nothing persisted). */
  reveal: publicProcedure
    .input(
      z.object({
        duelId: z.number().int().positive(),
        pick: z.union([z.literal(0), z.literal(1)]).nullable(),
        runId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const duel = await ctx.db.query.duels.findFirst({
        where: eq(duels.id, input.duelId),
      });
      if (!duel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Duel not found" });
      }

      const correct = input.pick !== null && input.pick === duel.winnerSide;
      const userId = ctx.session?.user?.id ?? null;
      const runId = input.runId;

      let points = 0;
      let streak: number | null = null;
      let multiplier = 1;
      let repeat = false;
      let lives: number | null = null;
      let runOver = false;

      if (runId) {
        // run state is keyed by runId alone (a client-unique uuid), so it works
        // the same whether the player is anonymous (userId null) or logged in.
        // Anonymous runs are recorded too, so they can be claimed after sign-up.
        const runPlays = await ctx.db
          .select({ correct: plays.correct, streakAfter: plays.streakAfter })
          .from(plays)
          .where(eq(plays.runId, runId))
          .orderBy(desc(plays.id));

        const misses = runPlays.filter((p) => !p.correct).length;
        const streakBefore = runPlays[0]?.streakAfter ?? 0;

        if (misses >= RUN_LIVES) {
          // run already over — reveal the answer but score nothing
          runOver = true;
          lives = 0;
          streak = streakBefore;
        } else {
          multiplier = multiplierFor(streakBefore);
          const earned = pointsFor(input.pick, correct, streakBefore);
          const streakAfter = correct ? streakBefore + 1 : 0;

          const inserted = await ctx.db
            .insert(plays)
            .values({
              userId,
              duelId: duel.id,
              runId,
              pick: input.pick,
              correct,
              points: earned,
              streakAfter,
            })
            .onConflictDoNothing()
            .returning({ id: plays.id });

          if (inserted.length > 0) {
            points = earned;
            streak = streakAfter;
            lives = RUN_LIVES - (misses + (correct ? 0 : 1));
            runOver = lives <= 0;
          } else {
            // already answered this duel in this run — no double scoring
            repeat = true;
            streak = streakBefore;
            multiplier = 1;
            lives = RUN_LIVES - misses;
          }
        }
      } else {
        // no run context — stateless base scoring, nothing persisted
        points = pointsFor(input.pick, correct, 0);
      }

      return {
        correct,
        winnerSide: duel.winnerSide as 0 | 1,
        times: [duel.athleteA.time, duel.athleteB.time] as [string, string],
        points,
        streak,
        multiplier,
        repeat,
        lives,
        runOver,
      };
    }),

  /** Current player's all-time high score (best single run); null when anon. */
  me: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) return null;

    const runScores = await ctx.db
      .select({
        score: sql<number>`greatest(coalesce(sum(${plays.points}), 0), 0)::int`,
        best: sql<number>`coalesce(max(${plays.streakAfter}), 0)::int`,
      })
      .from(plays)
      .where(and(eq(plays.userId, userId), sql`${plays.runId} is not null`))
      .groupBy(plays.runId);

    const highScore = runScores.reduce((m, r) => Math.max(m, r.score), 0);
    const bestStreak = runScores.reduce((m, r) => Math.max(m, r.best), 0);

    return { highScore, bestStreak, title: titleFor(highScore) };
  }),

  /** Attach an anonymous run (played before sign-up) to the now-logged-in user.
   * Only claims plays that are still ownerless, so it can't steal a run. */
  claimRun: protectedProcedure
    .input(z.object({ runId: z.string().max(64) }))
    .mutation(async ({ ctx, input }) => {
      const claimed = await ctx.db
        .update(plays)
        .set({ userId: ctx.session.user.id })
        .where(and(eq(plays.runId, input.runId), isNull(plays.userId)))
        .returning({ id: plays.id });
      return { claimed: claimed.length };
    }),
});
