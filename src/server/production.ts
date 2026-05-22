import http from "node:http";
import next from "next";

const PORT = parseInt(process.env.PORT || "3000", 10);
const WS_PATH = "/api/voice/ws";

async function main() {
  const app = next({ dev: false, dir: process.cwd() });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => {
    handle(req, res);
  });

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
        async onTranscript(transcript, _signal, session) {
          console.log(`[voice] Transcript: "${transcript.slice(0, 80)}..."`);

          try {
            const { agentResponse, extracted } =
              await processConversationTurn(
                [{ role: "user", text: transcript }],
                transcript,
              );

            session.sendResponse(agentResponse);

            if (extracted.isComplete) {
              const profileJson = JSON.stringify(extracted);
              session.sendResponse(
                `\n\n[SYSTEM] PROFILE_READY: ${profileJson}`,
              );
            }
          } catch (err) {
            console.error("[voice] LLM error:", err);
            session.sendResponse("Sorry, could you repeat that?");
          }
        },
      });

      console.log(`[server] Speech Engine attached: ${engine.engineId}`);
    } catch (err) {
      console.error("[server] Speech Engine init failed (non-fatal):", err);
    }
  } else {
    console.log("[server] Speech Engine disabled — missing SPEECH_ENGINE_ID");
  }

  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal:", err);
  process.exit(1);
});
