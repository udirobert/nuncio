import http from "node:http";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { processConversationTurn } from "../lib/voice-agent/prompt";
import type { ConversationTurn } from "../lib/voice-agent/types";

const PORT = parseInt(process.env.VOICE_SERVER_PORT || "3001", 10);
const WS_PATH = process.env.VOICE_WS_PATH || "/api/voice/ws";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PUBLIC_URL = process.env.VOICE_PUBLIC_URL;

if (!ELEVENLABS_API_KEY) {
  console.error("[voice-server] ELEVENLABS_API_KEY not set");
  process.exit(1);
}

if (!PUBLIC_URL) {
  console.error("[voice-server] VOICE_PUBLIC_URL not set — use ngrok URL or production domain");
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

async function main() {
  const wsUrl = `${PUBLIC_URL!.replace(/\/$/, "")}${WS_PATH}`;
  console.log(`[voice-server] Creating Speech Engine with wsUrl: ${wsUrl}`);

  let engine;
  try {
    engine = await elevenlabs.speechEngine.create({
      name: "nuncio-voice-agent",
      speechEngine: { wsUrl },
    });
    console.log(`[voice-server] Speech Engine created: ${engine.engineId}`);
  } catch (err) {
    console.error("[voice-server] Failed to create Speech Engine:", err);
    process.exit(1);
  }

  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("voice-server running");
  });

  engine.attach(server, WS_PATH, {
    async onTranscript(transcript, signal, session) {
      console.log(`[voice-server] Transcript received: "${transcript.slice(0, 100)}..."`);

      const history: ConversationTurn[] = [{ role: "user", text: transcript }];

      try {
        const { agentResponse, extracted } = await processConversationTurn(history, transcript);
        console.log(`[voice-server] Agent response: "${agentResponse.slice(0, 100)}..."`);
        console.log(`[voice-server] Extracted: isComplete=${extracted.isComplete}`);

        session.sendResponse(agentResponse);

        if (extracted.isComplete) {
          console.log("[voice-server] Profile complete — sending to client");
          session.sendResponse(
            `\n\n[SYSTEM] PROFILE_READY: ${JSON.stringify(extracted)}`
          );
        }
      } catch (err) {
        console.error("[voice-server] LLM error:", err);
        session.sendResponse("Sorry, I hit a snag. Could you repeat that?");
      }
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
