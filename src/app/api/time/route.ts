import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    iso: new Date().toISOString(),
    unixMs: Date.now(),
  });
}
