import { NextRequest, NextResponse } from "next/server";

const BAND_API_URL = process.env.BAND_REST_URL || "https://app.band.ai";

function bandHeaders(apiKey: string) {
  return {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

interface AgentSpec {
  id: string;
  name: string;
}

function getAgents(): AgentSpec[] {
  return [
    { id: process.env.BAND_RESEARCHER_AGENT_ID || "", name: "Nuncio Researcher" },
    { id: process.env.BAND_COPYWRITER_AGENT_ID || "", name: "Nuncio Copywriter" },
    { id: process.env.BAND_REVIEWER_AGENT_ID || "", name: "Nuncio Reviewer" },
    { id: process.env.BAND_PRODUCER_AGENT_ID || "", name: "Nuncio Producer" },
  ].filter((a) => a.id);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.BAND_RESEARCHER_API_KEY || process.env.BAND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Band API key not configured" }, { status: 503 });
  }

  const agents = getAgents();
  if (agents.length < 4) {
    return NextResponse.json(
      { error: "Not all Band agents configured — need all 4 agent IDs" },
      { status: 503 },
    );
  }

  const body = await request.json();
  const { url, sessionId, senderBrief, senderName } = body;

  if (!url || !sessionId) {
    return NextResponse.json({ error: "url and sessionId required" }, { status: 400 });
  }

  const researcher = agents[0];

  try {
    // 1. Create room
    const roomRes = await fetch(`${BAND_API_URL}/api/v1/agent/chats`, {
      method: "POST",
      headers: bandHeaders(apiKey),
      body: JSON.stringify({ chat: {} }),
    });

    if (!roomRes.ok) {
      const err = await roomRes.text();
      console.error("[band/room] Create room failed:", roomRes.status, err);
      return NextResponse.json({ error: "Failed to create Band room" }, { status: 502 });
    }

    const roomData = await roomRes.json();
    const roomId = roomData?.data?.id || roomData?.id;
    if (!roomId) {
      console.error("[band/room] No room ID in response:", roomData);
      return NextResponse.json({ error: "No room ID returned" }, { status: 502 });
    }

    // 2. Add all agents as participants
    for (const agent of agents) {
      const partRes = await fetch(
        `${BAND_API_URL}/api/v1/agent/chats/${roomId}/participants`,
        {
          method: "POST",
          headers: bandHeaders(apiKey),
          body: JSON.stringify({ participant_id: agent.id, role: "member" }),
        },
      );
      if (!partRes.ok) {
        const err = await partRes.text();
        console.warn(`[band/room] Add participant ${agent.name} failed:`, partRes.status, err);
      }
    }

    // 3. Post kickoff message @mentioning the researcher
    const briefContext = senderBrief
      ? `\nContext: ${senderBrief}`
      : "";
    const senderContext = senderName
      ? `\nSender: ${senderName}`
      : "";

    const content = `@${researcher.name} Please research this profile and enrich it for a personalised outreach video.\n\nProfile URL: ${url}\nSession ID: ${sessionId}${briefContext}${senderContext}`;

    const msgRes = await fetch(
      `${BAND_API_URL}/api/v1/agent/chats/${roomId}/messages`,
      {
        method: "POST",
        headers: bandHeaders(apiKey),
        body: JSON.stringify({
          message: {
            content,
            mentions: [
              { id: researcher.id, name: researcher.name },
            ],
          },
        }),
      },
    );

    if (!msgRes.ok) {
      const err = await msgRes.text();
      console.error("[band/room] Post message failed:", msgRes.status, err);
    }

    // Room URL on Band platform
    const roomUrl = `https://app.band.ai/chats/${roomId}`;

    return NextResponse.json({ roomId, roomUrl });
  } catch (err) {
    console.error("[band/room] Error:", err);
    return NextResponse.json(
      { error: "Band room creation failed" },
      { status: 500 },
    );
  }
}
