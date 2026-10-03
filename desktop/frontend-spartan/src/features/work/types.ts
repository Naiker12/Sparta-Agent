export type WorkStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled" | "needs_review";

export type WorkRun = {
  id: string;
  status: WorkStatus;
  created_at: number;
  updated_at: number;
  attempt: number;
  source_kind: "manual" | "chat_queue";
  source_thread_id: string | null;
  source_queue_id: string | null;
  source_item_id: string | null;
  thread_title: string | null;
  project_name: string | null;
  request: { prompt?: string; promptPreview?: string; modelId?: string; selection?: { modelId?: string } };
  result: { summary?: string; reason?: string; messageId?: string | null; observedBy?: string } | null;
};

export type WorkOverview = { runs: WorkRun[]; hasMore: boolean; offset: number };
export type WorkEvent = { revision: number; event_type: string; created_at: number; data: Record<string, unknown> };
