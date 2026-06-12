import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  multiplierFor,
  pointsFor,
  titleFor,
  weekStartUtc,
} from "~/lib/scoring";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { duels, plays, type DuelAthlete } from "~/server/db/schema";

/** Client-safe athlete view: the finish time would give away the winner. */
function publicAthlete(athlete: DuelAthlete): Omit<DuelAthlete, "time"> {
  const { time, ...rest } = athlete;
  void time;
  return rest;
}

export const duelRouter = createTRPCRouter({
  /** A random set of duels — without winnerSide and without finish times.
   * Logged-in users are dealt duels they haven't played yet (falling back to
   * repeats once the pool is exhausted; repeats never score). */
  getBatch: publicProcedure
    .input(
      z
        .object({ count: z.number().int().min(1).max(20).default(10) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const count = input?.count ?? 10;
      const userId = ctx.session?.user?.id;

      // ORDER BY random() is fine at MVP pool sizes (hundreds of rows)
      let rows = userId
        ? await ctx.db
            .select()
            .from(duels)
            .where(
              notInArray(
                duels.id,
                ctx.db
                  .select({ id: plays.duelId })
                  .from(plays)
                  .where(eq(plays.userId, userId)),
              ),
            )
            .orderBy(sql`random()`)
            .limit(count)
        : await ctx.db
            .select()
            .from(duels)
            .orderBy(sql`random()`)
            .limit(count);

      if (rows.length === 0) {
        // pool exhausted — deal repeats (they won't score)
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
   * Scoring is computed and recorded server-side; each duel scores only once
   * per user (unique play per user+duel). */
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

      const correct = input.pick !== null && input.pick === duel.winnerSide;
      const userId = ctx.session?.user?.id;

      let points = 0;
      let streak: number | null = null; // null = anonymous (client keeps its own)
      let multiplier = 1;
      let repeat = false;

      if (userId) {
        const last = await ctx.db.query.plays.findFirst({
          where: eq(plays.userId, userId),
          orderBy: desc(plays.id),
          columns: { streakAfter: true },
        });
        const streakBefore = last?.streakAfter ?? 0;
        multiplier = multiplierFor(streakBefore);
        const earned = pointsFor(input.pick, correct, streakBefore);
        const streakAfter = correct ? streakBefore + 1 : 0;

        const inserted = await ctx.db
          .insert(plays)
          .values({
            userId,
            duelId: duel.id,
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
        } else {
          // already played this duel — show the answer, score nothing
          repeat = true;
          points = 0;
          streak = streakBefore;
          multiplier = 1;
        }
      } else {
        // anonymous: stateless base scoring, no combo, nothing persisted
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
      };
    }),

  /** Current player's persisted stats (null when anonymous). */
  me: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) return null;

    const last = await ctx.db.query.plays.findFirst({
      where: eq(plays.userId, userId),
      orderBy: desc(plays.id),
      columns: { streakAfter: true },
    });

    const [allTime] = await ctx.db
      .select({
        bestStreak: sql<number>`coalesce(max(${plays.streakAfter}), 0)::int`,
        totalPoints: sql<number>`greatest(coalesce(sum(${plays.points}), 0), 0)::int`,
      })
      .from(plays)
      .where(eq(plays.userId, userId));

    const [weekly] = await ctx.db
      .select({
        weeklyPoints: sql<number>`greatest(coalesce(sum(${plays.points}), 0), 0)::int`,
      })
      .from(plays)
      .where(
        and(eq(plays.userId, userId), gte(plays.createdAt, weekStartUtc())),
      );

    return {
      streak: last?.streakAfter ?? 0,
      bestStreak: allTime?.bestStreak ?? 0,
      totalPoints: allTime?.totalPoints ?? 0,
      weeklyPoints: weekly?.weeklyPoints ?? 0,
      title: titleFor(allTime?.totalPoints ?? 0),
    };
  }),
});
