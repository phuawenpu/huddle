/**
 * PCM Resampler AudioWorklet Processor
 * 
 * Captures Float32 audio from any hardware sample rate,
 * resamples to 16 kHz mono, converts to Int16 PCM,
 * and outputs via the MessagePort for WebSocket transmission.
 * 
 * Runs entirely off the main thread.
 */
class PcmResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.frameMs = 50; // 50ms frames = 800 samples at 16kHz
    this.buffer = new Float32Array(0);
    this.frameCount = 0;
    this.bytesWritten = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === "setTargetRate") {
        this.targetSampleRate = e.data.rate || 16000;
      }
      if (e.data.type === "setFrameMs") {
        this.frameMs = e.data.ms || 50;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0]; // Float32, mono
    const inputSampleRate = sampleRate; // global from AudioWorkletGlobalScope
    const targetRate = this.targetSampleRate;
    const frameSize = Math.round(targetRate * (this.frameMs / 1000)); // samples per frame

    // Append new data to buffer
    const combined = new Float32Array(this.buffer.length + channelData.length);
    combined.set(this.buffer, 0);
    combined.set(channelData, this.buffer.length);
    this.buffer = combined;

    // Resample and emit frames
    const ratio = inputSampleRate / targetRate;
    
    while (this.buffer.length >= Math.ceil(frameSize * ratio)) {
      const needed = Math.ceil(frameSize * ratio);
      const chunk = this.buffer.subarray(0, needed);
      this.buffer = this.buffer.subarray(needed);

      // Simple linear resampling
      const resampled = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        const srcIdx = i * ratio;
        const srcFloor = Math.floor(srcIdx);
        const srcCeil = Math.min(srcFloor + 1, chunk.length - 1);
        const frac = srcIdx - srcFloor;
        resampled[i] = chunk[srcFloor] * (1 - frac) + chunk[srcCeil] * frac;
      }

      // Float32 → Int16
      const pcm16 = new Int16Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Transfer buffer (detached ArrayBuffer for zero-copy)
      const buffer = pcm16.buffer.slice(0);
      this.port.postMessage(
        { 
          type: "pcm16", 
          buffer: buffer,
          frameIndex: this.frameCount,
          sampleRate: targetRate,
          channels: 1,
        },
        [buffer]
      );

      this.frameCount++;
      this.bytesWritten += pcm16.byteLength;
    }

    return true; // Keep processor alive
  }
}

registerProcessor("pcm-resampler", PcmResamplerProcessor);
