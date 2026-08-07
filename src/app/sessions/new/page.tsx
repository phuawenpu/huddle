"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type DesignThinkingPhase =
  | "frame" | "empathize" | "define" | "ideate"
  | "evaluate" | "decide" | "plan_experiment" | "reflect";

const PHASES: { value: DesignThinkingPhase; label: string }[] = [
  { value: "frame", label: "Frame" },
  { value: "empathize", label: "Empathize" },
  { value: "define", label: "Define" },
  { value: "ideate", label: "Ideate" },
  { value: "evaluate", label: "Evaluate" },
  { value: "decide", label: "Decide" },
  { value: "plan_experiment", label: "Plan Experiment" },
  { value: "reflect", label: "Reflect" },
];

interface Recording {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  speakerCount: number;
  crossTalkLevel: string;
  difficulty: string;
  status: string;
  speakers?: Array<{ index: number; name: string; voiceId: string }>;
  turnCount: number;
  mixedUrl: string | null;
  source?: string;
  createdAt: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [phase, setPhase] = useState<DesignThinkingPhase>("evaluate");
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [speakerCount, setSpeakerCount] = useState(4);
  const [participants, setParticipants] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Audio upload
  const [audioSource, setAudioSource] = useState<"mic" | "upload" | "recording">("mic");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Recordings library
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>("");
  const [loadingRecordings, setLoadingRecordings] = useState(false);

