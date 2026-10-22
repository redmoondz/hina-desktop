const test = require("node:test");
const assert = require("node:assert/strict");

test("one modifier chord cannot start and stop the microphone within 60 ms", () => {
  const { createVoiceAgentHotkeyHandler } = require("../../src/helpers/voiceAgentHotkeyHandler");
  let time = 0;
  const calls = [];
  const handler = createVoiceAgentHotkeyHandler({
    platform: "win32",
    now: () => time,
    windowManager: { getActivationMode: () => "tap", sendToggleVoiceAgent: () => calls.push(time) },
    hotkeyManager: {},
    nativeKeyManager: { isWatchingKey: () => true },
  });
  handler("Control+Alt+Shift", "down", true);
  time = 60;
  handler("Control+Alt+Shift", "down", true);
  handler("Control+Alt+Shift");
  handler("Control+Alt+Shift", "up", true);
  assert.deepEqual(calls, [0]);
  time = 4000;
  handler("Control+Alt+Shift", "down", true);
  assert.deepEqual(calls, [0, 4000]);
});

test("push-to-talk still starts on down and stops on physical release", () => {
  const { createVoiceAgentHotkeyHandler } = require("../../src/helpers/voiceAgentHotkeyHandler");
  const calls = [];
  const handler = createVoiceAgentHotkeyHandler({
    platform: "win32",
    windowManager: {
      getActivationMode: () => "push",
      startWindowsPushToTalk: (...args) => calls.push(["start", ...args]),
      handleWindowsPushKeyUp: (key) => calls.push(["stop", key]),
    },
    hotkeyManager: {},
    nativeKeyManager: {},
  });
  handler("F9");
  handler("F9", "down", true);
  handler("F9", "up", true);
  assert.deepEqual(calls, [
    ["start", "F9", "assistant"],
    ["stop", "F9"],
  ]);
});
