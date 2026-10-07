import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Thin streamable-HTTP MCP adapter stub for ChatGPT plugin review.
 *
 * Full MCP SDK (SSE + session) is deferred — this route accepts JSON-RPC-shaped
 * `tools/list` and `tools/call` and proxies `research_and_draft` to the free
 * REST tool. Prefer calling POST /api/mcp/research-and-draft directly.
 *
 * What remains for production ChatGPT directory listing:
 * - Official MCP Streamable HTTP transport (sessions, SSE notifications)
 * - OAuth / demo account for review
 * - Privacy policy URL + support contact on the listing
 */

const TOOLS_PATH = "/api/mcp/tools";
const RESEARCH_PATH = "/api/mcp/research-and-draft";

function originFrom(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = originFrom(request);
  return NextResponse.json({
    ok: true,
    service: "nuncio-mcp",
    transport: "http-jsonrpc-stub",
    note: "Thin adapter. Use GET /api/mcp/tools for discovery and POST /api/mcp/research-and-draft for the free wedge. Full streamable HTTP MCP (SSE sessions) is listed under Remaining.",
    toolsUrl: `${origin}${TOOLS_PATH}`,
    freeToolUrl: `${origin}${RESEARCH_PATH}`,
    methods: ["tools/list", "tools/call"],
    remaining: [
      "MCP Streamable HTTP transport with SSE session lifecycle",
      "OAuth for account-linked paid entitlements (render/livelink)",
      "Directory listing: privacy policy, support email, example prompts",
    ],
  });
}

export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  let rpc: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try {
    rpc = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const id = rpc.id ?? null;

  if (rpc.method === "tools/list" || rpc.method === "tools/listChanged") {
    const res = await fetch(`${origin}${TOOLS_PATH}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const payload = await res.json();
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: (payload.tools || []).map(
          (t: {
            name: string;
            description: string;
            inputSchema: unknown;
            annotations?: unknown;
          }) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: t.annotations,
          }),
        ),
      },
    });
  }

  if (rpc.method === "tools/call") {
    const params = rpc.params || {};
    const name = typeof params.name === "string" ? params.name : "";
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (name !== "research_and_draft") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name || "(missing)"}. Only research_and_draft is exposed in this stub.`,
        },
      });
    }

    const res = await fetch(`${origin}${RESEARCH_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Preserve client identity for rate limits when possible
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "user-agent": request.headers.get("user-agent") || "nuncio-mcp-stub",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const payload = await res.json();
    if (!res.ok) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(payload) }],
        },
      });
    }
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      },
    });
  }

  if (rpc.method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "nuncio", version: "0.1.0" },
        capabilities: { tools: {} },
        instructions:
          "Free tool research_and_draft researches a prospect URL and drafts a first message. Render/live link requires an existing nuncio account on the product site — never checkout in ChatGPT.",
      },
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${rpc.method || "(missing)"}. Stub supports initialize, tools/list, tools/call.`,
    },
  });
}
