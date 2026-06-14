/**
 * Seeds the duel pool from the World Athletics proxy API.
 *
 * Run with: npm run db:seed
 * Re-runnable: duels are deduplicated via the sourceKey unique index.
 *
 * Strategy (to reach ~2000 quality duels without hammering the API):
 *  - discover meets by searching famous series/championships across years
 *  - per race, pair the top finishers (1v2, 2v3, …) — many duels per fetch
 *  - cache each athlete's profile (they recur across rounds & meets)
 *  - stop once TARGET duels exist
 */
import { db } from "~/server/db";
import { duels, type DuelAthlete } from "~/server/db/schema";
import {
  getAthlete,
  getCompetitionResults,
  searchCompetitions,
  type Athlete,
  type CompetitionResultsRace,
} from "~/server/services/world-athletics";

const TARGET = 1500; // new duels to add this run (older years)
const MAX_COMPETITIONS = 200;
const PER_MEET_CAP = 70; // keep one championship from dominating the pool
const TOP_N = 6; // pair finishers down to this place
const API_DELAY_MS = 150;

/** World Athletics ranking categories worth keeping — elite meets only, where
 * the athletes are actually recognizable: Olympics/Worlds, DL final, Diamond
 * League, Continental Tour Gold. Covers 2018→present. */
const ALLOWED_CATEGORIES = new Set(["OW", "DF", "GW", "GL"]);

/** Everything before ~2018 is lumped into the "Pre 2018" category, so it can't
 * be quality-filtered by category. For those years, keep a meet only if its
 * name matches a famous series/championship — this pulls in the 2010–2017
 * golden era (Bolt, Farah, Felix…) without the minor old meets. */
const PRE_2018_FAMOUS =
  /(prefontaine|weltklasse|athletissima|van damme|golden gala|bislett|herculis|diamond league|areva|meeting de paris|crystal palace|aviva|london grand prix|anniversary games|dn galan|bauhaus|stockholm|shanghai|doha|qatar|adidas grand prix|world championships in athletics|olympic games|european athletics championships|european championships|birmingham|monaco|gateshead|ostrava golden spike)/i;

function isQualityMeet(c: { rankingCategory: string; name: string }): boolean {
  if (ALLOWED_CATEGORIES.has(c.rankingCategory)) return true;
  if (c.rankingCategory === "Pre 2018" && PRE_2018_FAMOUS.test(c.name)) {
    return true;
  }
  return false;
}

/** Meet/championship names to search — biased to recognizable athletes. */
const MEET_QUERIES = [
  "Wanda Diamond League",
  "Diamond League",
  "Continental Tour Gold",
  "World Championships in Athletics",
  "IAAF World Championships",
  "London Grand Prix",
  "DN Galan",
  "Prefontaine Classic",
  "Athletissima",
  "Weltklasse",
  "Memorial van Damme",
  "Golden Gala",
  "Bislett Games",
  "Meeting de Paris",
  "Herculis",
  "London Athletics Meet",
  "Anniversary Games",
  "Doha",
  "Shanghai",
  "Rabat",
  "Stockholm",
  "Silesia",
  "Suzhou",
  "Xiamen",
  "Oslo",
  "Rome",
  "Brussels",
  "Eugene",
  "Hengelo",
  "Ostrava",
  "Lausanne",
  "Monaco",
  "World Athletics Championships",
  "Olympic Games",
  "European Athletics Championships",
  "Continental Tour",
  "USATF",
  "World Indoor Championships",
  "European Indoor",
];

/** Track disciplines where "who won" + a finishing mark make a clean duel. */
const DISCIPLINES = new Set([
  "100",
  "200",
  "400",
  "800",
  "1500",
  "Mile",
  "3000",
  "3000SC",
  "5000",
  "10000",
  "60",
  "100H",
  "110H",
  "400H",
  "60H",
]);

