/**
 * Next.js Instrumentation — runs once at server startup.
 * The actual DB schema init is handled lazily by db.ts on first Prisma access.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("Critique HUD server starting...");
  }
}
