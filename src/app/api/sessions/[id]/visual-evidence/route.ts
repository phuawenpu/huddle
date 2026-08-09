import { NextRequest, NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import { prisma, databaseReady } from "@/lib/db";
import {
  analyzeVisualEvidence,
  serializeVisualEvidence,
} from "@/lib/visual-evidence";
import { publish } from "@/lib/pubsub";
import { visualEvidencePatch } from "@/lib/sse";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await databaseReady;
  try {
    const evidence = await prisma.visualEvidence.findMany({
      where: { sessionId: id },
      orderBy: { capturedAtMs: "desc" },
      take: 24,
    });
    return NextResponse.json(evidence.map(serializeVisualEvidence));
  } catch (error) {
    console.error("Failed to list visual evidence:", error);
    return NextResponse.json(
      { error: "Failed to list visual evidence" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await databaseReady;
  let savedPath = "";
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose an image to capture." },
        { status: 400 },
      );
    }
    const extension = ACCEPTED_IMAGE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG, or WebP image." },
        { status: 415 },
      );
    }
    if (file.size < 16 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image must be between 16 bytes and 4 MB." },
        { status: 413 },
      );
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        transcriptTurns: {
          where: { isFinal: true },
          orderBy: { receivedAtMs: "asc" },
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const latestTurnMs = session.transcriptTurns.at(-1)?.endMs ?? 0;
    const capturedAtMs = boundedSessionMs(
      form.get("capturedAtMs"),
      latestTurnMs,
    );
    const note = boundedOptionalText(form.get("note"), 300);
    const nearestTurn = session.transcriptTurns.reduce<
      (typeof session.transcriptTurns)[number] | null
    >((nearest, turn) => {
      if (!nearest) return turn;
      return Math.abs(turn.endMs - capturedAtMs) <
        Math.abs(nearest.endMs - capturedAtMs)
        ? turn
        : nearest;
    }, null);

    const evidenceId = crypto.randomUUID();
    const storageKey = join(
      "visual-evidence",
      session.id,
      `${evidenceId}${extension}`,
    );
    const assetRoot = resolve(
      process.cwd(),
      process.env.ASSET_DIR || "./data/audio",
    );
    savedPath = resolve(assetRoot, storageKey);
    if (!savedPath.startsWith(`${assetRoot}${sep}`)) {
      throw new Error("Resolved visual evidence path escaped the asset root.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!matchesImageSignature(bytes, file.type)) {
      return NextResponse.json(
        { error: "The uploaded bytes do not match the declared image type." },
        { status: 415 },
      );
    }
    await mkdir(dirname(savedPath), { recursive: true });
    await writeFile(savedPath, bytes, { flag: "wx" });

    const analysis = await analyzeVisualEvidence(bytes, file.type, {
      objective: session.objective,
      phase: session.phase,
      note,
      recentTurns: session.transcriptTurns.slice(-8).map((turn) => ({
        id: turn.id,
        speakerLabel: turn.providerSpeakerLabel,
        text: turn.currentText,
      })),
    });
    const record = await prisma.visualEvidence.create({
      data: {
        id: evidenceId,
        sessionId: id,
        capturedAtMs,
        nearestTurnId: nearestTurn?.id ?? null,
        note: note || null,
        storageKey,
        contentType: file.type,
        byteSize: bytes.length,
        analysisJson: JSON.stringify(analysis),
      },
    });
    const response = serializeVisualEvidence(record);
    publish(id, visualEvidencePatch(response));
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (savedPath) await unlink(savedPath).catch(() => undefined);
    console.error("Visual evidence capture failed:", error);
    return NextResponse.json(
      { error: "Failed to capture visual evidence" },
      { status: 500 },
    );
  }
}

function boundedSessionMs(value: FormDataEntryValue | null, fallback: number) {
  const number = value == null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 2_147_483_647) {
    throw new Error("capturedAtMs must use session-relative milliseconds.");
  }
  return Math.round(number);
}

function boundedOptionalText(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function matchesImageSignature(bytes: Buffer, contentType: string) {
  if (contentType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === "image/png") {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
