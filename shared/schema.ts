import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Document contents are not stored in this table. Results stay in a bounded,
// short-lived memory cache; metadata permits an honest interrupted/expired state.
export const documentTasks = sqliteTable("document_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  filename: text("filename").notNull(),
  mode: text("mode").notNull(),
  state: text("state").notNull(),
  stage: text("stage").notNull(),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at"),
});
export const insertDocumentTaskSchema = createInsertSchema(documentTasks);
export type DocumentTaskStatus = {
  id: string;
  filename: string;
  mode: "pdf" | "docx";
  state: "queued" | "processing" | "ready" | "failed" | "expired" | "interrupted";
  stage: string;
  error?: string;
  createdAt: number;
  expiresAt: number | null;
};

export const trialBalances = sqliteTable("trial_balances", {
  userId: text("user_id").primaryKey(),
  allocated: integer("allocated").notNull(),
  used: integer("used").notNull().default(0),
});
export const insertTrialBalanceSchema = createInsertSchema(trialBalances);
export type InsertTrialBalance = z.infer<typeof insertTrialBalanceSchema>;
export type TrialBalance = typeof trialBalances.$inferSelect;

export const trialDebits = sqliteTable("trial_debits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  refunded: integer("refunded").notNull().default(0),
  jobId: integer("job_id").unique(),
  createdAt: integer("created_at").notNull(),
});
export const insertTrialDebitSchema = createInsertSchema(trialDebits);
export type InsertTrialDebit = z.infer<typeof insertTrialDebitSchema>;
export type TrialDebit = typeof trialDebits.$inferSelect;

// New public trials only. Legacy trial_balances rows retain their existing terms.
export const freeTrialActivations = sqliteTable("free_trial_activations", {
  userId: text("user_id").primaryKey(),
  emailHash: text("email_hash").notNull().unique(),
  startsAt: integer("starts_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const insertFreeTrialActivationSchema = createInsertSchema(freeTrialActivations);
export type InsertFreeTrialActivation = z.infer<typeof insertFreeTrialActivationSchema>;
export type FreeTrialActivation = typeof freeTrialActivations.$inferSelect;

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

export const likelyHumanVisits = sqliteTable("likely_human_visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorIdHash: text("visitor_id_hash").notNull(),
  visitDate: text("visit_date").notNull(),
  firstPath: text("first_path").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => ({
  visitorDayUnique: uniqueIndex("likely_human_visits_visitor_day_unique").on(
    table.visitorIdHash,
    table.visitDate,
  ),
}));

export const insertLikelyHumanVisitSchema = createInsertSchema(likelyHumanVisits).omit({ id: true });
export type InsertLikelyHumanVisit = z.infer<typeof insertLikelyHumanVisitSchema>;
export type LikelyHumanVisit = typeof likelyHumanVisits.$inferSelect;
