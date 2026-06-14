import { titleFor } from "~/lib/scoring";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { plays, users } from "~/server/db/schema";
import { sql } from "drizzle-orm";

type BoardRow = {
  userId: string;
  name: string | null;
  image: string | null;
  highScore: number;
  bestStreak: number;
  runs: number;
  accuracy: number;
};

export const leaderboardRouter = createTRPCRouter({
  /** All-time high scores: each player ranked by their best single run. */
  top: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.execute<BoardRow>(sql`
      with run_scores as (
        select "userId", "runId",
          greatest(sum(points), 0) as score,
          max("streakAfter") as best
        from ${plays}
        where "runId" is not null
        group by "userId", "runId"
      ),
      agg as (
        select "userId",
          max(score) as "highScore",
          max(best) as "bestStreak",
          count(*) as runs
        from run_scores
        group by "userId"
      ),
      acc as (
        select "userId", round(100.0 * avg(("correct")::int)) as accuracy
        from ${plays}
        where "runId" is not null
        group by "userId"
      )
      select a."userId",
        u.name, u.image,
        a."highScore"::int as "highScore",
        a."bestStreak"::int as "bestStreak",
        a.runs::int as runs,
        coalesce(acc.accuracy, 0)::int as accuracy
      from agg a
      join ${users} u on u.id = a."userId"
      left join acc on acc."userId" = a."userId"
      order by a."highScore" desc, a."bestStreak" desc
      limit 20
    `);

    const board = rows.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: e.name ?? "RUNNER",
      image: e.image,
      highScore: Number(e.highScore),
      bestStreak: Number(e.bestStreak),
      runs: Number(e.runs),
      accuracy: Number(e.accuracy),
      title: titleFor(Number(e.highScore)),
    }));

    // caller's own rank, even when outside the top 20
    const userId = ctx.session?.user?.id;
    let me: { rank: number; highScore: number } | null = null;
    if (userId) {
      const inBoard = board.find((e) => e.userId === userId);
      if (inBoard) {
        me = { rank: inBoard.rank, highScore: inBoard.highScore };
      } else {
        const [row] = await ctx.db.execute<{ rank: number; high: number }>(sql`
          with hs as (
            select "userId", max(score) as high from (
              select "userId", "runId", greatest(sum(points), 0) as score
              from ${plays} where "runId" is not null
              group by "userId", "runId"
            ) s
            group by "userId"
          )
          select
            (select count(*) + 1 from hs where high > coalesce((select high from hs where "userId" = ${userId}), -1))::int as rank,
            coalesce((select high from hs where "userId" = ${userId}), 0)::int as high
        `);
        if (row) me = { rank: Number(row.rank), highScore: Number(row.high) };
      }
    }

    return { entries: board, me };
  }),
});
