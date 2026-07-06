class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Reduced from 4096 to 512 for ~32ms latency at 16kHz (real-time streaming)
    // Lower buffer = more frequent chunks = lower latency
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        if (this.bufferIndex >= this.bufferSize) {
          // Send chunk immediately when buffer fills
          this.port.postMessage({
            type: "audio",
            data: this.buffer.slice(),
          });
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
