import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Uploaded Recording";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/x-wav"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a|webm|ogg)$/i)) {
      return NextResponse.json({ error: `Unsupported audio format: ${file.type}. Use WAV, MP3, M4A, WebM, or OGG.` }, { status: 400 });
    }

    // Ensure upload dir exists
    const uploadDir = join(process.cwd(), process.env.ASSET_DIR || "./data/audio", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}_${safeName}`;
    const filepath = join(uploadDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Create a record in the DB for this upload
    const { prisma } = await import("@/lib/db");
    
    // We'll use the Scenario table to track uploads too, with a marker
    const upload = await prisma.scenario.create({
      data: {
        title: title,
        description: `Uploaded: ${file.name} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`,
        topic: "uploaded_recording", objective: "Uploaded audio recording",
        domain: "upload",
        durationMinutes: 0,
        speakerCount: 0,
        status: "ready", // Ready means audio is available
        speakersJson: JSON.stringify([]),
        turnsJson: JSON.stringify([]),
      },
    });

    return NextResponse.json({
      id: upload.id,
      title: upload.title,
      filename: filename,
      size: buffer.length,
      type: file.type,
      url: `/api/assets/uploads/${filename}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const uploads = await prisma.scenario.findMany({
      where: { topic: "uploaded_recording" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        status: true,
      },
    });
    return NextResponse.json(uploads);
  } catch {
    return NextResponse.json([]);
  }
}
