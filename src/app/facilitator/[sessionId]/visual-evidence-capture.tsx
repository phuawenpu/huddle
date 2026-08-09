"use client";

import { useEffect, useRef, useState } from "react";
import type { VisualEvidenceData } from "@/lib/types";

interface VisualEvidenceCaptureProps {
  sessionId: string;
  capturedAtMs: number;
  evidence: VisualEvidenceData[];
  onCaptured: (evidence: VisualEvidenceData) => void;
}

export function VisualEvidenceCapture({
  sessionId,
  capturedAtMs,
  evidence,
  onCaptured,
}: VisualEvidenceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const startCamera = async () => {
    setError("");
    setStartingCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraEnabled(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the camera.",
      );
      stopCamera();
    } finally {
      setStartingCamera(false);
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("The camera frame is not ready yet.");
      return;
    }
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setError("This browser could not capture the camera frame.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) {
      setError("This browser could not encode the camera frame.");
      return;
    }
    await uploadEvidence(
      new File([blob], `critique-frame-${Date.now()}.jpg`, {
        type: "image/jpeg",
      }),
    );
  };

  const uploadEvidence = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("capturedAtMs", String(capturedAtMs));
      form.append("note", note);
      const response = await fetch(
        `/api/sessions/${sessionId}/visual-evidence`,
        { method: "POST", body: form },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Capture failed.");
      onCaptured(data);
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Capture failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
  }

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-hud-border bg-[linear-gradient(180deg,rgba(20,20,31,0.98),rgba(10,10,15,0.98))]"
      aria-label="Visual evidence"
    >
      <div className="shrink-0 border-b border-hud-border px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-200">
              Visual layer
            </h2>
            <p className="mt-0.5 text-[10px] leading-snug text-hud-muted">
              Camera stays local until you deliberately capture one frame.
            </p>
          </div>
          <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1 text-[10px] text-fuchsia-200">
            {evidence.length} captured
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 overscroll-contain">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-fuchsia-300/25 bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraEnabled ? "opacity-100" : "opacity-0"}`}
            aria-label="Camera preview"
          />
          {!cameraEnabled && (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgba(217,70,239,0.12),transparent_65%)] p-5 text-center">
              <div>
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 text-lg text-fuchsia-200">
                  ◉
                </div>
                <p className="mt-2 text-xs font-medium text-hud-text">
                  Add the artifact to the critique record
                </p>
                <p className="mt-1 text-[10px] text-hud-muted">
                  Frame a prototype, sketch, or shared physical context.
                </p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-2 border border-fuchsia-200/20" />
          <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-fuchsia-200/70" />
          <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-fuchsia-200/70" />
          <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-fuchsia-200/70" />
          <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-fuchsia-200/70" />
          {cameraEnabled && (
            <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-red-300">
              ● Preview only
            </span>
          )}
        </div>

        <label className="mt-2 block">
          <span className="sr-only">Visual evidence note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note: what should the analysis notice?"
            className="min-h-10 w-full rounded-lg border border-hud-border bg-hud-bg px-3 py-2 text-xs text-hud-text outline-none focus:border-fuchsia-300/50"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {cameraEnabled ? (
            <>
              <button
                type="button"
                onClick={captureFrame}
                disabled={uploading}
                className="min-h-11 rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {uploading ? "Analyzing frame…" : "Capture evidence"}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-11 rounded-lg border border-hud-border bg-hud-bg px-3 py-2 text-xs text-hud-text"
              >
                Stop camera
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startCamera}
                disabled={startingCamera}
                className="min-h-11 rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {startingCamera ? "Starting…" : "Enable camera"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="min-h-11 rounded-lg border border-hud-border bg-hud-bg px-3 py-2 text-xs text-hud-text disabled:opacity-50"
              >
                {uploading ? "Analyzing…" : "Choose image"}
              </button>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          data-testid="visual-evidence-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadEvidence(file);
          }}
        />
        {error && (
          <p className="mt-2 rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1.5 text-[11px] text-red-200">
            {error}
          </p>
        )}

        {evidence.length > 0 && (
          <div className="mt-3 space-y-2" data-testid="visual-evidence-list">
            {evidence.slice(0, 8).map((item) => (
              <article
                key={item.id}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-lg border border-hud-border bg-hud-bg/70 p-2"
              >
                <a
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video overflow-hidden rounded border border-hud-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.analysis.caption}
                    className="h-full w-full object-cover"
                  />
                </a>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] leading-snug text-hud-text/85">
                    {item.analysis.caption}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-hud-muted">
                    {formatSessionTime(item.capturedAtMs)} ·{" "}
                    {item.analysis.engine === "model" ? "vision" : "noted"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function formatSessionTime(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
