// Shared by the audio worklet and deterministic signal tests. Percentages are
// application gain, never OS input volume.
export function normalizeMicGain(value) {
  return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(400, value))) : 100;
}

export function processMicrophoneBlock(input, output, state, settings, sampleRate) {
  let sum = 0;
  let peak = 0;
  for (const sample of input) {
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sum / (input.length || 1));
  let target = normalizeMicGain(settings.micGainPercent) / 100;
  if (settings.micAutoBoost) {
    // Do not chase silence or very faint background noise.
    target = rms >= 0.003 ? Math.max(0.1, Math.min(8, 0.12 / rms)) : 1;
    if (peak > 0) target = Math.min(target, 0.92 / peak);
  }
  const previous = state.gain;
  const timeConstant = target < previous ? 0.01 : 0.3;
  const next = target + (previous - target) * Math.exp(-input.length / sampleRate / timeConstant);
  let outputSum = 0;
  let outputPeak = 0;
  for (let i = 0; i < output.length; i++) {
    const gain = previous + (next - previous) * ((i + 1) / output.length);
    // A sudden transient cannot wait for the gain envelope to catch up.
    const sample = Math.max(-0.98, Math.min(0.98, (input[i] || 0) * gain));
    output[i] = sample;
    outputSum += sample * sample;
    outputPeak = Math.max(outputPeak, Math.abs(sample));
  }
  state.gain = next;
  return { rms: Math.sqrt(outputSum / (output.length || 1)), peak: outputPeak, gain: next };
}
