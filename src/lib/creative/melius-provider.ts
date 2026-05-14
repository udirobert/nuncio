import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

const MELIUS_API_KEY = process.env.MELIUS_API_KEY;
const MELIUS_MCP_URL = "https://api.melius.com/mcp";

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

  const response = await fetch(MELIUS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MELIUS_API_KEY}`,
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

  const data = await response.json();

  if (data.error) {
    throw new Error(`Melius MCP error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // MCP tool results come in data.result.content[0].text (JSON stringified)
  const content = data.result?.content?.[0]?.text;
  if (content) {
    try {
      return JSON.parse(content) as T;
    } catch {
      return content as T;
    }
  }

  return data.result as T;
}

interface MeliusProject {
  id: string;
  name: string;
}

interface MeliusCanvas {
  id: string;
  name: string;
}

interface MeliusNode {
  id: string;
  type: string;
}

interface MeliusBulkRun {
  id: string;
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

  async createSession(targetName: string): Promise<CreativeSession> {
    // 1. Create project
    const project = await mcpCall<MeliusProject>("project_create", {
      name: `nuncio — ${targetName}`,
    });
    this.projectId = project.id;

    // 2. Create canvas
    const canvas = await mcpCall<MeliusCanvas>("canvas_create", {
      project_id: project.id,
      name: "nuncio session",
    });
    this.canvasId = canvas.id;

    return {
      id: canvas.id,
      provider: this.name,
      assets: [],
      canvasUrl: `https://app.melius.com/canvas/${canvas.id}`,
    };
  }

  async generateBackground(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset> {
    if (!this.canvasId) throw new Error("No active canvas");

    // Plan layout to avoid overlaps
    const layout = await mcpCall<{ positions: { x: number; y: number }[] }>(
      "canvas_plan_layout",
      {
        canvas_id: this.canvasId,
        count: 1,
      }
    );

    const position = layout.positions?.[0] || { x: 0, y: 0 };

    // Create image node
    const nodes = await mcpCall<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvas_id: this.canvasId,
      nodes: [
        {
          type: "image",
          prompt,
          x: position.x,
          y: position.y,
          label: "Video Background",
        },
      ],
    });

    const nodeId = nodes.nodes[0].id;
    this.nodeIds.set("background", nodeId);

    // Start generation
    const run = await mcpCall<MeliusBulkRun>("bulk_run_start", {
      canvas_id: this.canvasId,
      node_ids: [nodeId],
    });

    // Wait for completion
    await mcpCall<MeliusRunResult>("bulk_run_wait", {
      bulk_run_id: run.id,
      timeout: 60000,
    });

    // Download
    const download = await mcpCall<{ outputs: { url: string }[] }>(
      "bulk_run_download",
      { bulk_run_id: run.id }
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

    const layout = await mcpCall<{ positions: { x: number; y: number }[] }>(
      "canvas_plan_layout",
      {
        canvas_id: this.canvasId,
        count: 1,
      }
    );

    const position = layout.positions?.[0] || { x: 200, y: 0 };

    const nodes = await mcpCall<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvas_id: this.canvasId,
      nodes: [
        {
          type: "image",
          prompt,
          x: position.x,
          y: position.y,
          label: "Video Thumbnail",
        },
      ],
    });

    const nodeId = nodes.nodes[0].id;
    this.nodeIds.set("thumbnail", nodeId);

    const run = await mcpCall<MeliusBulkRun>("bulk_run_start", {
      canvas_id: this.canvasId,
      node_ids: [nodeId],
    });

    await mcpCall<MeliusRunResult>("bulk_run_wait", {
      bulk_run_id: run.id,
      timeout: 60000,
    });

    const download = await mcpCall<{ outputs: { url: string }[] }>(
      "bulk_run_download",
      { bulk_run_id: run.id }
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

    const layout = await mcpCall<{ positions: { x: number; y: number }[] }>(
      "canvas_plan_layout",
      {
        canvas_id: this.canvasId,
        count: 1,
      }
    );

    const position = layout.positions?.[0] || { x: 400, y: 0 };

    const nodes = await mcpCall<{ nodes: MeliusNode[] }>("bulk_create_nodes", {
      canvas_id: this.canvasId,
      nodes: [
        {
          type: "custom_text",
          x: position.x,
          y: position.y,
          label,
        },
      ],
    });

    const nodeId = nodes.nodes[0].id;

    // Set the text content
    await mcpCall<void>("node_set_text", {
      node_id: nodeId,
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
          canvas_id: this.canvasId,
          text: `nuncio session completed. ${session.assets.length} assets generated.`,
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
        canvas_id: this.canvasId,
      });
      session.exportUrl = result.url;
      return result.url;
    } catch {
      return null;
    }
  }
}
