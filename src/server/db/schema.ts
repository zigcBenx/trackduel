import { relations } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `trackduel_${name}`);

/** One side of a duel, denormalized at seed time — exactly what the card renders. */
export type DuelAthlete = {
  waId: number | null;
  name: string;
  country: string;
  flag: string;
  born: number;
  seasons: number;
  pb: string;
  bib: number;
  /** Finish mark in this race, e.g. "9.63" — never sent to the client pre-pick. */
  time: string;
};

export const duels = createTable(
  "duel",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    event: d.varchar({ length: 256 }).notNull(),
    year: d.integer().notNull(),
    stadium: d.varchar({ length: 256 }).notNull(),
    wind: d.varchar({ length: 32 }).notNull(),
    disciplineCode: d.varchar({ length: 32 }).notNull(),
    sex: d.varchar({ length: 8 }).notNull(),
    athleteA: d.jsonb().$type<DuelAthlete>().notNull(),
    athleteB: d.jsonb().$type<DuelAthlete>().notNull(),
    winnerSide: d.smallint().notNull(), // 0 = athleteA, 1 = athleteB
    waCompetitionId: d.integer().notNull(),
    waRaceId: d.integer().notNull(),
    /** `${competitionId}:${raceId}:${aId}:${bId}` — dedup key for seed re-runs. */
    sourceKey: d.varchar({ length: 128 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [uniqueIndex("duel_source_key_idx").on(t.sourceKey)],
);

/** One answered duel by one user. Each duel scores only once per user
 * (unique index) so reveals can't be farmed for points. */
export const plays = createTable(
  "play",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    duelId: d
      .integer()
      .notNull()
      .references(() => duels.id),
    pick: d.smallint(), // null = timeout
    correct: d.boolean().notNull(),
    points: d.integer().notNull(),
    streakAfter: d.integer().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    uniqueIndex("play_user_duel_idx").on(t.userId, t.duelId),
    index("play_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const playsRelations = relations(plays, ({ one }) => ({
  user: one(users, { fields: [plays.userId], references: [users.id] }),
  duel: one(duels, { fields: [plays.duelId], references: [duels.id] }),
}));

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  /** bcrypt hash; null for OAuth-only accounts */
  passwordHash: d.varchar({ length: 255 }),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
