import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  databaseReady?: Promise<void>;
};

const client = globalForPrisma.prisma || new PrismaClient();
export const prisma = client;
export const databaseReady =
  globalForPrisma.databaseReady || initializeDatabase(client);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
  globalForPrisma.databaseReady = databaseReady;
}

async function initializeDatabase(client: PrismaClient): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1 FROM Session LIMIT 1`;
  } catch {
    try {
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Scenario" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "topic" TEXT NOT NULL DEFAULT '', "domain" TEXT NOT NULL DEFAULT '', "workshopType" TEXT NOT NULL DEFAULT 'concept_critique', "objective" TEXT NOT NULL DEFAULT '', "phase" TEXT NOT NULL DEFAULT 'evaluate', "criteria" TEXT NOT NULL DEFAULT '[]', "language" TEXT NOT NULL DEFAULT 'en', "durationMinutes" INTEGER NOT NULL DEFAULT 8, "speakerCount" INTEGER NOT NULL DEFAULT 4, "difficulty" TEXT NOT NULL DEFAULT 'realistic', "crossTalkLevel" TEXT NOT NULL DEFAULT 'occasional', "participationProfile" TEXT NOT NULL DEFAULT 'even', "budgetJson" TEXT, "realizedDurationMs" INTEGER, "overlapRatioPct" REAL, "speakersJson" TEXT, "turnsJson" TEXT, "expectedWindowOutcomeJson" TEXT, "status" TEXT NOT NULL DEFAULT 'draft', "preflightJson" TEXT, "approvedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Session" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL DEFAULT 'Untitled', "objective" TEXT NOT NULL DEFAULT '', "phase" TEXT NOT NULL DEFAULT 'frame', "criteria" TEXT NOT NULL DEFAULT '[]', "speakerCount" INTEGER NOT NULL DEFAULT 4, "status" TEXT NOT NULL DEFAULT 'setup', "runMode" TEXT NOT NULL DEFAULT 'live', "scenarioId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Participant" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "displayName" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'reviewer', "isHidden" INTEGER NOT NULL DEFAULT 0, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Participant_key" ON "Participant"("sessionId", "displayName")`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "SpeakerMapping" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "speakerLabel" TEXT NOT NULL, "participantId" TEXT, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "SpeakerMapping_key" ON "SpeakerMapping"("sessionId", "speakerLabel")`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "TranscriptTurn" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "providerSessionId" TEXT NOT NULL, "providerTurnOrder" INTEGER NOT NULL, "segmentIndex" INTEGER NOT NULL DEFAULT 0, "providerSpeakerLabel" TEXT NOT NULL DEFAULT '', "originalProviderSpeakerLabel" TEXT NOT NULL DEFAULT '', "participantId" TEXT, "startMs" INTEGER NOT NULL DEFAULT 0, "endMs" INTEGER NOT NULL DEFAULT 0, "receivedAtMs" INTEGER NOT NULL DEFAULT 0, "originalText" TEXT NOT NULL DEFAULT '', "currentText" TEXT NOT NULL DEFAULT '', "wordsJson" TEXT, "isCalibration" INTEGER NOT NULL DEFAULT 0, "isFinal" INTEGER NOT NULL DEFAULT 0, "isSubstantive" INTEGER NOT NULL DEFAULT 0, "isUnknownSpeaker" INTEGER NOT NULL DEFAULT 0, "possibleOverlap" INTEGER NOT NULL DEFAULT 0, "wasSpeakerRevised" INTEGER NOT NULL DEFAULT 0, "isManuallyCorrected" INTEGER NOT NULL DEFAULT 0, "analysisJson" TEXT, "analysisReceivedAtMs" INTEGER, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "TranscriptTurn_key" ON "TranscriptTurn"("providerSessionId", "providerTurnOrder", "segmentIndex")`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "IntentRevision" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "objective" TEXT, "phase" TEXT, "criteria" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Correction" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "turnId" TEXT, "field" TEXT NOT NULL, "oldValue" TEXT NOT NULL, "newValue" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "DiscussionItem" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "category" TEXT NOT NULL, "text" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'open', "turnIds" TEXT NOT NULL DEFAULT '[]', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "PromptRecord" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "text" TEXT NOT NULL, "supportingTurnIds" TEXT NOT NULL DEFAULT '[]', "confidence" REAL NOT NULL DEFAULT 0, "shown" INTEGER NOT NULL DEFAULT 0, "dismissed" INTEGER NOT NULL DEFAULT 0, "guardRejected" INTEGER NOT NULL DEFAULT 0, "rejectReason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" DATETIME, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Run" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "scenarioId" TEXT, "mode" TEXT NOT NULL DEFAULT 'sim_injected', "stubbed" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'created', "playbackEventsJson" TEXT, "evaluationJson" TEXT, "deviationsJson" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      );
      await client.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "TopicSuggestionCache" ("id" TEXT PRIMARY KEY NOT NULL, "seed" TEXT NOT NULL DEFAULT '', "excludeHash" TEXT NOT NULL DEFAULT '', "suggestionsJson" TEXT NOT NULL DEFAULT '[]', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      );
      console.log("DB schema initialized");
    } catch (e: any) {
      console.error("DB init error:", e.message);
      throw e;
    }
  }

  // Additive runtime migrations must also run for existing mounted databases.
  // CREATE TABLE/INDEX IF NOT EXISTS keeps startup idempotent across deploys.
  try {
    await client.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "LiveAnalysis" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "objective" TEXT NOT NULL, "phase" TEXT NOT NULL, "criteria" TEXT NOT NULL DEFAULT '[]', "transcriptTurnCount" INTEGER NOT NULL, "transcriptWordCount" INTEGER NOT NULL, "transcriptThroughMs" INTEGER NOT NULL, "firstTurnId" TEXT NOT NULL, "lastTurnId" TEXT NOT NULL, "visualEvidenceCount" INTEGER NOT NULL DEFAULT 0, "resultJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    );
    await client.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "LiveAnalysis_sessionId_createdAt_idx" ON "LiveAnalysis"("sessionId", "createdAt")`,
    );
    await client.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "VisualEvidence" ("id" TEXT PRIMARY KEY NOT NULL, "sessionId" TEXT NOT NULL, "capturedAtMs" INTEGER NOT NULL, "nearestTurnId" TEXT, "note" TEXT, "storageKey" TEXT NOT NULL, "contentType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL, "analysisJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    );
    await client.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "VisualEvidence_sessionId_capturedAtMs_idx" ON "VisualEvidence"("sessionId", "capturedAtMs")`,
    );
  } catch (e: any) {
    console.error("DB additive migration error:", e.message);
    throw e;
  }
}
