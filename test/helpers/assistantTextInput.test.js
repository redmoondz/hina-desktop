const test = require("node:test");
const assert = require("node:assert/strict");

test("only an undragged assistant recording switches to text", async () => {
  const { shouldOpenAssistantTextInput } = await import("../../src/helpers/assistantTextInput.js");
  const active = {
    isAssistantVoice: true,
    isRecording: true,
    isPreparing: false,
    hasDragged: false,
  };
  assert.equal(shouldOpenAssistantTextInput(active), true);
  assert.equal(
    shouldOpenAssistantTextInput({ ...active, isRecording: false, isPreparing: true }),
    true
  );
  for (const override of [
    { hasDragged: true },
    { isAssistantVoice: false },
    { isRecording: false },
  ]) {
    assert.equal(shouldOpenAssistantTextInput({ ...active, ...override }), false);
  }
});

test("discard finishes before opening the text composer", async () => {
  const { openAssistantTextInput } = await import("../../src/helpers/assistantTextInput.js");
  const calls = [];
  await openAssistantTextInput(
    async () => {
      calls.push("discard");
    },
    () => {
      calls.push("open");
    }
  );
  assert.deepEqual(calls, ["discard", "open"]);
});
