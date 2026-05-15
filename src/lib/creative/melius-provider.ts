import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

const MELIUS_API_KEY = process.env.MELIUS_API_KEY;
const MELIUS_MCP_URL = "https://api.melius.com/mcp";
const MELIUS_RUN_TIMEOUT_SECONDS = Number(process.env.MELIUS_RUN_TIMEOUT_SECONDS || 30);
let mcpSessionId: string | null = null;

async function getMcpSessionId(): Promise<string> {
  if (mcpSessionId) return mcpSessionId;
  if (!MELIUS_API_KEY) {
    throw new Error("MELIUS_API_KEY is not configured");
  }

  const response = await fetch(MELIUS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${MELIUS_API_KEY}`,
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
  return sessionId;
}

/**
 * Call a Melius MCP tool.
 * MCP uses JSON-RPC 2.0 over HTTP with Bearer auth.
 */
async function mcpCall<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!MELIUS_API_KEY) {
    throw new Error("MELIUS_API_KEY is not configured");
  }

  const sessionId = await getMcpSessionId();

  const response = await fetch(MELIUS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${MELIUS_API_KEY}`,
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

  // MCP tool results come in data.result.content[0].text (JSON stringified)
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

export class MeliusProvider implements CreativeProvider {
  readonly name = "melius";

  private projectId: string | null = null;
  private canvasId: string | null = null;
  private nodeIds: Map<string, string> = new Map();
  private guideLoaded = false;

  private async ensureGuide(): Promise<void> {
    if (this.guideLoaded) return;
    await mcpCall<string>("get_guide", { topic: "getting-started" });
    this.guideLoaded = true;
  }

  async createSession(targetName: string): Promise<CreativeSession> {
    await this.ensureGuide();

    // 1. Create project
    const project = await mcpCall<MeliusProject>("project_create", {
      title: `nuncio — ${targetName} — ${Date.now()}`,
      description: "Autonomous nuncio personalized video outreach session",
    });
    this.projectId = project.id || project.projectId || null;
    if (!this.projectId) throw new Error("Melius project_create did not return an id");

    // 2. Create canvas
    const canvas = await mcpCall<MeliusCanvas>("canvas_create", {
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

  async generateBackground(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset> {
    if (!this.canvasId) throw new Error("No active canvas");

    // Create image node
    const nodes = await mcpCall<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [
        {
          nodeType: "image",
          title: "Video Background",
          prompt,
          aspectRatio: "16:9",
          geometry: { x: 0, y: 0, w: 420, h: 236 },
        },
      ],
    });

    const nodeId = nodes.nodes[0].id || nodes.nodes[0].nodeId;
    if (!nodeId) throw new Error("Melius bulk_create_nodes did not return a background node id");
    this.nodeIds.set("background", nodeId);

    // Start generation
    const run = await mcpCall<MeliusBulkRun>("bulk_run_start", {
      canvasId: this.canvasId,
      nodeIds: [nodeId],
    });
    const bulkRunId = run.id || run.bulkRunId;

    // Wait for completion
    await mcpCall<MeliusRunResult>("bulk_run_wait", {
      bulkRunId,
      timeoutSeconds: MELIUS_RUN_TIMEOUT_SECONDS,
      intervalSeconds: 3,
    });

    // Download
    const download = await mcpCall<{ outputs: { url: string }[] }>(
      "bulk_run_download",
      { bulkRunId }
    );

    const url = download.outputs?.[0]?.url || "";

    const asset: GeneratedAsset = {
      type: "background",
      url,
      prompt,
      provider: this.name,
    };

    session.assets.push(asset);
    return asset;
  }

  async generateThumbnail(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset> {
    if (!this.canvasId) throw new Error("No active canvas");

    const nodes = await mcpCall<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [
        {
          nodeType: "image",
          title: "Video Thumbnail",
          prompt,
          aspectRatio: "16:9",
          geometry: { x: 460, y: 0, w: 420, h: 236 },
        },
      ],
    });

    const nodeId = nodes.nodes[0].id || nodes.nodes[0].nodeId;
    if (!nodeId) throw new Error("Melius bulk_create_nodes did not return a thumbnail node id");
    this.nodeIds.set("thumbnail", nodeId);

    const run = await mcpCall<MeliusBulkRun>("bulk_run_start", {
      canvasId: this.canvasId,
      nodeIds: [nodeId],
    });
    const bulkRunId = run.id || run.bulkRunId;

    await mcpCall<MeliusRunResult>("bulk_run_wait", {
      bulkRunId,
      timeoutSeconds: MELIUS_RUN_TIMEOUT_SECONDS,
      intervalSeconds: 3,
    });

    const download = await mcpCall<{ outputs: { url: string }[] }>(
      "bulk_run_download",
      { bulkRunId }
    );

    const url = download.outputs?.[0]?.url || "";

    const asset: GeneratedAsset = {
      type: "thumbnail",
      url,
      prompt,
      provider: this.name,
    };

    session.assets.push(asset);
    return asset;
  }

  async storeText(
    session: CreativeSession,
    label: string,
    content: string
  ): Promise<void> {
    if (!this.canvasId) throw new Error("No active canvas");

    const response = await mcpCall<{ nodes?: MeliusNode[] } | undefined>("bulk_create_nodes", {
      canvasId: this.canvasId,
      nodes: [
        {
          nodeType: "custom_text",
          title: label,
          text: content,
          geometry: { x: 0, y: label === "Script" ? 280 : 520, w: 420, h: 180 },
        },
      ],
    });

    const nodes = response?.nodes;
    if (!nodes || nodes.length === 0) {
      console.warn(`[melius] bulk_create_nodes returned no nodes for ${label}, skipping text storage`);
      return;
    }

    const nodeId = nodes[0].id || nodes[0].nodeId;
    if (!nodeId) {
      console.warn(`[melius] bulk_create_nodes did not return a node id for ${label}, skipping text storage`);
      return;
    }

    // Set the text content
    await mcpCall<void>("node_set_text", {
      nodeId,
      text: content,
    });

    this.nodeIds.set(label, nodeId);
  }

  async finalise(session: CreativeSession): Promise<CreativeSession> {
    // All generations are already complete (we wait inline).
    // Add a comment as an audit trail.
    if (this.canvasId) {
      try {
        await mcpCall<void>("comment_create", {
          canvasId: this.canvasId,
          body: `nuncio session completed. ${session.assets.length} assets generated.`,
          x: 0,
          y: -100,
        });
      } catch {
        // Non-critical — don't fail the pipeline for a comment
      }
    }

    return session;
  }

  async export(session: CreativeSession): Promise<string | null> {
    if (!this.canvasId) return null;

    try {
      const result = await mcpCall<{ url: string }>("creative_download", {
        canvasId: this.canvasId,
      });
      session.exportUrl = result.url;
      return result.url;
    } catch {
      return null;
    }
  }
}
