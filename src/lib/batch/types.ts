export interface BatchJob {
  id: string;
  url: string;
  recipientName?: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Batch {
  id: string;
  name: string;
  senderBrief: string;
  senderName?: string;
  creatorEmail?: string;
  /** Workspace that owns this batch. Absent on batches created before scoping. */
  workspaceId?: string;
  webhookUrl?: string;
  jobs: BatchJob[];
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  completedCount: number;
  failedCount: number;
}

export interface CreateBatchInput {
  name: string;
  urls: string[];
  senderBrief: string;
  senderName?: string;
  creatorEmail?: string;
  workspaceId?: string;
  webhookUrl?: string;
}
