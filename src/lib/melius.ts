const MELIUS_API_KEY = process.env.MELIUS_API_KEY;
const MELIUS_MCP_URL = "https://api.melius.com/mcp";

export interface CanvasResult {
  canvasId: string;
  assetUrls: string[];
}

/**
 * Create a Melius canvas with the generated profile and script.
 * Organises creative assets for the video render.
 */
export async function createCanvas(
  profile: { name: string; [key: string]: unknown },
  script: string
): Promise<CanvasResult> {
  if (!MELIUS_API_KEY) {
    throw new Error("MELIUS_API_KEY is not configured");
  }

  // TODO: Implement full MCP agent flow:
  // 1. project_create
  // 2. canvas_create
  // 3. canvas_plan_layout
  // 4. bulk_create_nodes
  // 5. bulk_run_start
  // 6. bulk_run_wait
  // 7. bulk_run_download
  // 8. creative_download

  console.log(`[melius] Creating canvas for ${profile.name}`);
  console.log(`[melius] MCP URL: ${MELIUS_MCP_URL}`);
  console.log(`[melius] Script length: ${script.length} chars`);

  // Placeholder — return empty until MCP integration is wired
  return {
    canvasId: "placeholder",
    assetUrls: [],
  };
}
