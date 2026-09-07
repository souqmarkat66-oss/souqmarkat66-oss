import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone", { length: 20 }),
  passwordHash: text("password_hash"),
  isBanned: boolean("is_banned").default(false),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
});

// Password reset secrets are always stored as keyed hashes. A row is both the
// OTP challenge and (after successful verification) the short-lived reset proof.
export const passwordResetChallenges = pgTable(
  "password_reset_challenges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    channel: varchar("channel", { length: 10 }).notNull(),
    destinationMasked: varchar("destination_masked", { length: 255 }).notNull(),
    otpHash: varchar("otp_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
    proofHash: varchar("proof_hash", { length: 64 }),
    proofExpiresAt: timestamp("proof_expires_at"),
    verifiedAt: timestamp("verified_at"),
    usedAt: timestamp("used_at"),
    requestIpHash: varchar("request_ip_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_user_created_idx").on(table.userId, table.createdAt),
    index("password_reset_expiry_idx").on(table.expiresAt),
  ],
);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect & { isAdmin?: boolean };
