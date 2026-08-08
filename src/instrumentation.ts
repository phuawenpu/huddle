/**
 * Next.js Instrumentation — runs once at server startup.
 * The actual DB schema init is handled lazily by db.ts on first Prisma access.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("Critique HUD server starting...");
    // Do not accept the first API request until a fresh SQLite database has
    // finished creating its schema. Route modules share this same promise.
    const { databaseReady } = await import("@/lib/db");
    await databaseReady;
    if (process.env.ASR_STUB === "1") {
      // Next's server bundler can expose an incompatible optional bufferutil
      // shim to ws. Force ws's built-in JavaScript mask implementation in the
      // development stub; production ASR runs in the browser and is unaffected.
      process.env.WS_NO_BUFFER_UTIL = "1";
      const globalForASR = globalThis as typeof globalThis & {
        huddleASRStub?: Promise<unknown>;
      };
      globalForASR.huddleASRStub ??= import("@/lib/stubs/assemblyai").then(
        ({ startASRStub }) => startASRStub({ validateAudio: true }),
      );
      await globalForASR.huddleASRStub;
      console.log("AssemblyAI streaming stub ready");
    }
  }
}
