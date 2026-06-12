/**
 * Seeds the duel pool from the World Athletics proxy API.
 *
 * Run with: npm run db:seed
 * Re-runnable: duels are deduplicated via the sourceKey unique index.
 *
 * The proxy is community-hosted, so this script fetches sequentially with a
 * polite delay and caches athlete lookups across duels.
 */
import { db } from "~/server/db";
import { duels, type DuelAthlete } from "~/server/db/schema";
import {
  getAthlete,
  getCompetitionResults,
  type Athlete,
  type CompetitionResultsRace,
} from "~/server/services/world-athletics";

/** Curated meets (ids verified against the live API). label feeds the event headline. */
const MEETS: { id: number; label: string }[] = [
  { id: 7153115, label: "Olympic Final" }, // Paris 2024
  { id: 7199686, label: "Weltklasse Zürich" }, // 2025
  { id: 7203941, label: "Prefontaine Classic" }, // 2025
  { id: 7174055, label: "Prefontaine Classic" }, // 2024
  { id: 7154217, label: "Prefontaine Classic" }, // 2023
  { id: 7203944, label: "Athletissima Lausanne" }, // 2025
  { id: 7174061, label: "Athletissima Lausanne" }, // 2024
  { id: 7203938, label: "Golden Gala" }, // 2025
  { id: 7174054, label: "Golden Gala" }, // 2024
  { id: 7199685, label: "Memorial Van Damme" }, // 2025
  { id: 7174062, label: "Memorial Van Damme" }, // 2024
];

/** Track disciplines where "who won" + finish times make a snappy duel. */
const DISCIPLINES = new Set([
  "100",
  "200",
  "400",
  "800",
  "1500",
  "100H",
  "110H",
  "400H",
]);

const API_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const athleteCache = new Map<number, Athlete | null>();

async function fetchAthleteCached(id: number): Promise<Athlete | null> {
  if (athleteCache.has(id)) return athleteCache.get(id) ?? null;
  await sleep(API_DELAY_MS);
  try {
    const athlete = await getAthlete(id);
    athleteCache.set(id, athlete);
    return athlete;
  } catch (err) {
    console.warn(`  ! athlete ${id} fetch failed:`, (err as Error).message);
    athleteCache.set(id, null);
    return null;
  }
}

function shortDiscipline(discipline: string): string {
  return discipline
    .replace(",", "")
    .replace(" Metres Hurdles", "m Hurdles")
    .replace(" Metres", "m");
}

function formatWind(wind: number | null | undefined): string {
  if (wind === null || wind === undefined) return "—";
  return `${wind > 0 ? "+" : ""}${wind.toFixed(1)} m/s`;
}

function findFinal(
  races: CompetitionResultsRace[],
): CompetitionResultsRace | undefined {
  return races.find((r) => r.race.trim().toLowerCase() === "final");
}

