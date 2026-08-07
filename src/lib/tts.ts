export interface TtsSynthesisInput {
  text: string;
  voiceId: string;
  instructions?: string;
  speakingRate?: number;
  format: "wav";
}

export interface TtsProvider {
  synthesize(input: TtsSynthesisInput): Promise<{
    bytes: Buffer;
    contentType: "audio/wav";
  }>;
}

const STUB_FREQUENCIES: Record<string, number> = {
  cedar: 145,
  marin: 310,
  sage: 215,
  shimmer: 420,
  onyx: 175,
  nova: 355,
  alloy: 250,
  ash: 190,
  ballad: 285,
  coral: 375,
  echo: 160,
  fable: 335,
  verse: 265,
};

class OpenAiTtsProvider implements TtsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.TTS_MODEL || "gpt-4o-mini-tts"
  ) {}

  async synthesize(input: TtsSynthesisInput) {
    let lastError = "Speech generation failed";
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: input.text,
          voice: input.voiceId,
          instructions: input.instructions,
          response_format: "wav",
          speed: input.speakingRate || 1,
        }),
      });
      if (response.ok) {
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          contentType: "audio/wav" as const,
        };
      }
      const detail = await response.text();
      lastError = `Speech API returned ${response.status}: ${detail.slice(0, 240)}`;
      if (response.status !== 429 && response.status < 500) break;
      await new Promise((resolve) =>
        setTimeout(resolve, 600 * 2 ** attempt + Math.random() * 150)
      );
    }
    throw new Error(lastError);
  }
}

class ToneTtsProvider implements TtsProvider {
  async synthesize(input: TtsSynthesisInput) {
    const words = input.text.trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(
      0.7,
      Math.min(14, (words / (145 * (input.speakingRate || 1))) * 60)
    );
    const frequency = STUB_FREQUENCIES[input.voiceId] || 240;
    return {
      bytes: makeToneWav(frequency, durationSeconds),
      contentType: "audio/wav" as const,
    };
  }
}

function makeToneWav(frequency: number, durationSeconds: number): Buffer {
  const sampleRate = 16_000;
  const samples = Math.max(1, Math.round(sampleRate * durationSeconds));
  const dataBytes = samples * 2;
  const output = Buffer.allocUnsafe(44 + dataBytes);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataBytes, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataBytes, 40);
  const fadeSamples = Math.round(sampleRate * 0.03);
  for (let index = 0; index < samples; index++) {
    const fade = Math.min(
      1,
      index / fadeSamples,
      (samples - index - 1) / fadeSamples
    );
    const value =
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) *
      0.35 *
      Math.max(0, fade);
    output.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return output;
}

export function createTtsProvider(): TtsProvider {
  if (process.env.TTS_STUB === "1") return new ToneTtsProvider();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Real speech synthesis requires OPENAI_API_KEY. Set TTS_STUB=1 only for deterministic tone fixtures."
    );
  }
  return new OpenAiTtsProvider(apiKey);
}
