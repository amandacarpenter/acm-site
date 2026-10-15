import { z } from "zod";

export const simulationUsageEventSchema = z.object({
  runId: z.string().uuid(),
  fileType: z.enum(["PDF", "DOCX"]),
  source: z.enum(["homepage", "simulation-page"]),
  event: z.enum(["completed", "failed", "playback"]),
}).strict();
export type SimulationUsageEvent = z.infer<typeof simulationUsageEventSchema>;
export interface SimulationUsageSummary {
  today: number;
  last7Days: number;
  last30Days: number;
  completed30d: number;
  failed30d: number;
  playback30d: number;
  pdf30d: number;
  docx30d: number;
  recent: { runId: string; fileType: string; source: string; status: string; played: number; createdAt: number }[];
}
