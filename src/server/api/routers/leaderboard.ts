import { eq, gte, sql } from "drizzle-orm";

import { titleFor, weekStartUtc } from "~/lib/scoring";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { plays, users } from "~/server/db/schema";

export const leaderboardRouter = createTRPCRouter({
  /** Weekly standings (Monday-reset) + the caller's own rank. */
  top: publicProcedure.query(async ({ ctx }) => {
    const weekStart = weekStartUtc();

    const entries = await ctx.db
      .select({
        userId: plays.userId,
        name: users.name,
        image: users.image,
        weeklyPoints: sql<number>`greatest(sum(${plays.points}), 0)::int`,
        playCount: sql<number>`count(*)::int`,
        accuracy: sql<number>`round(100.0 * avg((${plays.correct})::int))::int`,
        bestStreak: sql<number>`(select coalesce(max(p2."streakAfter"), 0) from ${plays} p2 where p2."userId" = ${plays.userId})::int`,
        totalPoints: sql<number>`(select greatest(coalesce(sum(p3.points), 0), 0) from ${plays} p3 where p3."userId" = ${plays.userId})::int`,
      })
      .from(plays)
      .innerJoin(users, eq(plays.userId, users.id))
      .where(gte(plays.createdAt, weekStart))
      .groupBy(plays.userId, users.name, users.image)
      .orderBy(
        sql`greatest(sum(${plays.points}), 0) desc, max(${plays.streakAfter}) desc`,
      )
      .limit(20);

    const board = entries.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: e.name ?? "RUNNER",
      image: e.image,
      weeklyPoints: e.weeklyPoints,
      playCount: e.playCount,
      accuracy: e.accuracy,
      bestStreak: e.bestStreak,
      title: titleFor(e.totalPoints),
    }));

    // caller's own rank, even when outside the top 20
    const userId = ctx.session?.user?.id;
    let me: { rank: number; weeklyPoints: number } | null = null;
    if (userId) {
      const inBoard = board.find((e) => e.userId === userId);
      if (inBoard) {
        me = { rank: inBoard.rank, weeklyPoints: inBoard.weeklyPoints };
      } else {
        const [row] = await ctx.db.execute<{
          rank: number;
          points: number;
        }>(sql`
          with sums as (
            select "userId", greatest(sum(points), 0) as pts
            from ${plays}
            where "createdAt" >= ${weekStart.toISOString()}::timestamptz
            group by "userId"
          )
          select
            (select count(*) + 1 from sums where pts > coalesce((select pts from sums where "userId" = ${userId}), -1))::int as rank,
            coalesce((select pts from sums where "userId" = ${userId}), 0)::int as points
        `);
        if (row && row.points !== null) {
          me = { rank: Number(row.rank), weeklyPoints: Number(row.points) };
        }
      }
    }

    return { weekStart: weekStart.toISOString(), entries: board, me };
  }),
});
