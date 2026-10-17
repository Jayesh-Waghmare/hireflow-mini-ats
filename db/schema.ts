// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const candidates = sqliteTable("candidates", {
 id: text("id").primaryKey(), owner: text("owner").notNull(),
 name: text("name").notNull(), email: text("email").notNull(),
 role: text("role").notNull(), stage: text("stage").notNull(),
 location: text("location").notNull(), skills: text("skills").notNull(),
 experience: integer("experience").notNull(), notes: text("notes").notNull(),
 source: text("source").notNull(), createdAt: text("created_at").notNull(),
 updatedAt: text("updated_at").notNull(), history: text("history").notNull(),
}, (t) => [uniqueIndex('candidate_owner_email_unique').on(t.owner,t.email)]);
