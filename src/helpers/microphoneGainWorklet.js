import { normalizeMicGain, processMicrophoneBlock } from "./microphoneGain";

class MicrophoneGainProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.settings = options.processorOptions;
    this.state = {
      gain: this.settings.micAutoBoost ? 1 : normalizeMicGain(this.settings.micGainPercent) / 100,
    };
    this.frames = 0;
    this.port.onmessage = ({ data }) => {
      this.settings = data;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;
    const level = processMicrophoneBlock(input, output, this.state, this.settings, sampleRate);
    this.frames += output.length;
    if (this.frames >= sampleRate / 20) {
      this.frames = 0;
      this.port.postMessage(level);
    }
    return true;
  }
}
registerProcessor("microphone-gain", MicrophoneGainProcessor);
