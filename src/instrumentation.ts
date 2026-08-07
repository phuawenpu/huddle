/**
 * Next.js Instrumentation — runs once at server startup.
 * Initializes the database schema.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDbSchema } = await import("@/lib/db");
    await ensureDbSchema();
  }
}
