const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
let panel;

// Load the real WindowManager with the module surface it touches at require
// time. Exercise the real settings event handlers with a minimal receiver.
const originalLoad = Module._load;
Module._load = function loadWindowManagerWithStubs(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { on: () => undefined },
      screen: {
        getPrimaryDisplay: () => ({}),
        on: () => undefined,
      },
      BrowserWindow: class extends EventEmitter {
        constructor() {
          super();
          this.webContents = new EventEmitter();
          this.setTitle = () => {};
          panel = this;
        }
      },
      shell: {},
      dialog: {},
      ipcMain: { on: () => undefined, handle: () => undefined },
      Menu: {},
    };
  }
  if (request === "./debugLogger") {
    return { warn: () => undefined, debug: () => undefined, info: () => undefined };
  }
  if (request === "./linuxWindowInputRegion") {
    return {
      createLinuxWindowInputRegion: () => ({
        set: () => undefined,
        focus: () => undefined,
        stop: () => undefined,
      }),
    };
  }
  if (request === "./hotkeyManager") return class {};
  if (request === "./dragManager") return class {};
  if (request === "./menuManager") return { setupControlPanelMenu() {} };
  if (request === "./devServerManager") {
    return {
      DEV_SERVER_PORT: 5173,
      DEV_SERVER_URL: "http://localhost:5173",
      getAppFilePath: () => ({ path: "/app/index.html", query: {} }),
      waitForDevServer: () => Promise.resolve(),
    };
  }
  if (request === "./dockManager") return { setControlPanelVisible() {} };
  if (request === "./i18nMain") return { i18nMain: { t: (key) => key } };
  if (request === "./windowConfig") {
    return {
      MAIN_WINDOW_CONFIG: {},
      CONTROL_PANEL_CONFIG: {},
      NOTIFICATION_WINDOW_CONFIG: {},
      WINDOW_SIZES: {},
      WindowPositionUtil: { setupAlwaysOnTop: () => undefined },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const WindowManager = require("../../src/helpers/windowManager");
Module._load = originalLoad;

test("loading and closing settings preserves the recorder readiness gate", async () => {
  const readinessChanges = [];
  const receiver = {
    controlPanelWindow: null,
    _onboardingActive: false,
    registerExternalLinkHandlers() {},
    endOnboardingDemo() {},
    _hideNormalAppSurfaces() {},
    _clearControlPanelVisibilityTimer() {
      clearTimeout(this._controlPanelVisibilityTimer);
    },
    loadControlPanel: async () => {},
    setOnboardingActive: (active) => readinessChanges.push(active),
  };
  await WindowManager.prototype.createControlPanelWindow.call(receiver);
  try {
    panel.webContents.emit("did-finish-load");
    assert.deepEqual(readinessChanges, []);
    panel.emit("closed");
    assert.equal(receiver._onboardingActive, false);
  } finally {
    clearTimeout(receiver._controlPanelVisibilityTimer);
  }
});
