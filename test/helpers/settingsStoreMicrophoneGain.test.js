const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

test("microphone gain defaults preserve input and persist bounded manual settings independently of auto mode", async (t) => {
  const { storage } = installBrowserGlobals(t);
  const vite = await createRendererServer(t, { cachePrefix: "hina-mic-gain-test-" });
  const { useSettingsStore } = await vite.ssrLoadModule("/stores/settingsStore.ts");
  let state = useSettingsStore.getState();
  assert.equal(state.micAutoBoost, false);
  assert.equal(state.micGainPercent, 100);
  state.setMicGainPercent(250);
  state.setMicAutoBoost(true);
  state = useSettingsStore.getState();
  assert.equal(state.micAutoBoost, true);
  assert.equal(state.micGainPercent, 250);
  assert.equal(storage.getItem("micAutoBoost"), "true");
  assert.equal(storage.getItem("micGainPercent"), "250");
  state.setMicAutoBoost(false);
  assert.equal(useSettingsStore.getState().micGainPercent, 250);
  state.setMicGainPercent(999);
  assert.equal(useSettingsStore.getState().micGainPercent, 400);
  state.setMicGainPercent(-5);
  assert.equal(useSettingsStore.getState().micGainPercent, 0);
  state.setMicGainPercent(NaN);
  assert.equal(useSettingsStore.getState().micGainPercent, 100);
});

for (const savedChoice of [undefined, "false"]) {
  test(`local Windows defaults auto boost on while respecting saved choice ${savedChoice}`, async (t) => {
    installBrowserGlobals(t, {
      initialStorage: savedChoice === undefined ? {} : { micAutoBoost: savedChoice },
      window: { electronAPI: { localOnly: true, getPlatform: () => "win32" } },
    });
    const vite = await createRendererServer(t, { cachePrefix: "hina-win-mic-gain-test-" });
    const { useSettingsStore } = await vite.ssrLoadModule("/stores/settingsStore.ts");
    assert.equal(useSettingsStore.getState().micAutoBoost, savedChoice === undefined);
  });
}
