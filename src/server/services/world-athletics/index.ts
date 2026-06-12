// World Athletics proxy API service.
//
// All data is historical or slow-moving, and the upstream is a community-
// hosted proxy with 0.5–2.3s latency — so every endpoint opts into Next's
// data cache with a generous revalidate window. Cache tags allow targeted
// revalidateTag() later (e.g. a manual refresh).
import { waFetch } from "./client";
import {
  athleteSchema,
  athleteSearchResultSchema,
  competitionResultsSchema,
  competitionSchema,
  lenientArray,
  performanceSchema,
  type Athlete,
  type AthleteSearchResult,
  type Competition,
  type CompetitionResults,
  type Performance,
} from "./schemas";

const HOUR = 3_600;
const DAY = 24 * HOUR;

/** Fuzzy athlete search; results include `levenshteinDistance` for ranking. */
export function searchAthletes(name: string): Promise<AthleteSearchResult[]> {
  return waFetch("/athletes/search", {
    schema: lenientArray(athleteSearchResultSchema),
    searchParams: { name },
    revalidate: DAY,
    tags: ["wa-athlete-search"],
  });
}

/** Full athlete profile: personal bests, season bests, active seasons. */
export function getAthlete(id: number): Promise<Athlete> {
  return waFetch(`/athletes/${id}`, {
    schema: athleteSchema,
    revalidate: 6 * HOUR,
    tags: [`wa-athlete-${id}`],
  });
}

/** An athlete's results, optionally scoped to one year. */
export function getAthleteResults(
  id: number,
  year?: number,
): Promise<Performance[]> {
  const isPastSeason = year !== undefined && year < new Date().getFullYear();
  return waFetch(`/athletes/${id}/results`, {
    schema: lenientArray(performanceSchema),
    searchParams: { year },
    revalidate: isPastSeason ? 7 * DAY : HOUR,
    tags: [`wa-athlete-${id}`],
  });
}

/** Fuzzy competition search by name. */
export function searchCompetitions(name: string): Promise<Competition[]> {
  return waFetch("/competitions", {
    schema: lenientArray(competitionSchema),
    searchParams: { name },
    revalidate: DAY,
    tags: ["wa-competition-search"],
  });
}

/** Results of a competition: events → races → ranked results. */
export function getCompetitionResults(
  id: number,
  opts: { eventId?: number; day?: number } = {},
): Promise<CompetitionResults> {
  return waFetch(`/competitions/${id}/results`, {
    schema: competitionResultsSchema,
    searchParams: { eventId: opts.eventId, day: opts.day },
    revalidate: 6 * HOUR,
    tags: [`wa-competition-${id}`],
  });
}

export { WorldAthleticsError } from "./client";
export type {
  Athlete,
  AthleteSearchResult,
  BaseAthlete,
  Competition,
  CompetitionResult,
  CompetitionResultEvent,
  CompetitionResults,
  CompetitionResultsRace,
  Performance,
} from "./schemas";
