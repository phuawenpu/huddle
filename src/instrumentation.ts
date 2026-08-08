/**
 * Next.js Instrumentation — runs once at server startup.
 * The actual DB schema init is handled lazily by db.ts on first Prisma access.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("Critique HUD server starting...");
    if (process.env.ASR_STUB === "1") {
      const globalForASR = globalThis as typeof globalThis & {
        huddleASRStub?: Promise<unknown>;
      };
      globalForASR.huddleASRStub ??= import("@/lib/stubs/assemblyai").then(
        ({ startASRStub }) => startASRStub({ validateAudio: true })
      );
      await globalForASR.huddleASRStub;
      console.log("AssemblyAI streaming stub ready");
    }
  }
}