  // Synthesize a recording from the library
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);

  useEffect(() => {
    if (audioSource === "recording") {
      setLoadingRecordings(true);
      fetch("/api/recordings")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setRecordings(data);
        })
        .catch(() => {})
        .finally(() => setLoadingRecordings(false));
    }
  }, [audioSource]);

  const updateParticipant = (idx: number, value: string) => {
    const next = [...participants];
    next[idx] = value;
    setParticipants(next);
  };

  const updateCriterion = (idx: number, value: string) => {
    const next = [...criteria];
    next[idx] = value;
    setCriteria(next);
    
    // Auto-add empty row if last is filled
    if (idx === next.length - 1 && value.trim()) {
      setCriteria([...next, ""]);
    }
  };

  const removeCriterion = (idx: number) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const handleSpeakerCountChange = (count: number) => {
    setSpeakerCount(count);
    setParticipants(prev => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill("")];
      }
      return prev.slice(0, count);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a|webm|ogg)$/i)) {
        setError("Unsupported format. Use WAV, MP3, M4A, WebM, or OGG.");
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        setError("File too large. Max 500 MB.");
        return;
      }
      setUploadedFile(file);
      setError("");
      setUploadProgress(`${(file.size / (1024 * 1024)).toFixed(1)} MB ready`);
    }
  };

  const handleSynthesizeRecording = async (recordingId: string) => {
    setSynthesizingId(recordingId);
    try {
      const res = await fetch(`/api/scenarios/${recordingId}/synthesize`, { method: "POST" });
      const data = await res.json();
      if (data.synthesized) {
        // Refresh recordings list
        const refreshed = await fetch("/api/recordings").then(r => r.json());
        if (Array.isArray(refreshed)) setRecordings(refreshed);
      }
    } catch {
      setError("Synthesis failed");
    } finally {
      setSynthesizingId(null);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      let scenarioId: string | null = null;

      // If using a recording, we may need to synthesize it first
      if (audioSource === "recording" && selectedRecordingId) {
        const rec = recordings.find(r => r.id === selectedRecordingId);
        if (rec && !rec.mixedUrl) {
          // Synthesize first
          const synRes = await fetch(`/api/scenarios/${selectedRecordingId}/synthesize`, { method: "POST" });
          const synData = await synRes.json();
          if (!synData.synthesized) {
            throw new Error("Failed to synthesize recording");
          }
        }
        scenarioId = selectedRecordingId;
      }

      // Handle uploaded file
      let uploadedRecordingId: string | null = null;
      if (audioSource === "upload" && uploadedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("title", title || uploadedFile.name);

        const uploadRes = await fetch("/api/uploads", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        
        if (uploadData.error) throw new Error(uploadData.error);
        uploadedRecordingId = uploadData.id;
        setUploading(false);
      }

      // Create the session
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Critique",
          objective: objective,
          phase: phase,
          criteria: criteria.filter(c => c.trim()),
          speakerCount: speakerCount,
          runMode: audioSource === "mic" ? "live" : "sim_injected",
          scenarioId: scenarioId || uploadedRecordingId || null,
        }),
      });

      const sessionData = await sessionRes.json();
      if (sessionData.error) throw new Error(sessionData.error);

      // Create participants if named
      const namedParticipants = participants.filter(p => p.trim());
      for (const name of namedParticipants) {
        await fetch(`/api/sessions/${sessionData.id}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, role: "reviewer" }),
        });
      }

      router.push(`/facilitator/${sessionData.id}`);
    } catch (e: any) {
      setError(e.message || "Failed to create session");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <main className="min-h-dvh safe-top safe-bottom safe-left safe-right bg-hud-bg text-hud-text">
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">New Critique Session</h1>
          <button onClick={() => router.push("/")} className="text-sm text-hud-muted hover:text-hud-text">
            ← Home
          </button>
        </header>

        {/* Audio Source Selection */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-hud-muted uppercase tracking-wider">
            Audio Source
          </h2>
          <div className="flex gap-2">
            {(["mic", "upload", "recording"] as const).map(src => (
              <button
                key={src}
                onClick={() => setAudioSource(src)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border transition-all touch-manipulation ${
                  audioSource === src
                    ? "bg-hud-accent border-hud-accent text-white"
                    : "bg-hud-surface border-hud-border text-hud-muted hover:border-hud-accent/50"
                }`}
                style={{ minHeight: 44 }}
              >
                {src === "mic" && "🎤 Live Mic"}
                {src === "upload" && "📁 Upload File"}
                {src === "recording" && "📼 Past Recording"}
              </button>
            ))}
          </div>

          {/* Upload file area */}
          {audioSource === "upload" && (
            <div className="p-4 border-2 border-dashed border-hud-border rounded-xl bg-hud-surface/50 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,.wav,.mp3,.m4a,.webm,.ogg"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploadedFile ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-400">✓ {uploadedFile.name}</p>
                  <p className="text-xs text-hud-muted">{uploadProgress}</p>
                  <button
                    onClick={() => { setUploadedFile(null); setUploadProgress(""); }}
                    className="text-xs text-hud-muted underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-6 w-full text-hud-muted hover:text-hud-text transition-colors"
                  style={{ minHeight: 80 }}
                >
                  <p className="text-lg mb-1">📁</p>
                  <p className="text-sm">Tap to select an audio file</p>
                  <p className="text-xs text-hud-muted mt-1">WAV, MP3, M4A, WebM, OGG — max 500 MB</p>
                </button>
              )}
            </div>
          )}

          {/* Past recordings browser */}
          {audioSource === "recording" && (
            <div className="space-y-2">
              {loadingRecordings && (
                <p className="text-sm text-hud-muted py-4 text-center">Loading recordings…</p>
              )}
              {!loadingRecordings && recordings.length === 0 && (
                <div className="p-4 border border-hud-border rounded-xl bg-hud-surface/50 text-center">
                  <p className="text-sm text-hud-muted">No recordings yet.</p>
                  <p className="text-xs text-hud-muted mt-1">
                    Generate scenarios from the Scenarios page first, then synthesize them to create recordings.
                  </p>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedRecordingId(rec.id);
                      setTitle(rec.title);
                      setSpeakerCount(rec.speakerCount || 4);
                      setParticipants(Array(rec.speakerCount || 4).fill(""));
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedRecordingId === rec.id
                        ? "border-hud-accent bg-hud-accent/10"
                        : "border-hud-border bg-hud-surface hover:border-hud-accent/50"
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rec.title}</p>
                        <p className="text-xs text-hud-muted">
                          {rec.durationMinutes}min · {rec.speakerCount} speakers · {rec.turnCount} turns · {rec.crossTalkLevel}
                          {rec.source === "upload" && " · Uploaded"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {rec.mixedUrl ? (
                          <span className="text-xs text-green-400">✓ Ready</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSynthesizeRecording(rec.id);
                            }}
                            disabled={synthesizingId === rec.id}
                            className="text-xs px-2 py-1 rounded bg-hud-accent/20 text-hud-accent hover:bg-hud-accent/40 disabled:opacity-50"
                          >
                            {synthesizingId === rec.id ? "..." : "Generate Audio"}
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Session details */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-hud-muted uppercase tracking-wider">
            Session Details
          </h2>
          
          <div>
            <label className="block text-xs text-hud-muted mb-1">Session Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Onboarding Flow Critique"
              className="w-full bg-hud-surface border border-hud-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-hud-accent"
              style={{ minHeight: 44 }}
            />
          </div>

          <div>
            <label className="block text-xs text-hud-muted mb-1">Design Thinking Phase</label>
            <select
              value={phase}
              onChange={e => setPhase(e.target.value as DesignThinkingPhase)}
              className="w-full bg-hud-surface border border-hud-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-hud-accent appearance-none"
              style={{ minHeight: 44 }}
            >
              {PHASES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-hud-muted mb-1">Objective</label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="What is this critique trying to achieve?"
              rows={2}
              className="w-full bg-hud-surface border border-hud-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-hud-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-hud-muted mb-1">Speaker Count</label>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => handleSpeakerCountChange(n)}
                  className={`w-12 h-11 rounded-lg text-sm font-medium border transition-all touch-manipulation ${
                    speakerCount === n
                      ? "bg-hud-accent border-hud-accent text-white"
                      : "bg-hud-surface border-hud-border text-hud-muted"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-hud-muted mb-1">Participants (optional)</label>
            <div className="space-y-1">
              {participants.map((name, i) => (
                <input
                  key={i}
                  value={name}
                  onChange={e => updateParticipant(i, e.target.value)}
                  placeholder={`Speaker ${String.fromCharCode(65 + i)}`}
                  className="w-full bg-hud-surface border border-hud-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-hud-accent"
                  style={{ minHeight: 44 }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-hud-muted mb-1">Success Criteria</label>
            <div className="space-y-1">
              {criteria.map((criterion, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={criterion}
                    onChange={e => updateCriterion(i, e.target.value)}
                    placeholder="e.g. All major claims are evidence-backed"
                    className="flex-1 bg-hud-surface border border-hud-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-hud-accent"
                    style={{ minHeight: 44 }}
                  />
                  {criteria.length > 1 && (
                    <button
                      onClick={() => removeCriterion(i)}
                      className="w-10 h-11 flex items-center justify-center text-hud-muted hover:text-red-400 text-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || uploading}
          className="w-full py-3.5 bg-hud-accent text-white text-center rounded-xl font-semibold text-lg
            hover:bg-hud-accent-dim active:scale-[0.98] transition-all touch-manipulation
            disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 56 }}
        >
          {uploading ? "Uploading…" : loading ? "Creating…" : audioSource === "mic" ? "🎤 Start Live Critique" : "▶ Start Critique Session"}
        </button>

        <p className="text-xs text-hud-muted text-center">
          {audioSource === "mic"
            ? "Browser microphone will be used for live transcription."
            : audioSource === "upload"
            ? "Your uploaded audio will be processed through the critique pipeline."
            : "Selected recording will be used for playback-based critique."}
        </p>
      </div>
    </main>
  );
}
