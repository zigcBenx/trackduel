/**
 * TrackDuel scoring. Deliberately simple for now:
 *  - correct pick:  +10, multiplied by the active combo
 *  - wrong pick:     -2
 *  - timeout:         0 (you didn't commit — but the streak breaks)
 * Totals are clamped at 0 wherever they're displayed/ranked.
 *
 * Combo: while a streak is alive, every correct answer pays more. The
 * multiplier is based on the streak you carry INTO the guess.
 */
export const BASE_WIN = 10;
export const WRONG_PENALTY = -2;

export function multiplierFor(streak: number): number {
  if (streak >= 20) return 3;
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

export function pointsFor(
  pick: 0 | 1 | null,
  correct: boolean,
  streakBefore: number,
): number {
  if (correct) return Math.round(BASE_WIN * multiplierFor(streakBefore));
  return pick === null ? 0 : WRONG_PENALTY;
}

/** Rank title from all-time points — pure swagger, shown on the leaderboard. */
export function titleFor(totalPoints: number): string {
  if (totalPoints >= 2500) return "LEGEND";
  if (totalPoints >= 1000) return "MEDALIST";
  if (totalPoints >= 400) return "FINALIST";
  if (totalPoints >= 100) return "SPRINTER";
  return "ROOKIE";
}

/** Start of the current scoring week (Monday 00:00 UTC). */
export function weekStartUtc(now: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}