function buildDuelAthlete(opts: {
  waId: number;
  firstname: string;
  lastname: string;
  country: string;
  born: number;
  athlete: Athlete;
  disciplineCode: string;
  time: string;
}): DuelAthlete | null {
  const pb = opts.athlete.personalbests.find(
    (p) => p.disciplineCode === opts.disciplineCode && p.legal,
  );
  if (!pb) return null;
  const seasons = opts.athlete.activeSeasons.length;
  if (seasons === 0) return null;
  return {
    waId: opts.waId,
    name: `${opts.firstname} ${opts.lastname}`,
    country: opts.country,
    flag: countryFlag(opts.country),
    born: opts.born,
    seasons,
    pb: pb.mark,
    bib: opts.waId % 10_000,
    time: opts.time,
  };
}

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const meet of MEETS) {
    console.log(`\n=== ${meet.label} (${meet.id}) ===`);
    let base;
    try {
      base = await getCompetitionResults(meet.id);
    } catch (err) {
      console.warn(`  ! results fetch failed:`, (err as Error).message);
      continue;
    }

    const eventOptions = (base.options?.events ?? []).filter(
      (e) => DISCIPLINES.has(e.disciplineCode) && !e.combined,
    );

    for (const option of eventOptions) {
      await sleep(API_DELAY_MS);
      let scoped;
      try {
        scoped = await getCompetitionResults(meet.id, { eventId: option.id });
      } catch (err) {
        console.warn(
          `  ! event ${option.disciplineCode} ${option.sex} fetch failed:`,
          (err as Error).message,
        );
        continue;
      }

      for (const event of scoped.events) {
        if (event.isTechnical || !DISCIPLINES.has(event.disciplineCode)) {
          continue;
        }
        const final = findFinal(event.races);
        if (!final) {
          skipped++;
          continue;
        }

        const ranked = final.results
          .filter((r) => r.athletes.length === 1) // skip relays/teams
          .sort((a, b) => a.place - b.place);
        const first = ranked.find((r) => r.place === 1);
        const second = ranked.find((r) => r.place === 2);
        if (!first || !second || first.mark === second.mark) {
          skipped++;
          continue;
        }

        const [winRes, loseRes] = [first, second];
        const winBase = winRes.athletes[0]!;
        const loseBase = loseRes.athletes[0]!;
        if (
          !winBase.id ||
          !loseBase.id ||
          !winBase.birthdate ||
          !loseBase.birthdate
        ) {
          skipped++;
          continue;
        }

        const [winAthlete, loseAthlete] = [
          await fetchAthleteCached(winBase.id),
          await fetchAthleteCached(loseBase.id),
        ];
        if (!winAthlete || !loseAthlete) {
          skipped++;
          continue;
        }

        const winner = buildDuelAthlete({
          waId: winBase.id,
          firstname: winBase.firstname,
          lastname: winBase.lastname,
          country: winRes.country,
          born: new Date(winBase.birthdate).getFullYear(),
          athlete: winAthlete,
          disciplineCode: event.disciplineCode,
          time: winRes.mark,
        });
        const loser = buildDuelAthlete({
          waId: loseBase.id,
          firstname: loseBase.firstname,
          lastname: loseBase.lastname,
          country: loseRes.country,
          born: new Date(loseBase.birthdate).getFullYear(),
          athlete: loseAthlete,
          disciplineCode: event.disciplineCode,
          time: loseRes.mark,
        });
        if (!winner || !loser) {
          skipped++;
          continue;
        }

        // randomize sides so the winner isn't always on the left
        const winnerSide = Math.random() < 0.5 ? 0 : 1;
        const [athleteA, athleteB] =
          winnerSide === 0 ? [winner, loser] : [loser, winner];

        const raceYear = final.date
          ? new Date(final.date).getFullYear()
          : new Date().getFullYear();
        const sexLabel = event.sex === "W" ? "Women's" : "Men's";
        const stadium =
          winRes.location?.stadium ?? winRes.location?.city ?? "Unknown";
        const sourceKey = `${meet.id}:${final.raceId}:${Math.min(winBase.id, loseBase.id)}:${Math.max(winBase.id, loseBase.id)}`;

        const result = await db
          .insert(duels)
          .values({
            event: `${sexLabel} ${shortDiscipline(event.discipline)} · ${meet.label}`,
            year: raceYear,
            stadium,
            wind: formatWind(winRes.wind),
            disciplineCode: event.disciplineCode,
            sex: event.sex,
            athleteA,
            athleteB,
            winnerSide,
            waCompetitionId: meet.id,
            waRaceId: final.raceId,
            sourceKey,
          })
          .onConflictDoNothing()
          .returning({ id: duels.id });

        if (result.length > 0) {
          inserted++;
          console.log(
            `  + ${sexLabel} ${shortDiscipline(event.discipline)}: ${winner.name} (${winner.time}) vs ${loser.name} (${loser.time})`,
          );
        } else {
          skipped++; // already seeded
        }
      }
    }
  }

  console.log(
    `\nDone. Inserted ${inserted} duels, skipped ${skipped} (dupes/missing data).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/** IOC country code → flag emoji (athletics nations; extend as needed). */
function countryFlag(ioc: string): string {
  const iso = IOC_TO_ISO2[ioc];
  if (!iso) return "🏳️";
  return String.fromCodePoint(
    ...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const IOC_TO_ISO2: Record<string, string> = {
  ALG: "DZ",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BAH: "BS",
  BAR: "BB",
  BDI: "BI",
  BEL: "BE",
  BLR: "BY",
  BOT: "BW",
  BRA: "BR",
  BRN: "BH",
  BUL: "BG",
  CAN: "CA",
  CHI: "CL",
  CHN: "CN",
  CIV: "CI",
  CMR: "CM",
  COL: "CO",
  CRO: "HR",
  CUB: "CU",
  CZE: "CZ",
  DEN: "DK",
  DMA: "DM",
  DOM: "DO",
  ECU: "EC",
  EGY: "EG",
  ERI: "ER",
  ESP: "ES",
  EST: "EE",
  ETH: "ET",
  FIN: "FI",
  FRA: "FR",
  GAM: "GM",
  GBR: "GB",
  GER: "DE",
  GHA: "GH",
  GRE: "GR",
  GRN: "GD",
  HUN: "HU",
  IND: "IN",
  IRL: "IE",
  ISR: "IL",
  ITA: "IT",
  JAM: "JM",
  JPN: "JP",
  KAZ: "KZ",
  KEN: "KE",
  KOR: "KR",
  KSA: "SA",
  LAT: "LV",
  LCA: "LC",
  LTU: "LT",
  MAR: "MA",
  MEX: "MX",
  MOZ: "MZ",
  NAM: "NA",
  NED: "NL",
  NGR: "NG",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PER: "PE",
  POL: "PL",
  POR: "PT",
  PUR: "PR",
  QAT: "QA",
  ROU: "RO",
  RSA: "ZA",
  SEN: "SN",
  SKN: "KN",
  SLO: "SI",
  SRB: "RS",
  SUI: "CH",
  SVK: "SK",
  SWE: "SE",
  TAN: "TZ",
  TTO: "TT",
  TUN: "TN",
  TUR: "TR",
  UGA: "UG",
  UKR: "UA",
  URU: "UY",
  USA: "US",
  VEN: "VE",
  ZAM: "ZM",
  ZIM: "ZW",
};
