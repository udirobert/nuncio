import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

const MELIUS_MCP_URL = "https://api.melius.com/mcp";
const MELIUS_RUN_TIMEOUT_SECONDS = Number(process.env.MELIUS_RUN_TIMEOUT_SECONDS || 30);

function resolveApiKey(override?: string): string {
  const key = override || process.env.MELIUS_API_KEY;
  if (!key) throw new Error("MELIUS_API_KEY is not configured");
  return key;
}

let mcpSessionId: string | null = null;
let mcpSessionApiKey: string | null = null;

export function resetMeliusSession(): void {
  mcpSessionId = null;
  mcpSessionApiKey = null;
}

async function getMcpSessionId(apiKey: string): Promise<string> {
  if (mcpSessionId && mcpSessionApiKey === apiKey) return mcpSessionId;

  const response = await fetch(MELIUS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "nuncio",
          version: "0.1.0",
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melius MCP initialize error (${response.status}): ${text}`);
  }

  const sessionId = response.headers.get("Mcp-Session-Id") || response.headers.get("mcp-session-id");
  if (!sessionId) {
    throw new Error("Melius MCP initialize did not return Mcp-Session-Id");
  }

  mcpSessionId = sessionId;
  mcpSessionApiKey = apiKey;
  return sessionId;
}

async function mcpCall<T>(
  method: string,
  params: Record<string, unknown>,
  apiKey: string
): Promise<T> {
  const sessionId = await getMcpSessionId(apiKey);

  const response = await fetch(MELIUS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: method,
        arguments: params,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melius MCP error (${response.status}): ${text}`);
  }

  const data = await readMcpResponse(response);

  if (data.error) {
    throw new Error(`Melius MCP error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const result = data.result as { content?: { text?: string }[] } | undefined;
  const content = result?.content?.[0]?.text;
  if (content) {
    if (content.startsWith("MCP error")) {
      throw new Error(`Melius MCP error: ${content}`);
    }
    try {
      return JSON.parse(content) as T;
    } catch {
      return content as T;
    }
  }

  return data.result as T;
}

async function readMcpResponse(response: Response): Promise<{
  error?: { message?: string };
  result?: { content?: { text?: string }[] } | unknown;
}> {
  const text = await response.text();
  const dataLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));

  const jsonText = dataLine ? dataLine.replace(/^data:\s*/, "") : text;
  return JSON.parse(jsonText);
}

interface MeliusProject {
  id: string;
  projectId?: string;
  name: string;
}

interface MeliusCanvas {
  id: string;
  canvasId?: string;
  name: string;
}

interface MeliusNode {
  id: string;
  nodeId?: string;
  type: string;
}

interface MeliusBulkRun {
  id: string;
  bulkRunId?: string;
  status: string;
}

interface MeliusRunResult {
  status: string;
  outputs?: { url: string }[];
}

export interface StudioNode {
  id: string;
  label: string;
  type: "custom_text" | "image" | "text" | "video" | "audio" | "group";
  status: "pending" | "generating" | "complete" | "failed";
  prompt?: string;
  outputUrl?: string;
  reasoning?: string;
}

export interface StudioBuildResult {
  projectId: string;
  canvasId: string;
  canvasUrl: string;
  userOwned?: boolean;
  nodes: StudioNode[];
  hook?: {
    archetype: string;
    reasoning: string;
    tier: "trial" | "free" | "pro" | "studio";
    remainingFree: number;
    canRegenerate: boolean;
    watermark: boolean;
    status: "complete" | "demo" | "failed" | "generating";
    format?: string;
    formatReasoning?: string;
    outputUrl?: string;
    warning?: string;
  };
}

export class MeliusProvider implements CreativeProvider {
  readonly name = "melius";

  public projectId: string | null = null;
  private canvasId: string | null = null;
  private nodeIds: Map<string, string> = new Map();
  private guideLoaded = false;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = resolveApiKey(apiKey);
  }

  private call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return mcpCall<T>(method, params, this.apiKey);
  }

  private async ensureGuide(topic?: string): Promise<void> {
    if (this.guideLoaded) return;
    await this.call<string>("get_guide", { topic: topic || "getting-started" });
    this.guideLoaded = true;
  }

  async createSession(targetName: string): Promise<CreativeSession> {
    await this.ensureGuide();

    const project = await this.call<MeliusProject>("project_create", {
      title: `nuncio — ${targetName} — ${Date.now()}`,
      description: "Autonomous nuncio personalised video outreach session",
      visibility: "public",
    });
    this.projectId = project.id || project.projectId || null;
    if (!this.projectId) throw new Error("Melius project_create did not return an id");

    const canvas = await this.call<MeliusCanvas>("canvas_create", {
      projectId: this.projectId,
      title: `nuncio session ${Date.now()}`,
    });
    this.canvasId = canvas.id || canvas.canvasId || null;
    if (!this.canvasId) throw new Error("Melius canvas_create did not return an id");

    return {
      id: this.canvasId,
      provider: this.name,
      assets: [],
      canvasUrl: `https://app.melius.com/canvas/${this.canvasId}`,
    };
  }

  async updateProjectVisibility(projectId: string, visibility: "public" | "private"): Promise<void> {
    await this.call("project_update", {
      projectId,
      visibility,
    });
  }

  async generateBackground(session: CreativeSession, prompt: string): Promise<GeneratedAsset> {
    if (!this.canvasId) throw new Error("No active canvas");

    const nodes = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [{
        nodeType: "image",
        title: "Video Background",
        prompt,
        aspectRatio: "16:9",
        geometry: { x: 0, y: 0, w: 420, h: 236 },
      }],
    });

    const nodeId = nodes.nodes[0].id || nodes.nodes[0].nodeId;
    if (!nodeId) throw new Error("Melius bulk_create_nodes did not return a background node id");
    this.nodeIds.set("background", nodeId);

    const run = await this.call<MeliusBulkRun>("bulk_run_start", {
      canvasId: this.canvasId,
      nodeIds: [nodeId],
    });
    const bulkRunId = run.id || run.bulkRunId;

    await this.call<MeliusRunResult>("bulk_run_wait", {
      bulkRunId,
      timeoutSeconds: MELIUS_RUN_TIMEOUT_SECONDS,
      intervalSeconds: 3,
    });

    const download = await this.call<{ outputs: { url: string }[] }>("bulk_run_download", { bulkRunId });

    const url = download.outputs?.[0]?.url || "";
    const asset: GeneratedAsset = { type: "background", url, prompt, provider: this.name };
    session.assets.push(asset);
    return asset;
  }

  async generateThumbnail(session: CreativeSession, prompt: string): Promise<GeneratedAsset> {
    if (!this.canvasId) throw new Error("No active canvas");

    const nodes = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [{
        nodeType: "image",
        title: "Video Thumbnail",
        prompt,
        aspectRatio: "16:9",
        geometry: { x: 460, y: 0, w: 420, h: 236 },
      }],
    });

    const nodeId = nodes.nodes[0].id || nodes.nodes[0].nodeId;
    if (!nodeId) throw new Error("Melius bulk_create_nodes did not return a thumbnail node id");
    this.nodeIds.set("thumbnail", nodeId);

    const run = await this.call<MeliusBulkRun>("bulk_run_start", {
      canvasId: this.canvasId,
      nodeIds: [nodeId],
    });
    const bulkRunId = run.id || run.bulkRunId;

    await this.call<MeliusRunResult>("bulk_run_wait", {
      bulkRunId,
      timeoutSeconds: MELIUS_RUN_TIMEOUT_SECONDS,
      intervalSeconds: 3,
    });

    const download = await this.call<{ outputs: { url: string }[] }>("bulk_run_download", { bulkRunId });

    const url = download.outputs?.[0]?.url || "";
    const asset: GeneratedAsset = { type: "thumbnail", url, prompt, provider: this.name };
    session.assets.push(asset);
    return asset;
  }

  async storeText(session: CreativeSession, label: string, content: string): Promise<void> {
    if (!this.canvasId) throw new Error("No active canvas");

    const response = await this.call<{ nodes?: MeliusNode[] } | undefined>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [{
        nodeType: "custom_text",
        title: label,
        text: content,
        geometry: { x: 0, y: label === "Script" ? 280 : 520, w: 420, h: 180 },
      }],
    });

    const nodes = response?.nodes;
    if (!nodes || nodes.length === 0) {
      console.warn(`[melius] bulk_create_nodes returned no nodes for ${label}`);
      return;
    }

    const nodeId = nodes[0].id || nodes[0].nodeId;
    if (!nodeId) {
      console.warn(`[melius] no node id for ${label}`);
      return;
    }

    await this.call<void>("node_set_text", { nodeId, text: content });
    this.nodeIds.set(label, nodeId);
  }

  async finalise(session: CreativeSession): Promise<CreativeSession> {
    if (this.canvasId) {
      try {
        await this.call<void>("comment_create", {
          canvasId: this.canvasId,
          body: `nuncio session completed. ${session.assets.length} assets generated.`,
          x: 0, y: -100,
        });
      } catch { /* non-critical */ }
    }
    return session;
  }

  async export(session: CreativeSession): Promise<string | null> {
    if (!this.canvasId) return null;
    try {
      const result = await this.call<{ url: string }>("creative_download", { canvasId: this.canvasId });
      session.exportUrl = result.url;
      return result.url;
    } catch { return null; }
  }

  // ── Studio-specific MCP methods ──────────────────────────────────

  async claimPresence(canvasId: string, region: { x: number; y: number; w: number; h: number }): Promise<void> {
    await this.call<void>("show_presence", {
      canvasId,
      region: `${region.x},${region.y},${region.w},${region.h}`,
    });
  }

  async releasePresence(canvasId?: string): Promise<void> {
    await this.call<void>("release_presence", canvasId ? { canvasId } : {});
  }

  async createCustomTextNode(canvasId: string, title: string, text: string, geometry: { x: number; y: number; w: number; h: number }): Promise<string> {
    const result = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId,
      nodes: [{ nodeType: "custom_text", title, text, geometry }],
    });
    const nodeId = result.nodes[0]?.id || result.nodes[0]?.nodeId;
    if (!nodeId) throw new Error(`Failed to create custom_text node: ${title}`);
    await this.call<void>("node_set_text", { nodeId, text });
    return nodeId;
  }

  async createImageNode(canvasId: string, title: string, prompt: string, geometry: { x: number; y: number; w: number; h: number }): Promise<string> {
    const result = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId,
      nodes: [{ nodeType: "image", title, prompt, aspectRatio: "16:9", geometry }],
    });
    const nodeId = result.nodes[0]?.id || result.nodes[0]?.nodeId;
    if (!nodeId) throw new Error(`Failed to create image node: ${title}`);
    return nodeId;
  }

  async createVideoNode(
    canvasId: string,
    title: string,
    prompt: string,
    geometry: { x: number; y: number; w: number; h: number },
    sourceUrl?: string
  ): Promise<string> {
    const node: Record<string, unknown> = {
      nodeType: "video",
      title,
      prompt,
      aspectRatio: "16:9",
      geometry,
    };
    if (sourceUrl) {
      node.sourceUrl = sourceUrl;
      node.url = sourceUrl;
    }

    const result = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId,
      nodes: [node],
    });
    const nodeId = result.nodes[0]?.id || result.nodes[0]?.nodeId;
    if (!nodeId) throw new Error(`Failed to create video node: ${title}`);
    return nodeId;
  }

  async attachVideoToNode(nodeId: string, sourceUrl: string, canvasId?: string): Promise<void> {
    const params: Record<string, string> = { nodeId, sourceUrl, url: sourceUrl };
    if (canvasId) params.canvasId = canvasId;
    await this.call<void>("node_update", params);
  }

  async createTextLlmNode(canvasId: string, title: string, prompt: string, geometry: { x: number; y: number; w: number; h: number }): Promise<string> {
    const result = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId,
      nodes: [{ nodeType: "text", title, prompt, geometry }],
    });
    const nodeId = result.nodes[0]?.id || result.nodes[0]?.nodeId;
    if (!nodeId) throw new Error(`Failed to create text node: ${title}`);
    return nodeId;
  }

  async createGroupNode(canvasId: string, title: string, childNodeIds: string[], geometry?: { x: number; y: number; w: number; h: number }): Promise<string> {
    const result = await this.call<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId,
      nodes: [{ nodeType: "group", title, geometry }].map((n) =>
        childNodeIds.length ? { ...n, children: childNodeIds } : n
      ),
    });
    return result.nodes[0]?.id || result.nodes[0]?.nodeId || "";
  }

  async bulkCreateEdges(canvasId: string, edges: { sourceNodeId: string; targetNodeId: string; type?: string }[]): Promise<void> {
    await this.call<void>("bulk_create_edges", {
      canvasId,
      edges: edges.map((e) => ({
        srcNodeId: e.sourceNodeId,
        dstNodeId: e.targetNodeId,
        edgeType: e.type || "text",
      })),
    });
  }

  async updateNodePrompt(nodeId: string, prompt: string, canvasId?: string): Promise<void> {
    const params: Record<string, string> = { nodeId, prompt };
    if (canvasId) params.canvasId = canvasId;
    await this.call<void>("node_update", params);
  }

  async startRun(nodeId: string, canvasId?: string): Promise<string> {
    const params: Record<string, string> = { nodeId };
    if (canvasId) params.canvasId = canvasId;
    const result = await this.call<{ id: string; runId?: string; status: string }>("run_start", params);
    return result.id || result.runId || "";
  }

  async getRunStatus(runId: string, canvasId?: string): Promise<{ status: string; outputUrl?: string }> {
    const params: Record<string, string> = { runId };
    if (canvasId) params.canvasId = canvasId;
    const result = await this.call<{ status: string; outputs?: { url: string }[]; error?: string }>("run_get", params);
    return {
      status: result.status,
      outputUrl: result.outputs?.[0]?.url,
    };
  }

  async getCanvasContent(canvasId: string): Promise<{ nodes: StudioNode[] }> {
    const result = await this.call<{
      nodes: { id: string; title?: string; type: string; prompt?: string; status?: string; outputs?: { url: string }[] }[];
    }>("canvas_content", { canvasId });

    const nodes: StudioNode[] = (result.nodes || []).map((n) => {
      const type = n.type as StudioNode["type"];
      const isGenerative = type === "image" || type === "video";
      let status: StudioNode["status"];
      if (!isGenerative) {
        status = "complete";
      } else if (n.status === "completed" || n.outputs?.[0]?.url) {
        status = "complete";
      } else if (n.status === "running") {
        status = "generating";
      } else {
        status = "pending";
      }
      return { id: n.id, label: n.title || n.type, type, status, prompt: n.prompt, outputUrl: n.outputs?.[0]?.url };
    });

    return { nodes };
  }

  async planLayout(canvasId: string, nodes: { id: string; nodeType: string; w: number; h: number }[]): Promise<{ x: number; y: number }[]> {
    const result = await this.call<{ positions: { x: number; y: number }[] }>("canvas_plan_layout", {
      canvasId,
      nodes,
    });
    return result.positions || [];
  }

  async addComment(canvasId: string, body: string, x: number, y: number): Promise<void> {
    await this.call<void>("comment_create", { canvasId, body, x, y });
  }

  async getProjectShareUrl(projectId: string): Promise<string> {
    return `https://app.melius.com/project/${projectId}`;
  }

  async getCanvasEmbedUrl(canvasId: string): Promise<string> {
    return `https://app.melius.com/canvas/${canvasId}/embed`;
  }

  async exportCanvas(canvasId: string): Promise<string | null> {
    try {
      const result = await this.call<{ url: string }>("creative_download", { canvasId });
      return result.url;
    } catch {
      return null;
    }
  }
}
