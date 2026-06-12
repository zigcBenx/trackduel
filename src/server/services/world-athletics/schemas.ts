import { z } from "zod";

// Only the fields we consume are modeled: zod strips unknown keys, so
// upstream additions never break us, and removals/renames of fields we DO
// rely on fail loudly as a "parse" WorldAthleticsError.
// All dates stay ISO strings (birthdate is date-only; avoid TZ ambiguity).

/** Parses an array element-by-element, dropping (and warning about) invalid
 * entries instead of failing the whole response — one malformed athlete in a
 * search result shouldn't take down the page. */
export function lenientArray<T>(
  schema: z.ZodType<T>,
): z.ZodType<T[], z.ZodTypeDef, unknown> {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        console.warn(
          "[world-athletics] dropping invalid list element:",
          parsed.error.issues[0],
        );
        return [];
      }
      return [parsed.data];
    }),
  );
}

export const locationSchema = z.object({
  country: z.string(),
  // both can be null OR absent entirely (e.g. indoor meets omit stadium)
  stadium: z.string().nullish(),
  city: z.string().nullish(),
  indoor: z.boolean(),
});

export const performanceSchema = z.object({
  discipline: z.string(),
  disciplineCode: z.string(),
  isTechnical: z.boolean(),
  date: z.string().nullable(),
  mark: z.string(),
  performanceValue: z.number().nullable(),
  location: locationSchema,
  wind: z.number().nullable().optional(),
  legal: z.boolean(),
  resultScore: z.number(),
  competition: z.string().nullable().optional(),
  competitionId: z.number().nullable().optional(),
  place: z.number().nullable().optional(),
});
export type Performance = z.infer<typeof performanceSchema>;

export const athleteSearchResultSchema = z.object({
  id: z.number(),
  firstname: z.string(),
  lastname: z.string(),
  birthdate: z.string().nullable(),
  country: z.string(),
  sex: z.string().nullable(),
  levenshteinDistance: z.number(),
});
export type AthleteSearchResult = z.infer<typeof athleteSearchResultSchema>;

export const athleteSchema = z.object({
  id: z.number(),
  firstname: z.string(),
  lastname: z.string(),
  birthdate: z.string().nullable(),
  country: z.string(),
  sex: z.string().nullable(),
  personalbests: z.array(performanceSchema),
  seasonsbests: z.array(performanceSchema),
  activeSeasons: z.array(z.number()),
});
export type Athlete = z.infer<typeof athleteSchema>;

export const competitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: locationSchema,
  rankingCategory: z.string(),
  start: z.string(),
  end: z.string(),
  hasResults: z.boolean(),
});
export type Competition = z.infer<typeof competitionSchema>;

export const baseAthleteSchema = z.object({
  id: z.number().nullable().optional(),
  firstname: z.string(),
  lastname: z.string(),
  birthdate: z.string().nullable(),
  country: z.string(),
  sex: z.string().nullable().optional(),
});
export type BaseAthlete = z.infer<typeof baseAthleteSchema>;

export const competitionResultSchema = z.object({
  mark: z.string(),
  performanceValue: z.number().nullable(),
  wind: z.number().nullable().optional(),
  location: locationSchema.optional(),
  athletes: z.array(baseAthleteSchema),
  country: z.string(),
  place: z.number(),
});
export type CompetitionResult = z.infer<typeof competitionResultSchema>;

export const competitionResultsRaceSchema = z.object({
  date: z.string().nullable(),
  day: z.number().nullable().optional(),
  race: z.string(),
  raceId: z.number(),
  raceNumber: z.number(),
  results: z.array(competitionResultSchema),
});
export type CompetitionResultsRace = z.infer<
  typeof competitionResultsRaceSchema
>;

export const competitionResultEventSchema = z.object({
  discipline: z.string(),
  disciplineCode: z.string(),
  isTechnical: z.boolean(),
  eventId: z.number(),
  category: z.string(),
  sex: z.string(),
  races: z.array(competitionResultsRaceSchema),
});
export type CompetitionResultEvent = z.infer<
  typeof competitionResultEventSchema
>;

/** Large championships return only a slice of events by default; `options`
 * enumerates everything available so callers can re-fetch per eventId/day. */
export const competitionResultOptionEventSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  discipline: z.string().optional(),
  disciplineCode: z.string(),
  sex: z.string(),
  combined: z.boolean().optional(),
});
export type CompetitionResultOptionEvent = z.infer<
  typeof competitionResultOptionEventSchema
>;

export const competitionResultsSchema = z.object({
  events: z.array(competitionResultEventSchema),
  options: z
    .object({
      events: z.array(competitionResultOptionEventSchema).optional(),
    })
    .optional(),
});
export type CompetitionResults = z.infer<typeof competitionResultsSchema>;