/** Races we keep — skip heats/prelims so athletes stay relatively elite. */
function isQualityRace(race: string): boolean {
  const r = race.toLowerCase();
  if (r.includes("heat") || r.includes("prelim") || r.includes("round 1")) {
    return false;
  }
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const athleteCache = new Map<number, Athlete | null>();

async function fetchAthleteCached(id: number): Promise<Athlete | null> {
  if (athleteCache.has(id)) return athleteCache.get(id) ?? null;
  await sleep(API_DELAY_MS);
  try {
    const a = await getAthlete(id);
    athleteCache.set(id, a);
    return a;
  } catch {
    athleteCache.set(id, null);
    return null;
  }
}

function shortDiscipline(discipline: string): string {
  return discipline
    .replace(",", "")
    .replace(" Metres Hurdles", "m Hurdles")
    .replace(" Metres Steeplechase", "m SC")
    .replace(" Metres", "m");
}

function formatWind(wind: number | null | undefined): string {
  if (wind === null || wind === undefined) return "—";
  return `${wind > 0 ? "+" : ""}${wind.toFixed(1)} m/s`;
}

function buildAthlete(opts: {
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
  const seasons = opts.athlete.activeSeasons.length;
  if (!pb || seasons === 0) return null;
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

let inserted = 0;
let skipped = 0;
let meetInserted = 0; // reset per competition (PER_MEET_CAP)

/** Discover elite meets across all the search queries, deduped, shuffled so
 * the year mix is varied (not just the most recent meets). */
async function discoverCompetitions() {
  const byId = new Map<number, { id: number; name: string; start: string }>();
  for (const q of MEET_QUERIES) {
    await sleep(API_DELAY_MS);
    try {
      const comps = await searchCompetitions(q);
      for (const c of comps) {
        if (c.hasResults && isQualityMeet(c) && !byId.has(c.id)) {
          byId.set(c.id, { id: c.id, name: c.name, start: c.start });
        }
      }
    } catch {
      // skip a failed search
    }
  }
  // shuffle for year variety, but put pre-2018 meets first so an incremental
  // run fills from the older years (the recent ones are already seeded)
  const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  };
  const all = [...byId.values()];
  const old = shuffle(all.filter((c) => Number(c.start.slice(0, 4)) < 2018));
  const recent = shuffle(
    all.filter((c) => Number(c.start.slice(0, 4)) >= 2018),
  );
  return [...old, ...recent];
}

/** Generate + insert duels for one already-fetched event's races. */
async function processEvent(
  meet: { id: number; name: string },
  event: {
    discipline: string;
    disciplineCode: string;
    isTechnical: boolean;
    sex: string;
    races: CompetitionResultsRace[];
  },
) {
  if (event.isTechnical || !DISCIPLINES.has(event.disciplineCode)) return;
  const sexLabel = event.sex === "W" ? "Women's" : "Men's";

  for (const race of event.races) {
    if (!isQualityRace(race.race)) continue;
    const ranked = race.results
      .filter((r) => r.athletes.length === 1)
      .sort((a, b) => a.place - b.place)
      .slice(0, TOP_N);

    for (let i = 0; i + 1 < ranked.length; i++) {
      if (inserted >= TARGET || meetInserted >= PER_MEET_CAP) return;
      const win = ranked[i]!;
      const lose = ranked[i + 1]!;
      const wa = win.athletes[0]!;
      const la = lose.athletes[0]!;
      if (!wa.id || !la.id || !wa.birthdate || !la.birthdate) continue;
      if (win.mark === lose.mark) continue; // ambiguous "who won"

      const [winAth, loseAth] = [
        await fetchAthleteCached(wa.id),
        await fetchAthleteCached(la.id),
      ];
      if (!winAth || !loseAth) {
        skipped++;
        continue;
      }

      const winner = buildAthlete({
        waId: wa.id,
        firstname: wa.firstname,
        lastname: wa.lastname,
        country: win.country,
        born: new Date(wa.birthdate).getFullYear(),
        athlete: winAth,
        disciplineCode: event.disciplineCode,
        time: win.mark,
      });
      const loser = buildAthlete({
        waId: la.id,
        firstname: la.firstname,
        lastname: la.lastname,
        country: lose.country,
        born: new Date(la.birthdate).getFullYear(),
        athlete: loseAth,
        disciplineCode: event.disciplineCode,
        time: lose.mark,
      });
      if (!winner || !loser) {
        skipped++;
        continue;
      }

      const winnerSide = (wa.id + la.id) % 2 === 0 ? 0 : 1;
      const [athleteA, athleteB] =
        winnerSide === 0 ? [winner, loser] : [loser, winner];
      const year = race.date
        ? new Date(race.date).getFullYear()
        : new Date().getFullYear();
      const stadium = win.location?.stadium ?? win.location?.city ?? "Unknown";
      const sourceKey = `${meet.id}:${race.raceId}:${Math.min(wa.id, la.id)}:${Math.max(wa.id, la.id)}`;

      const res = await db
        .insert(duels)
        .values({
          event: `${sexLabel} ${shortDiscipline(event.discipline)} · ${meet.name}`,
          year,
          stadium,
          wind: formatWind(win.wind),
          disciplineCode: event.disciplineCode,
          sex: event.sex,
          athleteA,
          athleteB,
          winnerSide,
          waCompetitionId: meet.id,
          waRaceId: race.raceId,
          sourceKey,
        })
        .onConflictDoNothing()
        .returning({ id: duels.id });

      if (res.length > 0) {
        inserted++;
        meetInserted++;
      } else skipped++;
    }
  }
}

async function main() {
  console.log("Discovering competitions…");
  const comps = await discoverCompetitions();
  console.log(`Found ${comps.length} competitions with results.\n`);

  let processed = 0;
  for (const meet of comps) {
    if (inserted >= TARGET || processed >= MAX_COMPETITIONS) break;
    processed++;
    meetInserted = 0;
    await sleep(API_DELAY_MS);

    let base;
    try {
      base = await getCompetitionResults(meet.id);
    } catch {
      continue;
    }

    // events present directly in the base payload
    for (const ev of base.events) {
      if (inserted >= TARGET) break;
      await processEvent(meet, ev);
    }

    // championships only list events in `options`; fetch the track ones
    const baseIds = new Set(base.events.map((e) => e.eventId));
    const extra = (base.options?.events ?? []).filter(
      (o) =>
        DISCIPLINES.has(o.disciplineCode) && !o.combined && !baseIds.has(o.id),
    );
    for (const opt of extra) {
      if (inserted >= TARGET) break;
      await sleep(API_DELAY_MS);
      try {
        const scoped = await getCompetitionResults(meet.id, {
          eventId: opt.id,
        });
        for (const ev of scoped.events) {
          if (inserted >= TARGET) break;
          await processEvent(meet, ev);
        }
      } catch {
        // skip event
      }
    }

    console.log(
      `[${processed}/${comps.length}] ${meet.name} — ${inserted} duels so far`,
    );
  }

  console.log(
    `\nDone. Inserted ${inserted} new duels (skipped ${skipped} dupes/missing).`,
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
