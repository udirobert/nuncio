/**
 * Production server: Next.js + ElevenLabs Speech Engine WebSocket
 *
 * Started via `tsx src/server/production.ts` (the `start` script).
 *
 * When SPEECH_ENGINE_ID is set, attaches a Speech Engine WebSocket server
 * on the same HTTP port so that Twelve Labs's cloud connects directly.
 *
 * The browser never opens a raw WebSocket to this server — instead it uses
 * `@elevenlabs/client` `Conversation.startSession()` with a conversation
 * token from `/api/studio/voice/token`. ElevenLabs cloud then connects to
 * this server's WebSocket endpoint.
 */

import http from "node:http";
import next from "next";

const PORT = parseInt(process.env.PORT || "3000", 10);
const WS_PATH = "/api/voice/ws";

// Per-conversation history cache. Cleared when conversation ends.
const conversationHistory = new Map<string, Array<{ role: "user" | "agent"; text: string }>>();

async function main() {
  const app = next({ dev: false, dir: process.cwd() });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  // ── Speech Engine attachment ─────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const engineId = process.env.SPEECH_ENGINE_ID;
  const publicUrl = process.env.VOICE_PUBLIC_URL;

  if (apiKey && engineId && publicUrl) {
    console.log(`[server] Attaching Speech Engine at ${WS_PATH}`);

    try {
      const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
      const { processConversationTurn } = await import(
        "../lib/voice-agent/prompt"
      );

      const elevenlabs = new ElevenLabsClient({ apiKey });
      const engine = await elevenlabs.speechEngine.get(engineId);

      engine.attach(server, WS_PATH, {
        onInit(conversationId, _session) {
          console.log(`[voice] Init: ${conversationId}`);
          conversationHistory.set(conversationId, []);
        },

        async onTranscript(messages, _signal, session) {
          const convId = session.conversationId || "unknown";
          const history = conversationHistory.get(convId) || [];

          // Extract the user's latest utterance
          const userMessages = messages.filter((m) => m.role === "user");
          if (userMessages.length === 0) return; // skip agent echoes
          const latestUserText = userMessages.map((m) => m.content).join(" ");

          // Accumulate into history
          history.push({ role: "user", text: latestUserText });

          console.log(
            `[voice] Transcript (${convId}): "${latestUserText.slice(0, 80)}..."`
          );

          try {
            const { agentResponse, extracted } =
              await processConversationTurn(history, latestUserText);

            // Store agent response in history
            history.push({ role: "agent", text: agentResponse });

            session.sendResponse(agentResponse);

            if (extracted.isComplete) {
              const profileJson = JSON.stringify(extracted);
              console.log(`[voice] Profile complete for ${convId}`);
              // Send profile as a second message (the LLM response is
              // conversational text; this marker lets the browser overlay
              // detect completion without reading JSON aloud)
              session.sendResponse(
                `\n[SYSTEM] PROFILE_READY: ${profileJson}`
              );
              conversationHistory.delete(convId);
            }
          } catch (err) {
            console.error("[voice] LLM error:", err);
            session.sendResponse("Sorry, could you repeat that?");
          }
        },

        onClose(_session) {
          // Cleanup handled by isComplete path above
        },

        onDisconnect(session) {
          const convId = session.conversationId;
          if (convId) conversationHistory.delete(convId);
        },
      });

      console.log(`[server] Speech Engine attached: ${engine.engineId}`);
    } catch (err) {
      console.error(
        "[server] Speech Engine init failed (non-fatal):",
        err
      );
    }
  } else {
    console.log("[server] Speech Engine disabled — missing SPEECH_ENGINE_ID");
  }

  // ── Listen ──────────────────────────────────────────────────────────
  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exit(1);
});
