import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  inputName: text("input_name"),
  result: text("result"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  clerkUserId: text("clerk_user_id"),
  pageCount: integer("page_count"),
  creditsUsed: integer("credits_used"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const checkerUsage = sqliteTable("checker_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  status: text("status").notNull(),
  score: integer("score"),
  criticalCount: integer("critical_count"),
  warningCount: integer("warning_count"),
  createdAt: integer("created_at").notNull(),
});

export const insertCheckerUsageSchema = createInsertSchema(checkerUsage).omit({ id: true });
export type InsertCheckerUsage = z.infer<typeof insertCheckerUsageSchema>;
export type CheckerUsage = typeof checkerUsage.$inferSelect;
