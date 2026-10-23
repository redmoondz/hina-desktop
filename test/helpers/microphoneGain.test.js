const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../../src/helpers/microphoneGain.js");

test("manual gain supports mute, unity and boost with bounded settings", async () => {
  const { processMicrophoneBlock, normalizeMicGain } = await load();
  assert.equal(normalizeMicGain(NaN), 100);
  assert.equal(normalizeMicGain(Infinity), 100);
  assert.equal(normalizeMicGain(-1), 0);
  assert.equal(normalizeMicGain(999), 400);
  for (const [percent, expected] of [
    [0, 0],
    [100, 0.1],
    [300, 0.3],
  ]) {
    const output = new Float32Array(128);
    processMicrophoneBlock(
      new Float32Array(128).fill(0.1),
      output,
      { gain: percent / 100 },
      { micGainPercent: percent },
      48000
    );
    assert.ok(Math.abs(output[127] - expected) < 0.00001);
  }
});

test("auto boost raises quiet speech but never pumps silence or faint noise", async () => {
  const { processMicrophoneBlock } = await load();
  for (const amplitude of [0, 0.001, 0.02]) {
    const state = { gain: 1 };
    const output = new Float32Array(128);
    for (let i = 0; i < 1500; i++) {
      processMicrophoneBlock(
        new Float32Array(128).fill(amplitude),
        output,
        state,
        { micAutoBoost: true },
        48000
      );
    }
    if (amplitude < 0.003) assert.equal(state.gain, 1);
    else assert.ok(output[127] > amplitude * 4);
    assert.ok(state.gain <= 8);
  }
});

test("loud transients stay below clipping after boosted speech", async () => {
  const { processMicrophoneBlock } = await load();
  const output = new Float32Array(128);
  const state = { gain: 8 };
  processMicrophoneBlock(
    new Float32Array(128).fill(0.9),
    output,
    state,
    { micAutoBoost: true },
    48000
  );
  assert.ok(output.every((sample) => Math.abs(sample) <= 0.981));
});

test("switching auto boost off restores the retained manual setting", async () => {
  const { processMicrophoneBlock } = await load();
  const state = { gain: 6 };
  const output = new Float32Array(128);
  for (let i = 0; i < 1500; i++) {
    processMicrophoneBlock(
      new Float32Array(128).fill(0.05),
      output,
      state,
      { micAutoBoost: false, micGainPercent: 200 },
      48000
    );
  }
  assert.ok(Math.abs(output[127] - 0.1) < 0.0001);
});
