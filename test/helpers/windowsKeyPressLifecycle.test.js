const test = require("node:test");
const assert = require("node:assert/strict");
const WindowsKeyManager = require("../../src/helpers/windowsKeyManager");

test("native Windows presses ignore duplicate downs and accept the next tap immediately after release", () => {
  const manager = new WindowsKeyManager();
  const events = [];
  manager.on("key-down", (key) => events.push(key));
  manager.handleOutputLine("READY", "F8");
  assert.equal(manager.isWatchingKey("F8"), true);
  manager.handleOutputLine("KEY_DOWN", "F8");
  manager.handleOutputLine("KEY_DOWN", "F8");
  manager.handleOutputLine("KEY_UP", "F8");
  manager.handleOutputLine("KEY_DOWN", "F8");
  assert.deepEqual(events, ["F8", "F8"]);
  manager.stop();
  assert.equal(manager.isWatchingKey("F8"), false);
});
