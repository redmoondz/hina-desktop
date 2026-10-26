const test = require("node:test");
const assert = require("node:assert/strict");

test("minimize retains identity; close releases it without cancelling background work", async () => {
  const { sessionSurfaceTransition } = await import("../../src/helpers/hinaSessionSurface.js");
  const state = { activeId: "one", visible: true };
  assert.deepEqual(sessionSurfaceTransition(state, "minimize"), {
    activeId: "one",
    visible: false,
  });
  assert.deepEqual(sessionSurfaceTransition(state, "close"), { activeId: null, visible: false });
  assert.deepEqual(sessionSurfaceTransition({ activeId: "one", visible: false }, "open"), state);
});
