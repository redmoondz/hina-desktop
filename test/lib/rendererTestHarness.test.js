const test = require("node:test");
const assert = require("node:assert/strict");
const { installBrowserGlobals } = require("./rendererTestHarness");

test("renderer fixtures default to English independently of the host OS", (t) => {
  installBrowserGlobals(t);
  assert.equal(localStorage.getItem("uiLanguage"), "en");
});

test("locale-specific fixtures can override or omit the default preference", (t) => {
  const first = installBrowserGlobals(t, { initialStorage: { uiLanguage: "zh-CN" } });
  assert.equal(first.storage.getItem("uiLanguage"), "zh-CN");
  const second = installBrowserGlobals(t, { initialStorage: { uiLanguage: null } });
  assert.equal(second.storage.getItem("uiLanguage"), null);
});
