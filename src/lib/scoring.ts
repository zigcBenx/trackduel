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
/** Mistakes (wrong pick or timeout) allowed before a run ends. */
export const RUN_LIVES = 3;

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

/** Rank title from a player's high score (best single run) — pure swagger. */
export function titleFor(highScore: number): string {
  if (highScore >= 500) return "LEGEND";
  if (highScore >= 250) return "MEDALIST";
  if (highScore >= 120) return "FINALIST";
  if (highScore >= 50) return "SPRINTER";
  return "ROOKIE";
}
