/**
 * Standalone voice server (dev / separate deployment).
 *
 * Used during development for debugging the Speech Engine WebSocket
 * integration without running a full production build.
 *
 * In production, `src/server/production.ts` handles both Next.js and the
 * Speech Engine on a single port.
 */

import http from "node:http";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { processConversationTurn } from "../lib/voice-agent/prompt";

const PORT = parseInt(process.env.VOICE_SERVER_PORT || "3001", 10);
const WS_PATH = process.env.VOICE_WS_PATH || "/api/voice/ws";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PUBLIC_URL = process.env.VOICE_PUBLIC_URL;

if (!ELEVENLABS_API_KEY) {
  console.error("[voice-server] ELEVENLABS_API_KEY not set");
  process.exit(1);
}

if (!PUBLIC_URL) {
  console.error(
    "[voice-server] VOICE_PUBLIC_URL not set — use ngrok URL or production domain"
  );
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

// Per-conversation history cache
const conversationHistory = new Map<
  string,
  Array<{ role: "user" | "agent"; text: string }>
>();

async function main() {
  // ── Create or resolve Speech Engine ────────────────────────────────
  const engineId = process.env.SPEECH_ENGINE_ID;
  const wsUrl = `${PUBLIC_URL!.replace(/\/$/, "")}${WS_PATH}`;
  console.log(`[voice-server] wsUrl: ${wsUrl}`);

  let engine;

  if (engineId) {
    console.log(`[voice-server] Fetching existing engine: ${engineId}`);
    engine = await elevenlabs.speechEngine.get(engineId);
    console.log(`[voice-server] Engine resolved: ${engine.engineId}`);
  } else {
    console.log("[voice-server] Creating new Speech Engine...");
    engine = await elevenlabs.speechEngine.create({
      name: "nuncio-voice-agent",
      speechEngine: { wsUrl },
    });
    console.log(`[voice-server] Engine created: ${engine.engineId}`);
    console.log(`[voice-server] Set SPEECH_ENGINE_ID=${engine.engineId} to reuse`);
  }

  // ── HTTP server (health endpoint) ──────────────────────────────────
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", engineId: engine.engineId }));
  });

  // ── Attach Speech Engine ───────────────────────────────────────────
  engine.attach(server, WS_PATH, {
    onInit(conversationId, _session) {
      console.log(`[voice-server] Init: ${conversationId}`);
      conversationHistory.set(conversationId, []);
    },

    async onTranscript(messages, _signal, session) {
      const convId = session.conversationId || "unknown";
      const history = conversationHistory.get(convId) || [];

      // Extract user messages from the transcript batch
      const userMessages = messages.filter((m) => m.role === "user");
      if (userMessages.length === 0) return;

      const latestUserText = userMessages.map((m) => m.content).join(" ");
      history.push({ role: "user", text: latestUserText });

      console.log(
        `[voice-server] Transcript (${convId}): "${latestUserText.slice(0, 100)}..."`
      );

      try {
        const { agentResponse, extracted } = await processConversationTurn(
          history,
          latestUserText
        );

        history.push({ role: "agent", text: agentResponse });

        console.log(
          `[voice-server] Agent response: "${agentResponse.slice(0, 100)}..."`
        );
        console.log(
          `[voice-server] Extracted: isComplete=${extracted.isComplete}`
        );

        session.sendResponse(agentResponse);

        if (extracted.isComplete) {
          console.log("[voice-server] Profile complete — sending to client");
          session.sendResponse(
            `\n[SYSTEM] PROFILE_READY: ${JSON.stringify(extracted)}`
          );
          conversationHistory.delete(convId);
        }
      } catch (err) {
        console.error("[voice-server] LLM error:", err);
        session.sendResponse("Sorry, I hit a snag. Could you repeat that?");
      }
    },

    onDisconnect(session) {
      const convId = session.conversationId;
      if (convId) conversationHistory.delete(convId);
    },
  });

  server.listen(PORT, () => {
    console.log(`[voice-server] Listening on port ${PORT} at path ${WS_PATH}`);
    console.log(`[voice-server] Public WebSocket URL: ${wsUrl}`);
  });
}

main().catch((err) => {
  console.error("[voice-server] Fatal error:", err);
  process.exit(1);
});
